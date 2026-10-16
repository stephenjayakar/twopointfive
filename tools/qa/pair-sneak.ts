// A PAIR SNEAK, MEASURED — what happens today when the player sneaks a level with ONE AI partner. A measuring tool: nothing of the game is edited, and with
// this file absent the build is the build. It stands the game up exactly as tools/qa/playthrough.ts does (the scenario's own URL with the loadout's `squad=N`
// on it), puts a scripted SNEAKING player on the floor and reads the game every frame for who got the pair noticed and how.
//   bun run tools/qa/pair-sneak.ts --one records-pair:433 --arm pair [--trace] [--cap 300] [--outfile x.json]
//   bun run tools/qa/pair-sneak.ts --out <dir> --scn records-pair,room-clear-pair --seeds 433-576 --arms solo,pair [--jobs 4] [--cap 300]
// ARMS
//   solo      squad=0: Sam alone, the same script (the baseline: what the level does to a lone sneak with this script)
//   pair      squad=1 (Blue One), 'go silent' on the first frame the squad stands (silent.ts setSilent, as X then 5 gives it), then 'fall in'
//   pairloud  squad=1, the silent order NEVER given, 'fall in' (a player who forgets the order: the partner as staged — loud posture)
//   pairhold  squad=1, 'go silent', then 'hold position' where he starts: the partner left behind on purpose
//   pairlate  squad=1, 'go silent', 'hold position' at the start; 'fall in' only once every defender is down (never, if it goes wrong) — = pairhold for the tally
//   pairquiet squad=1, as `pair`, the teammate carrying the kit screen's own Quiet set (kit.ts kitPresetCard)
//   pairmark  squad=1, as `pair`, PLUS A SCRIPTED COMMANDER who uses the quiet orders (pairorders.ts; the run is an ERROR with PAIR.on false): for each defender the
//             script would otherwise go and shoot — once that man is an order target (g.pair.isFoe: the fog of war shows him), inside PS_MARK_M (16 m) with no shut
//             door between, and Sam is stopped, crouched, outside that man's eye cone and no defender is seeing him (the game's own canSeeChar) — he gives 'take him · on your mark' (row
//             'pairMark') through g.orders.give, as the menu's digit would (the row's own refusals apply), and stays still and low with his reticle off the man.
//             Partner SET (g.pair.jobOf(mate).set) → the mark (g.pair.mark('api')) and up to PS_MARK_GO (8) s for the man to go down; a WATCHED hold (J.watcher)
//             is waited out up to PS_MARK_WATCH (20) s (a defender SEEING Sam — sightings that move his awareness — for PS_MARK_SEEN (0.7) s while he waits: the order is off), then PS_ANYWAY=1: a second mark ('going anyway') · PS_ANYWAY=0 (the default): the job is cancelled. The order
//             refused, the job called off, any defender roused, or PS_MARK_SET (60) s with no 'set': 'fall in' and Sam deals with that man himself (his pistol, as
//             `pair`). After every man: 'fall in' again. Its time cap is --cap × PS_MARK_CAPK (3): the stalk takes its time. Books: m.mark (PAIR_STATS / PAIR_LOG).
// THE SWITCHES of the game (PAIR.on · SNEAK.on · SPOTTED.on, and pairup.ts's PAIRUP.on where that file is) are the ENVIRONMENT's (PAIR=1, or PAIRORDERS=1 / SNEAK=on /
// SPOTTED=1): nothing here sets them. Every row carries `sw` = what they read when the run ended; `--tag X` files rows as <scn>.<arm>.X.jsonl so the on and the off
// arm of the same seeds sit in one folder. Every run is its own process (the modules' counters start at zero).
// THE SCRIPTED SNEAKING PLAYER (a test driver; ONE player, the same in every arm): Sam on his own feet and keys (WASD along the nav path, C, the digit for the
// pistol, the left button, Space on a door's rows). He is MORTAL and SEEN: no god mode, and his light meter is fed every frame from the CPU estimate of the
// direct light on him (guards.ts lightEstimateAt — what a teammate's meter falls back on headless: no bounce, no moon). He carries the suppressed pistol,
// crouches whenever a living defender is within SNEAK.crouchM, and works the nearest living defender by the nav path: walk at him; a shut door in the way is
// EASED open from a stride back (a locked one PICKED first); the moment he has a line to a living defender inside SNEAK.shootM he stops, puts the reticle on
// the man's chest, lets the aim settle (0.8 s on a man who has not noticed — aim.ts's own full settle — a quarter second on one who has) and fires, one press at a time, until the man drops. He never throws, never kicks, never sprints, never uses the rifle.
// HE KNOWS WHERE EVERY DEFENDER IS (as playthrough.ts's commander does): a player under the fog of war does not.
// WHAT A RUN IS CALLED (in this order):
//   dead     Sam went down
//   loud     something loud happened: an unsuppressed round (level ≥ 1), any defender's round, a stun charge, a boot
//   spotted  nothing loud, but a defender went on ALERT or to SEARCH (his state), or his awareness passed 0.75
//   looked   none of that, but a defender NOTICED: awareness at 0.5 or over (silent.ts's own bar: from there the partner's held fire is let go)
//   turned   none of that, but a defender went SUSPICIOUS under the bar: he turned to a noise (a suppressed round heard leaves him a hair under 0.5, a dropped
//            man's weapon on the floor at 0.45) and walks over to it
//   ghost    every defender down (the scenario's own end) and none of the above: no defender ever left his calm
//   stalled  none of the above and the run did not finish (the script ran out of ways, or the time cap)
// THE FIRST COMPROMISE (`first`): the first of {a defender noticed, something loud}, with what did it: who he had eyes on (Sam / the partner), what he last
// heard and whose noise it was, where the partner stood (how far from Sam, in a doorway, lit, in the defender's line), who fired the first loud round.
// THE HARNESS HAS NO GPU: no bounce light, no smoke, no picture, no sound. Nothing here was seen or heard.
import { mkdirSync, existsSync, readFileSync, appendFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { standUp, ROOT } from './headless.ts';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }; const has = (n: string) => argv.includes(n);
const ARMS = ['solo', 'pair', 'pairloud', 'pairhold', 'pairquiet', 'pairmark'] as const; type Arm = typeof ARMS[number];
/** the scripted player's own numbers (env PS_* over them, for the page's side experiments) */
const SNEAK = { crouchM: Number(process.env.PS_CROUCH ?? 14), shootM: Number(process.env.PS_SHOOT ?? 12), settle: Number(process.env.PS_SETTLE ?? 48), settleHot: Number(process.env.PS_SETTLE_HOT ?? 16), doorBack: 1.0, careWait: Number(process.env.PS_CARE_WAIT ?? 12) };
/** the pairmark commander's clocks (s), his reach (m) and whether a watched hold ends in a second mark */
const MARK = { setWait: Number(process.env.PS_MARK_SET ?? 60), watchWait: Number(process.env.PS_MARK_WATCH ?? 20), goWait: Number(process.env.PS_MARK_GO ?? 8), reachM: Number(process.env.PS_MARK_M ?? 16), anyway: process.env.PS_ANYWAY === '1', seen: Number(process.env.PS_MARK_SEEN ?? 0.7), capK: Number(process.env.PS_MARK_CAPK ?? 3) };
const DT = 1 / 60;
type Vec3 = [number, number, number];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const r2 = (x: number | null | undefined) => x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(2);
const at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
class Done extends Error { constructor(public end: string, public why = '') { super(end); } }

async function one(scn: string, seed: number, arm: Arm, cap: number, verbose: boolean) {
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const { lightEstimateAt, canSeeChar } = await import(`${ROOT}/src/game/guards.ts`);
  const SIL = await import(`${ROOT}/src/game/silent.ts`);
  const { SILENT, SILENT_STATS, setSilent, squadSilent, silentCompromised } = SIL;
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const SP: any = await import(`${ROOT}/src/game/spotted.ts`).catch(() => null);   // (absent on the base build: the books below are the same either way)
  const DG: any = await import(`${ROOT}/src/game/digest.ts`).catch(() => null);
  const PO: any = await import(`${ROOT}/src/game/pairorders.ts`).catch(() => null), SN: any = await import(`${ROOT}/src/game/sneak.ts`).catch(() => null), PU: any = await import(`${ROOT}/src/game/pairup.ts`).catch(() => null);
  /** the game's switches as they read now (the environment set them, or nothing did). `pair`: pairup.ts's umbrella where that file is — else all three on */
  const switches = () => { const orders = !!PO?.PAIR?.on, sneak = !!SN?.SNEAK?.on, spotted = !!SP?.SPOTTED?.on; return { pair: PU?.PAIRUP ? !!PU.PAIRUP.on : orders && sneak && spotted, orders, sneak, spotted, ...(PU?.PAIRUP ? { rules: Object.fromEntries(Object.entries(PU.PAIRUP).filter(([k, v]) => k !== 'on' && typeof v === 'boolean')) } : {}) }; };   // (`rules`: the umbrella's own rows — oneEye, hunted, rejoin, word — as they read)
  if (arm === 'pairmark') cap *= MARK.capK;
  if (arm === 'pairquiet') { const { KIT, SLOTS, kitPresetCard } = await import(`${ROOT}/src/game/kit.ts`); SLOTS.on = false; KIT.members[1] = kitPresetCard(1, 'quiet'); }   // (the kit screen's own Quiet set for the first teammate: nothing a player cannot pick)
  const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) throw new Error(`no scenario '${scn}' — ${SCENARIOS.map((e: any) => e.id).join(', ')}`);
  const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
  const log = console.log, err = console.error, warn = console.warn; const hush = () => { console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };

  Math.random = seeded(0x9137 + seed * 7919);   // (playthrough.ts's own seeding: a seed is the same placement and the same dice there and here)
  hush(); const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }); unhush();
  const g = W.game, I = W.input, cam = W.cam;
  g.godMode = false; g.tune.chaos = 0.5; SILENT.on = true;
  const squadN = arm === 'solo' ? 0 : 1;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`);
  q = q.replace(/&squad4\b/, '') + `&squad=${squadN}`;
  hush(); const { why } = startFromQuery(g, new URLSearchParams(q)); unhush(); if (why) throw new Error(`start refused — ${why}`);
  const pl = g.player;   // (the start stands a fresh Player: taken after it)
  // PS_MOON=1: a stand-in for the moonlight the headless light estimate leaves out (guards.ts lightEstimateAt skips directional lights; the page's meter has
  // them). The goggles' own rule for where it falls (nvg.ts nvgPlaceLight): wherever the sky its way is open. Added to Sam's meter and to every
  // unit's (through the game's lightQuery / lightAt hooks), so a man in a moonlit yard is as visible here as the page's meter would have him. Sight only.
  const MOON = process.env.PS_MOON === '1';
  const moonAt = (P: number[]): number => { let E = 0; for (const l of g.engine.lights.lights) { if (l.kind !== 2 || !l.enabled || l.intensity <= 0 || l.transient || l.ttl >= 0) continue;
    if (!g.col.segmentBlocked(P, [P[0] - l.dir[0] * 60, P[1] - l.dir[1] * 60, P[2] - l.dir[2] * 60])) E += (0.2126 * l.color[0] + 0.7152 * l.color[1] + 0.0722 * l.color[2]) * l.intensity * Math.max(Math.abs(l.dir[0]), Math.abs(l.dir[1]), Math.abs(l.dir[2])); } return E; };   // (× the best of the meter's six normals, as the page's meter reads a directional light)
  const openSky = (p: number[]): boolean => { let clear = 0; for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (!g.col.solidBlocked([p[0] + dx, 1.8, p[2] + dz], [p[0] + dx, 14, p[2] + dz])) clear++; return clear >= 3; };   // (pair-sneak-sky.ts's own test)
  if (MOON) { const Q = new Map<string, number[]>(), q0 = g.lightQuery, a0 = g.lightAt;
    g.lightQuery = (key: string, pos: any, skip?: number) => { if (/^unit[CH]/.test(key)) Q.set(key, [pos[0], pos[1], pos[2]]); q0(key, pos, skip); };
    g.lightAt = (key: string) => { const P = Q.get(key); return P ? lightEstimateAt(g, P as any) + moonAt(P) : a0(key); }; }

  // ───────────────────────────── the run's books
  let t = 0; const trace: string[] = [];
  const WHERE = process.env.PS_WHERE ? process.env.PS_WHERE.split('-').map(Number) : null;
  const say = (s: string) => { const line = `${f1(t).padStart(6)}  ${s}`; trace.push(line); if (verbose) log(line); };
  const hostiles = (): any[] => g.guards.filter((x: any) => x.team === 'hostile');
  const mates = (): any[] => g.orders.squad();
  const srcOf = (id: number | undefined) => id === undefined ? '?' : id === PLAYER_ID || id === pl.char.id ? 'sam' : (() => { const x = g.guards.find((y: any) => y.char.id === id); return x ? (x.team === 'operative' ? 'mate' : x.team === 'hostile' ? 'theirs' : x.team) : id === 0 ? 'world' : `id${id}`; })();
  /** whose noise an event is: its `who`, else (Sam's own footfalls carry none) the nearest living body within a stride of where it was made */
  const fell: { T: number; pos: number[] }[] = [];   // where and when each defender dropped: the clatter there a moment later is HIS WEAPON on the floor (a 'prop' noise with nobody's name on it)
  const srcOfEv = (e: any): string => { const s0 = srcOf(e.who); if (s0 !== '?' && s0 !== 'world') return s0; if (e.kind === 'prop' && fell.some(f => g.time - f.T < 2.5 && flat(e.pos, f.pos) < 2)) return 'drop'; let best = s0, bd = 1.2;
    const dS = flat(e.pos, pl.char.pos); if (dS < bd) { bd = dS; best = 'sam'; }
    for (const x of g.guards) { if (x.state === 'dead') continue; const d = flat(e.pos, x.char.pos); if (d < bd) { bd = d; best = x.team === 'operative' ? 'mate' : x.team === 'hostile' ? 'theirs' : x.team; } } return best; };
  const roused = (h: any) => h.state === 'alert' || h.state === 'search' || h.awareness >= 0.5;
  const eyeOf = (c: any): Vec3 => c.bones?.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]];
  const chestOf = (c: any): Vec3 => c.bones?.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
  /** what `h`'s eyes have of the body `c`, by THE GAME'S OWN TEST (guards.ts canSeeChar → eyeContact: the look between chest and head, 58° either side, 100° inside
   *  3.5 m, 16 m of reach, nothing solid to his chest or to his head). `cone` = his eyes are on him (light aside: whether that becomes a sighting is the meter's
   *  business); `los` = a line to chest or head inside 16 m whichever way he faces */
  const inView = (h: any, c: any) => { const d = flat(h.char.pos, c.pos); if (d > 16 || h.state === 'dead') return { los: false, cone: false, d };
    const e = eyeOf(h.char), los = !g.col.segmentBlocked(e, chestOf(c)) || !g.col.segmentBlocked(e, eyeOf(c)); return { los, cone: los && !!canSeeChar(g, h, c, c === pl.char).visible, d }; };
  const doorNear = (p: number[], m = 1.0): string | null => { const d = g.doors.list.find((x: any) => flat(p, x.frameCentre) < m); return d ? d.def.name : null; };
  const M: any = { suspN: 0, hotN: 0, drops: { n: 0, watched: 0, inLine: 0, unseen: 0, roused: 0, stray: 0, seeds: 0, firstWatched: null }, heardBy: {} as Record<string, number>, hot: { suspicious: 0, search: 0, alert: 0 }, firstHot: null, glSam: 0, glMate: 0, care: { on: false, waits: 0, waitSecs: 0, gaveIn: 0 }, mateFirstShot: null, rousings: [] as any[], first: null, firstLoud: null, firstRoused: null, firstSeen: null, firstHeard: null, loudBy: {} as Record<string, number>, rousedN: 0, sawSam: 0, sawMate: 0,
    hear: [] as any[], samShots: 0, mateShots: 0, theirShots: 0, samKills: 0, mateKills: 0, otherKills: 0, mateDownAt: null as number | null, samDownAt: null as number | null, compromisedAt: null as number | null,
    doors: { eased: 0, picked: 0, refused: 0, pushed: 0 }, stuck: 0, blocks: 0, shotsMasked: 0,
    // sampled at 6 Hz while nothing is compromised: where the partner is against Sam and against the defenders
    pre: { mateN: 0, follower: 0, followerSilent: 0, sneaking: 0, orders: {} as Record<string, number>, n: 0, dSum: 0, dMax: 0, far6: 0, far9: 0, mateLos: 0, mateCone: 0, mateOnlyLos: 0, mateOnlyCone: 0, samLos: 0, samCone: 0, mateDoor: 0, mateLit: 0, mateStill: 0, samCrouch: 0, mateVisSum: 0, samVisSum: 0, mateVisMax: 0, samVisMax: 0, mateAheadOfSam: 0 },
    preSecs: 0, aw: {} as Record<string, number>,
    // each defender's first ALERT: what he was a moment before, whom he had his eyes on — and the first moment an alert man has fresh eyes on one of the pair
    alerts: [] as any[], caught: null as any, mateShotLog: [] as any[], cues: [] as any[], orderLog: [] as any[],
    // the pairmark commander's books (null in every other arm): the counts are pairorders.ts's own (PAIR_STATS, PAIR_LOG), filled in at the end; `tried` / `skipped` / `gaveUp` are the script's
    mark: arm === 'pairmark' ? { given: 0, refused: {} as Record<string, number>, set: 0, marks: 0, taken: 0, blown: 0, calledOff: {} as Record<string, number>, watchedHolds: 0, anyway: 0, samFallback: 0, setSecs: [] as number[], firstBad: null as any, cancelled: 0, tried: 0, skipped: {} as Record<string, number>, gaveUp: {} as Record<string, number>, fallIns: 0, log: [] as string[] } : null };
  let ordWas: string | null = null; const failed = new Set<any>(); const plSeen = new WeakSet<any>(); let orderT = -1; const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
  const badMark = (who: string | null, what: string) => { const K = M.mark; if (K && !K.firstBad) K.firstBad = { t: r2(t), who, what }; };
  const alerted = new WeakSet<any>(); let cueN = 0; const eyesSince = new Map<any, number>();
  const seenEv = new WeakSet<any>(); const prev = new Map<any, { heard: number; seen: number; roused: boolean; state: string; aw: number; H: number[]; was: Set<string> }>();
  const sawT = (h: any): number => Math.max(h.sightT ?? -100, h.lastSeenT ?? -100);   // (sightT: any sighting that moved his awareness, rate > 0.05; lastSeenT: a real one, rate > 0.25 — or a scripted man's, which stamps only that)
  const earsOf = (h: any): number[] => { const W0 = h.witness.heard; return [W0.shots, W0.kick, W0.bang, W0.small]; }; let lastHeard = new Map<any, any>(); let frames = 0;
  const wasSusp = new WeakSet<any>(), wasHot = new WeakSet<any>();
  const foeOf = (h: any): string | null => h.foe === 'player' ? 'sam' : h.foe?.team === 'operative' ? 'mate' : h.foe ? 'other' : null, spOn = () => !!SP?.SPOTTED.on;
  let mate: any = null;
  const mateInfo = (h: any | null) => { if (!mate || mate.state === 'dead') return null; const c = mate.char, A = g.orders.of(mate), v = h ? inView(h, c) : null;
    return { d: h ? r2(flat(h.char.pos, c.pos)) : null, dSam: r2(flat(c.pos, pl.char.pos)), los: v?.los ?? null, cone: v?.cone ?? null, vis: r2(mate.visibility), lit: !!mate.flashlight?.enabled, door: doorNear(c.pos), order: A ? A.order : mate.script ? 'scripted' : mate.state, arrived: !!A?.arrived, speed: r2(Math.hypot(c.vel[0], c.vel[2])), at: [r2(c.pos[0]), r2(c.pos[2])] }; };
  const samInfo = (h: any | null) => { const c = pl.char, v = h ? inView(h, c) : null; return { d: h ? r2(flat(h.char.pos, c.pos)) : null, los: v?.los ?? null, cone: v?.cone ?? null, vis: r2(pl.visibility), crouch: !!pl.crouch, door: doorNear(c.pos), speed: r2(Math.hypot(c.vel[0], c.vel[2])), at: [r2(c.pos[0]), r2(c.pos[2])] }; };

  const blockedShot = (a: number[], b: number[]) => (g.col.shotBlocked ?? g.col.segmentBlocked).call(g.col, a, b);
  function after() {
    frames++;
    if (WHERE && t >= WHERE[0] && t <= WHERE[1] && frames % 6 === 0) { const hs = hostiles().filter((h: any) => h.state !== 'dead');   // (PS_WHERE=a-b: where everybody stands, ten times a second)
      say(`   @ Sam ${at(pl.char.pos)} ${pl.crouch ? 'low' : 'up'} v ${f1(Math.hypot(pl.char.vel[0], pl.char.vel[2]))} vis ${r2(pl.visibility)}${mate && mate.state !== 'dead' ? ` · ${mate.callsign} ${at(mate.char.pos)} ${mate.char.anim?.crouchTarget ? 'low' : 'up'} v ${f1(Math.hypot(mate.char.vel[0], mate.char.vel[2]))} vis ${r2(mate.visibility)} ${g.orders.of(mate)?.order ?? '—'} sneak ${SN?.sneakWord?.(g, mate) ?? '—'} spotted ${SP?.spottedMode?.(g, mate) ?? '—'} door ${doorNear(mate.char.pos) ?? '—'}` : ''} · ${hs.map((h: any) => `${h.callsign} ${at(h.char.pos)} ${h.state} aw ${r2(h.awareness)}${mate && mate.state !== 'dead' ? ` mate ${f1(flat(h.char.pos, mate.char.pos))} m${inView(h, mate.char).los ? ' LOS' : ''}${inView(h, mate.char).cone ? ' CONE' : ''}` : ''} sam ${f1(flat(h.char.pos, pl.char.pos))} m${inView(h, pl.char).los ? ' LOS' : ''}${inView(h, pl.char).cone ? ' CONE' : ''}`).join(' | ')}`); }
    const H = hostiles();
    // this frame's events: what was loud, who made it — and the quiet ones kept a moment for 'what did he hear'
    for (const e of g.events) { if (seenEv.has(e)) continue; seenEv.add(e); const src = srcOfEv(e);
      if (process.env.PS_EV && e.kind === process.env.PS_EV) say(`   EV ${e.kind} who ${e.who} level ${e.level} at (${f1(e.pos[0])}, ${f1(e.pos[2])}) · Sam (${f1(pl.char.pos[0])}, ${f1(pl.char.pos[2])}) v ${f1(Math.hypot(pl.char.vel[0], pl.char.vel[2]))} · mate ${mate ? `(${f1(mate.char.pos[0])}, ${f1(mate.char.pos[2])}) id ${mate.char.id}` : '—'} · PLAYER_ID ${PLAYER_ID}`);
      const loud = (e.kind === 'shot' && (e.level ?? 0) >= 1) || e.kind === 'guardShot' || e.kind === 'bang' || e.kind === 'kick';
      if (e.kind === 'shot' || e.kind === 'guardShot') { if (src === 'sam') M.samShots++; else if (src === 'mate') { M.mateShots++; if (M.mateShotLog.length < 12) { const tg = g.fight?.opOf?.(mate)?.tgt; M.mateShotLog.push({ t: r2(t), at: tg?.callsign ?? null, st: tg?.state ?? null, aw: r2(tg?.awareness), level: r2(e.level ?? null) }); } if (M.mateFirstShot === null) { const tg = mate?.foe && mate.foe !== 'player' ? mate.foe : g.fight?.opOf?.(mate)?.tgt; const pt = tg ? prev.get(tg) : null; M.mateFirstShot = { t: r2(t), level: r2(e.level ?? null), dSam: mate ? r2(flat(mate.char.pos, pl.char.pos)) : null, silent: squadSilent(g), compromised: silentCompromised(g), at: tg?.callsign ?? null, tgtState: pt?.state ?? tg?.state ?? null, tgtAw: r2(pt?.aw ?? tg?.awareness), tgtRoused: pt ? pt.roused : null, tgtWas: pt?.state ?? null, tgtSawAgo: tg && tg.lastSeenT >= 0 ? r2(g.time - tg.lastSeenT) : null, tgtFoe: tg ? foeOf(tg) : null, caughtBefore: !!M.caught, mode: spOn() ? SP.spottedMode(g, mate) : null }; /* his man as he was the frame BEFORE the round: after it he is mostly dead */ say(`   · ${mate?.callsign} FIRES (level ${e.level}) at ${tg?.callsign ?? '?'} (${tg?.state ?? '?'})`); } } else if (src === 'theirs') M.theirShots++; }
      if (loud) { const k = `${src}:${e.kind}`; M.loudBy[k] = (M.loudBy[k] ?? 0) + 1;
        if (!M.firstLoud) { M.firstLoud = { t: r2(t), kind: e.kind, src, level: r2(e.level ?? null), at: [r2(e.pos[0]), r2(e.pos[2])], mate: mateInfo(null), samAt: [r2(pl.char.pos[0]), r2(pl.char.pos[2])] }; say(`   !! LOUD · ${e.kind} by ${src}`); } } }
    for (const h of H) { let p = prev.get(h); if (!p) { prev.set(h, p = { heard: h.witness.heard.lastT, seen: sawT(h), roused: false, state: h.state, aw: h.awareness, H: earsOf(h), was: new Set([h.state]) }); continue; }
      const dead = h.state === 'dead';
      if (h.state === 'suspicious' && !wasSusp.has(h)) { wasSusp.add(h); M.suspN++; } if ((h.state === 'alert' || h.state === 'search') && !wasHot.has(h)) { wasHot.add(h); M.hotN++; }
      if (dead && p.state !== 'dead') { fell.push({ T: g.time, pos: [...h.char.pos] }); const hands = !!PO && PO.PAIR_LOG.some((L: any) => g.time - L.t < 0.05 && L.what.startsWith(`down:${h.callsign || 'that man'} by `)), by = h.killerId === PLAYER_ID || h.downBy === 'player' ? 'sam' : hands ? 'mate' : srcOf(h.killerId);   // (pairorders.ts's quiet hands carry no killer id: its own log names them)
        if (by === 'sam' && failed.has(h) && M.mark) M.mark.samFallback++;
        if (by === 'sam') { M.samKills++; const w = lastWatch.get(h), D = M.drops; D.n++; if (!w || g.time - w.T > 1.5) D.stray++; else if (w.roused) D.roused++; else { if (w.n) D.watched++; else if (w.lines) D.inLine++; else D.unseen++; if (w.n && D.seeds < 1) { D.seeds++; D.firstWatched = { t: r2(t), who: h.callsign, by: w.n, vis: w.vis }; } } /* stray: no press at HIM in the last second and a half — a round meant for another man; roused: he had noticed; the other three are men who had not */ } else if (by === 'mate') M.mateKills++; else M.otherKills++; say(`   + ${h.callsign} down ${at(h.char.pos)} · by ${by}${p.roused ? '' : ' · he had not noticed'}`); }
      if (h.state === 'alert' && !alerted.has(h)) { alerted.add(h); const foe = h.foe === 'player' ? 'sam' : h.foe?.team === 'operative' ? 'mate' : h.foe ? 'other' : null, sawAgo = sawT(h) >= 0 ? g.time - sawT(h) : null;
        const rec = { t: r2(t), who: h.callsign, from: p.state, foe, sawAgo: r2(sawAgo), sawHardAgo: h.lastSeenT >= 0 ? r2(g.time - h.lastSeenT) : null, by: h.witness.alertedBy ?? null, md: mate && mate.state !== 'dead' ? r2(flat(h.char.pos, mate.char.pos)) : null, mv: mate ? r2(mate.visibility) : null, mc: mate ? !!mate.char.anim?.crouchTarget : null, ms: mate ? r2(Math.hypot(mate.char.vel[0], mate.char.vel[2])) : null, sd: r2(flat(h.char.pos, pl.char.pos)), loudBefore: !!M.firstLoud, mateShotBefore: M.mateShots > 0 };
        if (M.alerts.length < 16) M.alerts.push(rec); say(`   !! ALERT · ${h.callsign} (was ${p.state}) · eyes on ${foe ?? 'nobody'}${sawAgo !== null ? ` (${f1(sawAgo)} s ago)` : ''} · by ${rec.by}`); }
      if (!M.caught && h.state === 'alert' && h.lastSeenT >= 0 && g.time - h.lastSeenT < 0.25 && (h.foe === 'player' || h.foe?.team === 'operative')) { M.caught = { t: r2(t), who: h.callsign, foe: h.foe === 'player' ? 'sam' : 'mate', loudBefore: !!M.firstLoud, mateShotBefore: M.mateShots > 0 }; say(`   !! CAUGHT · ${h.callsign} alert with eyes on ${M.caught.foe}`); }
      if (!dead && h.state !== p.state && !p.was.has(h.state)) { p.was.add(h.state); if (h.state in M.hot) { M.hot[h.state]++; if ((h.state === 'alert' || h.state === 'search') && !M.firstHot) M.firstHot = { t: r2(t), who: h.callsign, state: h.state, by: h.witness.alertedBy ?? null, aw: r2(h.awareness), loudBefore: !!M.firstLoud }; } }
      p.state = h.state; if (dead) continue;
      p.aw = h.awareness; M.aw[h.callsign] = Math.max(M.aw[h.callsign] ?? 0, +h.awareness.toFixed(2));
      const Wt = h.witness.heard;
      if (Wt.lastT > p.heard + 1e-9) { p.heard = Wt.lastT;
        // whose noise: of the last tenth of a second's events, one he could have booked — never his own side's unless it is gunfire, a charge or a boot (guards.ts
        // hearingCheck: a colleague's steps and doors are nothing to him) — of the class his own ears' counters say moved (shots / kick / bang / small); a round
        // before the thing it knocked over (one cause: the round), then the nearest to him
        const H1 = earsOf(h), moved = ['shots', 'kick', 'bang', 'small'].filter((_, i) => H1[i] > p.H[i]); p.H = H1;
        const clsOf = (e: any) => (e.kind === 'shot' && (e.level ?? 0) >= 1) || e.kind === 'guardShot' ? 'shots' : e.kind === 'kick' ? 'kick' : e.kind === 'bang' ? 'bang' : 'small';
        const evs: any[] = []; for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (g.time - e.time > 0.12) break; if (e.kind !== 'lightOut') evs.push(e); }
        const cands = evs.filter(e => !(srcOfEv(e) === 'theirs' && clsOf(e) === 'small')), inCls = cands.filter(e => moved.includes(clsOf(e))), pool = inCls.length ? inCls : cands.length ? cands : evs, rank = (e: any) => (e.kind === 'shot' || e.kind === 'guardShot' ? 0 : 100) + flat(e.pos, h.char.pos);
        const best: any = pool.sort((a, b) => rank(a) - rank(b))[0] ?? null;
        const rec = { t: r2(t), who: h.callsign, kind: best?.kind ?? '?', src: best ? srcOfEv(best) : '?', level: r2(best?.level ?? null), d: best ? r2(flat(best.pos, h.char.pos)) : null, aw: r2(h.awareness), state: h.state, moved: moved.join('+'), also: [...new Set(pool.filter(e => e !== best).map(e => `${srcOfEv(e)}:${e.kind}`))].slice(0, 3) };
        lastHeard.set(h, { ...rec, T: g.time }); const hk = `${rec.src}:${rec.kind}`; M.heardBy[hk] = (M.heardBy[hk] ?? 0) + 1; if (M.hear.length < 40) M.hear.push(rec); if (!M.firstHeard) M.firstHeard = rec;
        if (verbose) say(`   · ${h.callsign} hears ${rec.kind} (${rec.src}, level ${rec.level}, ${rec.d} m) · awareness ${rec.aw} ${h.state}`); }
      if (sawT(h) > p.seen + 1e-9) { const first = p.seen < 0 || sawT(h) - p.seen > 2, hard = g.time - (h.lastSeenT ?? -100) < 1e-6; p.seen = sawT(h); const foe = h.foe === 'player' ? 'sam' : h.foe?.team === 'operative' ? 'mate' : h.foe ? 'other' : null;
        if (foe === 'sam' || foe === 'mate') { if (!p.was.has('gl:' + foe)) { p.was.add('gl:' + foe); if (foe === 'sam') M.glSam++; else M.glMate++; } if (hard && !p.was.has('saw:' + foe)) { p.was.add('saw:' + foe); if (foe === 'sam') M.sawSam++; else M.sawMate++; } }   // (defenders who EVER had a sighting of him that moved their awareness / a real one)
        if (first) {
          const rec = { t: r2(t), who: h.callsign, foe, hard, aw: r2(h.awareness), state: h.state, sam: samInfo(h), mate: mateInfo(h) }; if (!M.firstSeen) M.firstSeen = rec;
          say(`   · ${h.callsign} has eyes on ${foe}${hard ? '' : ' (a glimpse)'} · awareness ${rec.aw} ${h.state}`); } }
      if (!p.roused && roused(h)) { p.roused = true; M.rousedN++;
        const foe = h.foe === 'player' ? 'sam' : h.foe?.team === 'operative' ? 'mate' : h.foe ? 'other' : null, lh = lastHeard.get(h), sawAgo = sawT(h) >= 0 ? g.time - sawT(h) : null, sawHardAgo = (h.lastSeenT ?? -1) >= 0 ? g.time - h.lastSeenT : null;   // (sawAgo: since ANY sighting that moved his awareness; sawHardAgo: since a real one)
        const notes = (g.fight?.log ?? []).filter((n: any) => g.time - n.t < 1.0 && (n.who === h.callsign || n.who === '-')).slice(-3).map((n: any) => n.what);
        const rec = { t: r2(t), who: h.callsign, state: h.state, aw: r2(h.awareness), by: h.witness.alertedBy ?? null, notes, foe, sawAgo: r2(sawAgo), sawHardAgo: r2(sawHardAgo), heard: lh ? { kind: lh.kind, src: lh.src, level: lh.level, d: lh.d, ago: r2(g.time - lh.T) } : null, sam: samInfo(h), mate: mateInfo(h), silent: squadSilent(g) };
        if (!M.firstRoused) M.firstRoused = rec;
        if (M.rousings.length < 14) M.rousings.push({ t: rec.t, who: rec.who, by: rec.by, foe, sawAgo: rec.sawAgo, hk: lh?.kind ?? null, hs: lh?.src ?? null, ha: lh ? r2(g.time - lh.T) : null, note: notes[notes.length - 1] ?? null, sd: rec.sam.d, sl: rec.sam.cone, sv: rec.sam.vis, md: rec.mate?.d ?? null, ml: rec.mate?.cone ?? null, mv: rec.mate?.vis ?? null, mdoor: rec.mate?.door ?? null, mdS: rec.mate?.dSam ?? null, loudBefore: !!M.firstLoud });
        say(`   !! NOTICED · ${h.callsign} ${h.state} aw ${rec.aw} · by ${rec.by} · eyes on ${foe ?? 'nobody'}${sawAgo !== null ? ` (${f1(sawAgo)} s ago)` : ''} · last heard ${lh ? `${lh.kind} by ${lh.src} ${f1(g.time - lh.T)} s ago` : 'nothing'} · Sam ${f1(rec.sam.d!)} m vis ${rec.sam.vis}${rec.mate ? ` · mate ${f1(rec.mate.d!)} m vis ${rec.mate.vis}${rec.mate.door ? ' in ' + rec.mate.door : ''}${rec.mate.lit ? ' LIT' : ''}` : ''}${notes.length ? ` · notes: ${notes.join(' | ')}` : ''}`); } }
    if (mate && mate.state !== 'dead') { const A = g.orders.of(mate), o = A ? A.order + (A.post === null ? '' : '@post') : g.orders.owners?.some((x: any) => x.owns(mate)) ? 'owned' : mate.script ? 'scripted' : 'none'; if (o !== ordWas) { if (M.orderLog.length < 40) M.orderLog.push({ t: r2(t), order: o, was: ordWas, calm: !M.first }); say(`   ~ ${mate.callsign}: order ${ordWas ?? '—'} → ${o}${A && A.order !== 'fallIn' ? ` (${A.there})` : ''}`); ordWas = o; } }   // (who he answers to, as it changes: the scenario and the fight give and take orders too)
    if (PO) { const L0 = PO.PAIR_LOG as any[], fresh: any[] = []; for (let i = L0.length - 1; i >= 0 && !plSeen.has(L0[i]); i--) { plSeen.add(L0[i]); fresh.unshift(L0[i]); }
      for (const L of fresh) { const w: string = L.what, K = M.mark; say(`   ~ orders: ${w}`); if (!K) continue; if (K.log.length < 60) K.log.push(`${f1(t)} ${w}`);
        if (w.startsWith('mark:') || w.startsWith('now:')) orderT = L.t; else if (w.startsWith('set:')) { K.set++; if (orderT >= 0) K.setSecs.push(r2(L.t - orderT)); orderT = -1; }
        else if (w.startsWith('off:')) { const why = w.slice(4); bump(K.calledOff, why); if (why !== 'down' && why !== 'held') badMark(mate?.callsign ?? null, w); }
        else if (w.startsWith('blown:')) badMark(mate?.callsign ?? null, w); } }
    if (!M.first) { const c = [M.firstRoused && { how: 'noticed', ...M.firstRoused }, M.firstLoud && { how: 'loud', ...M.firstLoud }].filter(Boolean) as any[]; if (c.length) M.first = c.sort((a, b) => a.t - b.t || (a.how === 'loud' ? -1 : 1))[0]; }   // (a loud noise and the man it roused on one frame: the noise is the cause)
    if (SP && SP.SPOTTED_LOG.length > cueN) { for (const L of SP.SPOTTED_LOG.slice(cueN)) { if (M.cues.length < 24) M.cues.push({ t: r2(t), who: L.who, to: L.to, of: L.of }); say(`   ~ ${L.who}: ${L.to}${L.of ? ' (' + L.of + ')' : ''}`); } cueN = SP.SPOTTED_LOG.length; }
    if (mate && mate.state === 'dead' && M.mateDownAt === null) { M.mateDownAt = r2(t); const k = g.guards.find((y: any) => y.char.id === mate.killerId), S = spOn() ? SP.spottedOf?.(mate) : null;   // (spotted.ts's record of a dead man stands as it was on his last frame up)
      M.mateDeath = { t: r2(t), by: k?.callsign ?? null, d: k ? r2(flat(k.char.pos, mate.char.pos)) : null, dSam: r2(flat(mate.char.pos, pl.char.pos)), samDown: !!pl.down, shots: M.mateShots, mode: S?.mode ?? null, what: S?.what ?? null, exposed: S ? !!S.exposed : null };
      say(`   ✗ ${mate.callsign} down · by ${srcOf(mate.killerId)}${S ? ` · he was ${S.mode}${S.what ? ' (' + S.what + ')' : ''}` : ''}`); }
    if (pl.down && M.samDownAt === null) { M.samDownAt = r2(t); say('   ✗ Sam down');
      // who shot him (the chronicle's own record), how long that man had had eyes on the pair, and where the partner was in it (spotted.ts's question: was he covering?)
      const by = g.chronicle?.counts?.downBy || null, k: any = by ? g.guards.find((y: any) => y.callsign === by) ?? null : null;
      const mUp = !!mate && mate.state !== 'dead', mc = mUp ? mate.char : null, kc = k?.char ?? null, O = mUp ? g.fight?.opOf?.(mate) : null;
      M.samDeath = { t: r2(t), by, kState: k?.state ?? null, kOn: k ? foeOf(k) : null, eyesFor: k && eyesSince.has(k) ? r2(g.time - eyesSince.get(k)!) : null, d: kc ? r2(flat(kc.pos, pl.char.pos)) : null, alertN: H.filter((h: any) => h.state === 'alert').length, loudBefore: !!M.firstLoud && M.firstLoud.t < (r2(t) as number) - 0.05,
        mate: mUp ? { dSam: r2(flat(mc.pos, pl.char.pos)), dK: kc ? r2(flat(mc.pos, kc.pos)) : null, line: kc ? !blockedShot([mc.pos[0], 1.4, mc.pos[2]], [kc.pos[0], 1.2, kc.pos[2]]) : null, masked: kc ? g.fight?.friendInLine?.([mc.pos[0], 1.4, mc.pos[2]], [kc.pos[0], 1.2, kc.pos[2]], mate) === 'player' : null, yawOff: kc ? r2(Math.abs(wrap(Math.atan2(kc.pos[0] - mc.pos[0], kc.pos[2] - mc.pos[2]) - mc.aimYaw))) : null, tgt: O?.tgt?.callsign ?? null, mode: spOn() ? SP.spottedMode(g, mate) : null, shots: M.mateShots, order: g.orders.of(mate)?.order ?? null } : null };
      const D = M.samDeath; say(`   (Sam's killer: ${by ?? '?'} from ${D.d} m, eyes on the pair ${D.eyesFor} s · ${!mate ? 'no partner' : mUp ? `partner ${D.mate.dSam} m from Sam, ${D.mate.dK} m from the man, line ${D.mate.line}${D.mate.masked ? ' (through Sam)' : ''}, gun ${D.mate.yawOff} rad off him, on ${D.mate.tgt}${D.mate.mode ? ', ' + D.mate.mode : ''}` : 'partner down'})`); }
    for (const h of H) { if (h.state === 'dead') { eyesSince.delete(h); continue; } const on = !!foeOf(h) && h.lastSeenT >= 0 && g.time - h.lastSeenT < 0.6; if (on) { if (!eyesSince.has(h)) eyesSince.set(h, g.time); } else eyesSince.delete(h); }
    if (M.compromisedAt === null && silentCompromised(g)) M.compromisedAt = r2(t);
    if (!M.first && frames % 10 === 0) { const P = M.pre; P.n++; M.preSecs = r2(t);
      const alive = H.filter((h: any) => h.state !== 'dead'); let sL = false, sC = false, mL = false, mC = false;
      for (const h of alive) { const v = inView(h, pl.char); sL ||= v.los; sC ||= v.cone; if (mate && mate.state !== 'dead') { const u = inView(h, mate.char); mL ||= u.los; mC ||= u.cone; } }
      if (sL) P.samLos++; if (sC) P.samCone++; if (pl.crouch) P.samCrouch++; if (openSky(pl.char.pos)) P.samSky = (P.samSky ?? 0) + 1; P.samVisSum += pl.visibility; P.samVisMax = Math.max(P.samVisMax, pl.visibility);
      if (mate && mate.state !== 'dead') { const A = g.orders.of(mate), fol = !!A && A.order === 'fallIn' && A.post === null; P.mateN++;   // (a FOLLOWER: orders.ts's own test — the one sneak.ts acts on)
        if (fol) P.follower++; if (fol && squadSilent(g) && !silentCompromised(g)) P.followerSilent++; if (SN?.sneaking?.(g, mate)) P.sneaking++; bump(P.orders, A ? A.order + (A.post === null ? '' : '@post') : mate.script ? 'scripted' : 'none'); }
      if (mate && mate.state !== 'dead') { const d = flat(mate.char.pos, pl.char.pos); P.dSum += d; P.dMax = Math.max(P.dMax, d); if (d > 6) P.far6++; if (d > 9) P.far9++;
        if (mL) P.mateLos++; if (mC) P.mateCone++; if (mL && !sL) P.mateOnlyLos++; if (mC && !sC) P.mateOnlyCone++; if (doorNear(mate.char.pos, 0.45)) P.mateDoor++; if (mate.flashlight?.enabled) P.mateLit++;
        if (Math.hypot(mate.char.vel[0], mate.char.vel[2]) < 0.1) P.mateStill++; P.mateVisSum += mate.visibility; P.mateVisMax = Math.max(P.mateVisMax, mate.visibility);
        // ahead of Sam: nearer (by the straight line) than Sam to the nearest living defender
        const near = alive.sort((a: any, b: any) => flat(a.char.pos, pl.char.pos) - flat(b.char.pos, pl.char.pos))[0]; if (near && flat(near.char.pos, mate.char.pos) + 0.5 < flat(near.char.pos, pl.char.pos)) P.mateAheadOfSam++; } }
  }

  // ───────────────────────────── Sam's hands and feet (fourways-probes.ts's scripted player, on any level)
  let goal: number[] | null = null, allDownAt = -1, forceLow = false;
  const pos = (): number[] => pl.char.pos;
  const ended = (): Done | null => {
    if (pl.down) return new Done('wiped', 'Sam down');
    if (E.kind === 'rescue') { const r = g.rescue.result; if (r) return new Done(r.state, `${r.grade} · ${r.why}`); }
    if (E.kind === 'roomclear') { const e = g.roomClear.end; if (e) return new Done(e, g.roomClear.endWhy ?? ''); }
    if (hostiles().every((h: any) => h.state === 'dead')) { if (allDownAt < 0) allDownAt = t; if (t - allDownAt > 1.5) return new Done('taken', 'their men are down'); }   // (a beat past the last man: what his fall still sets off is in the books)
    return null; };
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      if (goal && !pl.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
        if (d > 0.12) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      // crouched whenever a living defender is near (C is a press, never held)
      { const near = hostiles().some((h: any) => h.state !== 'dead' && flat(h.char.pos, pos()) < SNEAK.crouchM) || forceLow; if (!!pl.crouch !== near && !pl.takedown && !pl.down) I.pressed.add('KeyC'); }
      // Sam's light meter: the CPU estimate of the direct light on him (his own lights skipped), through the game's own mapping
      { const c = pl.char, own = (o: number) => o === PLAYER_ID; const pc = chestOf(c), ph = eyeOf(c); pl.visibility = g.visibilityOf(Math.max(lightEstimateAt(g, pc, own) + (MOON ? moonAt(pc) : 0), lightEstimateAt(g, ph, own) + (MOON ? moonAt(ph) : 0))); }
      SILENT.on = true;
      W.step(DT); t += DT; after();
      const e = ended(); if (e) throw e;
      if (t >= cap) throw new Done('stalled', 'time cap');
    }
  }
  const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
  const press = (code: string) => { I.pressed.add(code); };
  const cursor = (p: number[]) => W.cursorAt([p[0], p[1], p[2]]);
  const free = (p: number[]): Vec3 => { const nav = g.col.nav; const q2 = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q2 ? [q2[0], 0, q2[2]] : [p[0], 0, p[2]]; };
  /** every living defender inside SNEAK.shootM he has a CLEAN LANE to from where he stands (three lines at the gun's height, the bore's and a hand's width either
   *  side, clear of statics, leaves and furniture: he does not fire past the edge of a leaf still swinging), nearest first. A PANE is not a lane, whatever a
   *  round would do to it: the solid walk is asked, not the line of fire — where rounds go through glass (glasspen.ts, the page's stand) the line of fire calls a
   *  window open, and a sneaking man does not put a round through a window the whole floor hears go */
  const sees = (): any[] => { const y = pl.crouch ? 0.95 : 1.4, p = pos(), blocked = (g.col.solidBlocked ?? g.col.segmentBlocked).bind(g.col);
    return hostiles().filter((x: any) => { const c = chestOf(x.char), dx = c[0] - p[0], dz = c[2] - p[2], L = Math.hypot(dx, dz); if (x.state === 'dead' || L >= SNEAK.shootM || L < 1e-3) return false;
      for (const k of [0, -0.18, 0.18]) { const a = [p[0] + dz / L * k, y, p[2] - dx / L * k], e = [c[0] + dz / L * k * 0.5, c[1], c[2] - dx / L * k * 0.5]; if (blocked(a, e) || g.col.segmentBlockedDynamic?.(a, e)) return false; } return true; })
      .sort((a: any, b: any) => flat(a.char.pos, p) - flat(b.char.pos, p)); };
  /** the men he will shoot from here: in view, and not one he has just emptied presses at from this very spot without a hit (something he cannot see is in the way) */
  const bad = new Map<any, number[]>();
  const lastWatch = new Map<any, { n: number; lines: number; roused: boolean; vis: number; T: number }>();
  /** the living mates of a defender who are FACING him with a line, inside 16 m (inView's own test: the eye's cone, or within arm's reach): who would see him drop */
  const watchers = (h: any): any[] => hostiles().filter((x: any) => x !== h && x.state !== 'dead' && inView(x, h.char).cone);
  // PS_CAREFUL=1: he drops only a man no mate of his is watching; a watched man he WAITS on, where he stands, up to SNEAK.careWait seconds a man (the watcher turns,
  // walks on) and only then shoots anyway (counted: m.care.gaveIn). The plain script shoots whoever it has a lane to.
  const CAREFUL = process.env.PS_CAREFUL === '1', gaveIn = new Set<any>(), waited = new Map<any, number>();
  const targets = (): any[] => sees().filter((h: any) => (!bad.has(h) || flat(pos(), bad.get(h)!) > 1.2) && (!CAREFUL || gaveIn.has(h) || roused(h) || !watchers(h).length));
  /** (careful) the men in his lane he is waiting on: watched by a mate, not yet given in on */
  const waitingOn = (): any[] => !CAREFUL ? [] : sees().filter((h: any) => (!bad.has(h) || flat(pos(), bad.get(h)!) > 1.2) && !gaveIn.has(h) && !roused(h) && watchers(h).length > 0);
  const pathTo = (p: number[], dear: Set<number> | null = null): number[][] | null => { const nav = g.col.nav; return nav.findPath(pos(), p, 6000, dear ? (ix: number, iz: number) => dear.has(nav.idx(ix, iz)) ? 40 : 1 : undefined); };
  const pathLen = (path: number[][] | null, p: number[]): number => { if (!path) return Infinity; let L = 0, q2 = pos(); for (const w of path) { L += flat(q2, w); q2 = w; } return L + flat(q2, p); };
  /** the first SHUT door the walk goes THROUGH (a leg of the path crosses the leaf's own line, jamb to jamb), in walking order */
  const doorOnPath = (path: number[][]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
      for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
        const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
        const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
      if (best) return best; a = b; } return null; };
  const doorCellsOf = (d: any): Set<number> => { const nav = g.col.nav, out = new Set<number>(), H = d.def.hinge, th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th);
    for (let s = 0; s <= d.def.width + 1e-6; s += 0.2) for (const n of [-0.3, 0, 0.3]) out.add(nav.idx(Math.floor((H[0] + ux * s - uz * n) / nav.cell), Math.floor((H[1] + uz * s + ux * n) / nav.cell))); return out; };
  /** walk along the nav path toward `p`: true = there. False the moment `stop()` says so, `max` seconds are up, or he is wedged for good (`wedged` set) */
  let wedged = false;
  function go(p: number[], max: number, stop: (() => boolean) | null, dear: Set<number> | null = null, again = 0, rep = 0): boolean {
    if (!again && !rep) wedged = false;
    const path: number[][] = pathTo(p, dear) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    const t0 = t; let mark = [...pos()], markT = t, k = 0;
    for (const wp of path) {
      goal = [wp[0], 0, wp[2]];
      while (flat(pos(), wp) > (wp === path[path.length - 1] ? 0.3 : 0.55)) {
        cursor([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max || (stop && stop())) { goal = null; return false; }
        if (++k % 30 === 0 && rep < 4 && flat(pos(), mark) > 0.1 && g.col.solidBlocked([pos()[0], 0.5, pos()[2]], [wp[0], 0.5, wp[2]])) return go(p, max - (t - t0), stop, dear, again, rep + 1);
        if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.2) {
          if (mate && mate.state !== 'dead' && flat(mate.char.pos, pos()) < 0.9) { M.blocks++; say(`   !! block · Sam stopped with ${mate.callsign} ${f1(flat(mate.char.pos, pos()) * 100)} cm off ${at(pos())}`); }
          if (g.doors.list.some((d: any) => d.isClosed() && flat(pos(), d.frameCentre) < 1.5)) { wedged = true; goal = null; return false; }
          if (again >= 4) { M.stuck++; wedged = true; say(`(Sam is stuck at ${at(pos())} short of ${at(wp)})`); goal = null; return false; }
          if (process.env.PS_DEBUG) { log(`DBG stuck again=${again} at ${pos().map((x: number) => x.toFixed(2))} wp ${wp.map((x: number) => x.toFixed(2))} vel ${pl.char.vel.map((x: number) => x.toFixed(2))} crouch ${pl.crouch} sel ${pl.sel?.open} doors ${g.doors.list.filter((d: any) => flat(pos(), d.frameCentre) < 3).map((d: any) => `${d.def.name}@${d.angle.toFixed(2)}`)} props ${(g.props?.list ?? g.props ?? []).filter?.((q: any) => flat(q.pos ?? q.box?.center ?? [0, 0, 0], pos()) < 1.5).map((q: any) => `${q.def?.name ?? q.name ?? 'prop'}@${(q.pos ?? q.box?.center).map((x: number) => x.toFixed(2))}`)} path ${path.map((w: number[]) => `${w[0].toFixed(1)},${w[2].toFixed(1)}`).join(' ')}`); }
          // an OPEN leaf across his way (the nav grid knows nothing of leaves): round its tip on his own side of the frame
          const leaf = g.doors.list.find((d: any) => !d.isClosed() && flat(pos(), d.frameCentre) < 1.9);
          const side = (q2: number[]) => { const t1 = t; goal = [q2[0], 0, q2[2]]; while (flat(pos(), q2) > 0.25 && t - t1 < 2.6) { step(); if (stop && stop()) { goal = null; return false; } } return true; };
          if (leaf && again % 2 === 0) { const H = leaf.def.hinge, th = leaf.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), nx = -uz, nz = ux, sd = (pos()[0] - H[0]) * nx + (pos()[2] - H[1]) * nz >= 0 ? 1 : -1, r = leaf.def.width + 0.55;
            if (!side(free([H[0] + ux * 0.35 + nx * sd * r, 0, H[1] + uz * 0.35 + nz * sd * r]))) return false;
            side(free([H[0] - ux * 0.5 + nx * sd * r, 0, H[1] - uz * 0.5 + nz * sd * r])); }
          else { const dx = wp[0] - pos()[0], dz = wp[2] - pos()[2], L = Math.hypot(dx, dz) || 1, sd = again % 4 < 2 ? 1 : -1, r = 0.9 + 0.3 * again;
            if (!side([pos()[0] + dz / L * sd * r, 0, pos()[2] - dx / L * sd * r])) return false; }
          return go(p, max - (t - t0), stop, dear, again + 1, rep);
        }
      }
    }
    goal = null; return true;
  }
  /** a door's row by its verb, tapped: the cursor on the door, the highlight on the row, one press of Space */
  function doorVerb(d: any, verb: string): boolean {
    for (let i = 0; i < 30; i++) { cursor([d.frameCentre[0], 1.0, d.frameCentre[2]]); step();
      if (g.nearby.some((r: any) => r.kind === 'door' && r.door === d && r.verb === verb) && g.selectVerb('door', verb)) { press('Space'); step(2); say(`door ${d.def.name}: ${verb}`); return true; } }
    say(`door ${d.def.name}: no '${verb}' row (rows: ${g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`); return false;
  }
  /** a shut door on the way to `p` (asked a few times a second, not every frame: it is a path search) */
  let aheadT = -1, aheadV: any = null, aheadP: number[] | null = null;
  const doorAhead = (p: number[], dear: Set<number> | null): any | null => { if (aheadP !== p || t - aheadT > 0.25) { aheadP = p; aheadT = t; aheadV = doorOnPath(pathTo(p, dear) ?? []); } return aheadV; };
  const shut = new Map<any, number>();
  /** open a shut door in his way the quiet way: a stride back on his own side, pick it if it is locked against him, ease it. False: no quiet way through it */
  function openDoor(d: any, dear: Set<number> | null, avoid: Set<any>): boolean {
    const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
    const back = free([c[0] + nx * s * SNEAK.doorBack, 0, c[2] + nz * s * SNEAK.doorBack]);
    const there = go(back, 30, () => targets().length > 0 || waitingOn().length > 0 || (doorAhead(back, dear) ?? d) !== d, dear); if (targets().length || waitingOn().length) return true;
    if (!there && flat(pos(), c) > 1.6) { const o = doorAhead(back, dear); if (o && o !== d && !avoid.has(o)) return openDoor(o, dear, avoid) || (avoid.add(o), true); say(`door ${d.def.name}: Sam cannot get to it`); return false; }   // (another shut door first: the loop takes that one; no way to stand at it: not this door)   // (a man in view on the way: his first)
    if (!d.isClosed()) return true;
    if (g.doors.lockedOut(d, pos(), pl.keys)) {
      if (d.def.steel || String(d.lockId).startsWith('wedge:') || !doorVerb(d, 'pick')) { M.doors.refused++; (M.doors.noPick ??= []).push({ t: r2(t), door: d.def.name, why: d.def.steel ? 'steel' : String(d.lockId).startsWith('wedge:') ? 'wedged' : 'no row', afterFirst: !!M.first }); say(`door ${d.def.name}: locked, and no pick opens it (${d.def.steel ? 'steel' : String(d.lockId)})`); return false; }
      if (!until(() => !g.doors.lockedOut(d, pos(), pl.keys) || !d.isClosed(), 9)) { M.doors.refused++; say(`door ${d.def.name}: the pick did not finish`); return false; }
      M.doors.picked++; step(10); if (!d.isClosed()) return true; }
    if (doorVerb(d, 'ease')) { M.doors.eased++; until(() => Math.abs(d.angle) > 0.9 || targets().length > 0, 4);
      if (d.isClosed() && !targets().length) { const n = (shut.get(d) ?? 0) + 1; shut.set(d, n); if (process.env.PS_DEBUG) log(`DBG door ${d.def.name} still shut after ease: angle ${d.angle} lock ${d.lockId} locked ${d.locked} broken ${d.lockBroken} lockedOut ${g.doors.lockedOut(d, pos(), pl.keys)} easing ${!!pl.easing} sam ${pos().map((x: number) => x.toFixed(2))} frame ${d.frameCentre.map((x: number) => x.toFixed(2))} rows ${g.nearby.map((r: any) => r.kind + ':' + r.verb)}`); const body = g.guards.find((x: any) => x.state === 'dead' && flat(x.char.pos, d.frameCentre) < 1.4); if (n === 1 && body) { M.doors.bodyJam = (M.doors.bodyJam ?? 0) + 1; say(`   !! door ${d.def.name}: the ease stops at ${d.angle.toFixed(2)} rad — ${body.callsign}'s body lies ${f1(flat(body.char.pos, d.frameCentre))} m from the frame`); }
        if (doorVerb(d, 'push')) { M.doors.pushed++; until(() => Math.abs(d.angle) > 0.9 || targets().length > 0, 3); }
        if (d.isClosed() && n >= 2) { M.doors.refused++; say(`door ${d.def.name}: eased and pushed twice and it has not given`); return false; } }
      return true; }
    if (doorVerb(d, 'push')) { M.doors.pushed++; until(() => Math.abs(d.angle) > 0.9 || targets().length > 0, 3); return true; }
    M.doors.refused++; return false;
  }
  /** the pistol on a man until he drops: the reticle on his chest, the aim let settle, one press of the trigger at a time. Four presses that leave him standing
   *  = something is in the way from here: the spot is marked and he closes on the man instead. So are three presses running that leave NO ROUND with a loaded gun
   *  in his hand: the game is keeping it down (gunwall.ts: 'no room to bring the gun up' — cover or a jamb inside the raised gun's reach), and it will from here
   *  however long he stands */
  function shoot(h: any, secs = 6): boolean {
    const t0 = t; goal = null; let n = 0, dry = 0;
    while (h.state !== 'dead' && t - t0 < secs) {
      for (let i = 0, N = roused(h) ? SNEAK.settleHot : SNEAK.settle; i < N && h.state !== 'dead'; i++) { cursor(chestOf(h.char)); step(); }
      if (h.state === 'dead') break; if (!sees().includes(h)) break;
      const gun = pl.pistol; if (gun.chamber === 0 && (gun.mag ?? 0) === 0) { if (gun.reloadT < 0) { if (!gun.spare.length && !gun.infinite) throw new Done('stalled', 'Sam is out of rounds'); press('KeyR'); } step(30); continue; }
      if (gun.reloadT >= 0) { step(10); continue; }
      cursor(chestOf(h.char));
      if (mate && mate.state !== 'dead') { const a = pos(), b = h.char.pos, m = mate.char.pos, dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, al = ((m[0] - a[0]) * dx + (m[2] - a[2]) * dz) / L, sd = Math.abs((m[0] - a[0]) * dz - (m[2] - a[2]) * dx) / L; if (al > 0.2 && al < L && sd < 0.35) { M.shotsMasked++; if (M.shotsMasked === 1) say(`   !! ${mate.callsign} is in Sam's line of fire to ${h.callsign} (${f1(al)} m down it)`); } }
      if (CAREFUL && !gaveIn.has(h) && !roused(h) && watchers(h).length) break;   // (a mate of his looked round while the aim settled: back to waiting)
      lastWatch.set(h, { n: watchers(h).length, lines: hostiles().filter((x: any) => x !== h && x.state !== 'dead' && inView(x, h.char).los).length, roused: roused(h), vis: r2(h.visibility ?? 0) as number, T: g.time });
      const fired = gun.shotsFired; I.clicked |= 1; step(); if (gun.shotsFired > fired) { n++; dry = 0; } else { dry++; step(4); }
      if ((n >= 4 || dry >= 3) && h.state !== 'dead') { bad.set(h, [...pos()]); break; } }
    if (verbose && dry >= 3) say(`   (Sam: the gun will not come up on ${h.callsign} from here — he closes on the man instead)`);
    if (verbose) { const e = [...g.events].reverse().find((x: any) => x.kind === 'shot' && srcOf(x.who) === 'sam'); say(`   (Sam: ${n} round${n === 1 ? '' : 's'} at ${h.callsign} from ${f1(flat(pos(), h.char.pos))} m · ${h.state === 'dead' ? 'down' : `still up${e?.to ? ` — the last round ended ${f1(flat(e.to, pos()))} m out at height ${f1(e.to[1])}` : ''}`})`); }
    return h.state === 'dead';
  }

  // ───────────────────────────── the pairmark commander (the orders part, used as its menu would use it)
  const tried = new Set<any>(), cool = new Map<any, number>(), coolN = new Map<any, number>(); let ordT = -1, ordH: any = null, ordV = false;
  /** some living defender is SEEING Sam: a sighting of him that moved that man's awareness inside the last quarter second (guards.ts's own stamp — the light on
   *  Sam is in it: a man facing him across dark floor is not seeing him), or one whose meter on him already stands at 0.2 */
  const eyesOnSam = (): boolean => hostiles().some((x: any) => x.state !== 'dead' && x.foe === 'player' && g.time - sawT(x) < 0.25);
  const anyRoused = (): boolean => hostiles().some((x: any) => x.state !== 'dead' && roused(x));
  const foeT = (h: any) => ({ kind: 'foe', at: [h.char.pos[0], 0, h.char.pos[2]], foe: h });
  /** this man may be given to the partner now: an order target (the fog of war shows him), calm, near, no shut door on the way to him, and Sam outside his eye cone (asked a few times a second) */
  const orderable = (h: any): boolean => { if (arm !== 'pairmark' || !h || tried.has(h) || h.state === 'dead' || !mate || mate.state === 'dead' || (cool.get(h) ?? -1) > t) return false;
    if (ordH === h && t - ordT < 0.25) return ordV; ordH = h; ordT = t; ordV = false;
    if (!g.pair?.up || !g.pair.isFoe(h) || roused(h) || anyRoused() || flat(pos(), h.char.pos) > MARK.reachM || inView(h, pl.char).cone || eyesOnSam()) return false;
    const p = free(h.char.pos), path = pathTo(p); if (!path || pathLen(path, p) > MARK.reachM * 1.5 || doorOnPath(path)) return false;
    return ordV = true; };
  const fallIn = (why: string) => { if (!mate || mate.state === 'dead') return; const w = g.orders.give('fallIn', g.orders.targetAt(pos()), 'all'); if (M.mark) M.mark.fallIns++; say(`order: fall in (${why})${w ? ` — REFUSED: ${w}` : ''}`); };
  function command(h: any): void {
    const K = M.mark, name = h.callsign; tried.add(h); ordH = null;
    const speed = () => Math.hypot(pl.char.vel[0], pl.char.vel[2]);
    /** a frame of standing still and low, the reticle on the floor a pace off to the side of the man (never on him) */
    const hold = () => { goal = null; forceLow = true; const p = pos(), c = h.char.pos, dx = c[0] - p[0], dz = c[2] - p[2], L = Math.hypot(dx, dz) || 1, ca = Math.cos(1.1), sa = Math.sin(1.1); cursor([p[0] + (dx * ca - dz * sa) / L * 2.5, 0.2, p[2] + (dx * sa + dz * ca) / L * 2.5]); step(); };
    const later = (why: string) => { bump(K.skipped, why); const n = (coolN.get(h) ?? 0) + 1; coolN.set(h, n); if (n < 3) { tried.delete(h); cool.set(h, t + 3); } say(`(no order on ${name}: ${why})`); };
    const giveUp = (why: string) => { bump(K.gaveUp, why); badMark(name, `gave up: ${why}`); if (h.state !== 'dead') failed.add(h); say(`(the order on ${name} is off: ${why} — Sam's own gun)`); };
    let given = false;
    try {
      for (let i = 0; i < 90 && (speed() > 0.1 || !pl.crouch); i++) hold();
      if (h.state === 'dead') return;
      if (anyRoused()) { later('roused'); return; }
      if (!g.pair.isFoe(h)) { later('hidden'); return; }
      if (inView(h, pl.char).cone || eyesOnSam()) { later('inView'); return; }
      K.tried++; const whyNot = g.orders.give('pairMark', foeT(h), 'all');
      if (whyNot && /onto us/.test(String(whyNot))) { later('caught'); return; }   // (the pair is caught this moment: asked again when it has settled)
      if (whyNot) { bump(K.refused, whyNot); badMark(name, `refused: ${whyNot}`); failed.add(h); say(`order: take ${name} · on your mark — REFUSED: ${whyNot}`); return; }
      given = true; say(`order: take ${name} · on your mark (${f1(flat(pos(), h.char.pos))} m off; ${mate.callsign} ${f1(flat(mate.char.pos, h.char.pos))} m from him)`);
      const t0 = t; let marked = false, goT = 0, heldT = 0, anyway = false, wasHeld = false, seenT = 0;
      for (;;) {
        hold();
        if (h.state === 'dead') { say(`   (${name} is down ${f1(t - t0)} s after the order)`); break; }
        if (mate.state === 'dead') { giveUp('partner down'); break; }
        { const J = g.pair.jobOf(mate); if (J && J.foe === h && J.t0 >= 0) { goT += DT; if (goT > MARK.goWait) { giveUp('slow'); break; } continue; } }   // (the partner's HANDS ARE ON the man: nothing calls that off — pairorders.ts's own rule: a struggle is not undone by the man starting at it)
        if (anyRoused()) { giveUp(roused(h) ? 'he roused' : 'another man roused'); break; }
        if (eyesOnSam()) { seenT += DT; if (seenT > MARK.seen) { giveUp('eyes on Sam'); break; } } else seenT = Math.max(0, seenT - DT * 0.25);   // (a defender has turned Sam's way while he waits: he does not sit in that man's eye — the order is off and it is his own gun, as `pair`)
        const J = g.pair.jobOf(mate);
        if (!J || J.foe !== h) { giveUp('called off'); break; }   // (why: the man's own word, in m.mark.calledOff)
        if (!marked) { if (J.set) { g.pair.mark('api'); marked = true; say(`the mark (${mate.callsign} set after ${f1(t - t0)} s)`); } else if (t - t0 > MARK.setWait) { giveUp('no set'); break; } continue; }
        if (J.watcher) { if (!wasHeld) say(`   (held: ${J.watcher.callsign} is watching)`); wasHeld = true; heldT += DT;
          if (heldT > MARK.watchWait) { if (MARK.anyway && !anyway) { anyway = true; heldT = 0; g.pair.mark('api'); say('the mark again: go anyway'); } else { giveUp('watched'); break; } } }
        else { wasHeld = false; goT += DT; if (goT > MARK.goWait) { giveUp('slow'); break; } }
      }
    } finally { forceLow = false; if (given) fallIn(h.state === 'dead' ? 'on to the next' : 'the order is off'); }
  }

  // ───────────────────────────── the run
  let out: any = { scn, seed, arm, end: 'error', why: '', sw: switches() };
  try {
    hush();
    try {
      step(20);
      mate = mates()[0] ?? null;
      const H0 = hostiles().length; out.hostilesOf = H0; out.mate = mate?.callsign ?? null;
      if (arm === 'pairmark' && !PO?.PAIR?.on) throw new Error('pairmark needs the orders switch');
      if (mate) {
        if (arm !== 'pairloud') { setSilent(g, true, 'order'); say('order: go silent (the whole squad)'); }
        const id = arm === 'pairhold' ? 'hold' : 'fallIn', whyNot = g.orders.give(id, g.orders.targetAt(pos()), 'all'); say(`order: ${id}${whyNot ? ` — REFUSED: ${whyNot}` : ''}`); step();
      }
      if (pl.slot !== 'pistol' || pl.holstered) { press('Digit1'); step(40); }
      say(`Sam ${at(pos())} · ${pl.slot}${pl.holstered ? ' (holstered)' : ''} · ${H0} defenders · partner ${mate ? mate.callsign : 'none'} · arm ${arm}`);
      const avoid = new Set<any>(), gaveUp = new Map<any, number>();
      for (let guard = 0; guard < 4000; guard++) {
        const vis = targets(); if (vis.length) { if (orderable(vis[0])) command(vis[0]); else shoot(vis[0]); continue; }
        if (CAREFUL) { M.care.on = true; const w = waitingOn(); if (w.length) { M.care.waits++; const t0 = t;   // (the clock is each MAN's, summed over every wait on him: SNEAK.careWait seconds watched in all, then Sam shoots anyway)
          while (!targets().length && waitingOn().length) { step(15); for (const h of waitingOn()) { const s = (waited.get(h) ?? 0) + 15 * DT; waited.set(h, s); if (s >= SNEAK.careWait) { gaveIn.add(h); M.care.gaveIn++; say(`(careful: ${h.callsign} is still watched after ${f1(s)} s of waiting — Sam shoots anyway)`); } } }
          M.care.waitSecs = r2(M.care.waitSecs + t - t0); continue; } }
        // the nearest living defender by the way on foot (round the doors no quiet way opens)
        const dear = avoid.size ? new Set<number>([...avoid].flatMap(d => [...doorCellsOf(d)])) : null;
        const alive = hostiles().filter((h: any) => h.state !== 'dead' && (gaveUp.get(h) ?? 0) < 3);
        if (!alive.length) { if (hostiles().every((h: any) => h.state === 'dead')) { step(120); } throw new Done('stalled', 'no quiet way to the men still up'); }
        const ranked = alive.map((h: any) => { const p = free(h.char.pos), path = pathTo(p, dear); return { h, p, path, L: pathLen(path, p) }; }).sort((a: any, b: any) => a.L - b.L);
        const T = ranked[0]; if (!T.path) { gaveUp.set(T.h, 3); continue; }
        const d = doorOnPath(T.path);
        if (d && avoid.has(d)) { gaveUp.set(T.h, (gaveUp.get(T.h) ?? 0) + 1); say(`(no way to ${T.h.callsign} but through ${d.def.name})`); continue; }
        if (d) { if (!openDoor(d, dear, avoid)) avoid.add(d); continue; }
        if (orderable(T.h)) { command(T.h); continue; }
        const ok = go(T.p, 20, () => targets().length > 0 || waitingOn().length > 0 || T.h.state === 'dead' || !!doorAhead(T.p, dear) || orderable(T.h), dear);
        if (!ok && orderable(T.h)) continue;
        if (ok && !targets().length && T.h.state !== 'dead') { gaveUp.set(T.h, (gaveUp.get(T.h) ?? 0) + 1); say(`(Sam is at ${T.h.callsign}'s place with no line to him)`); step(30); }   // on his spot's nav cell and no line
        else if (!ok && wedged) { gaveUp.set(T.h, (gaveUp.get(T.h) ?? 0) + 1); }
      }
      throw new Done('stalled', 'the script ran out of turns');
    } finally { unhush(); }
  } catch (e) {
    if (e instanceof Done) { out.end = e.end; out.why = e.why; } else { out.end = 'error'; out.why = e instanceof Error ? (e.message === 'pairmark needs the orders switch' ? e.message : `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 6).join('\n')}`) : String(e); }
  }
  const H = hostiles(), up = H.filter((h: any) => h.state !== 'dead').length, loud = !!M.firstLoud, noticed = M.rousedN > 0;
  const finished = up === 0 && out.end !== 'wiped' && out.end !== 'error' && !pl.down;
  const worstAw = Math.max(0, ...Object.values(M.aw) as number[]), hot = M.hot.alert + M.hot.search > 0;
  out.cls = out.end === 'error' ? 'error' : pl.down ? 'dead' : loud ? 'loud' : hot || worstAw > 0.75 ? 'spotted' : noticed ? 'looked' : M.hot.suspicious > 0 ? 'turned' : finished ? 'ghost' : 'stalled';   // (pair-sneak-tally.ts cls2, the same)
  out.finished = finished; out.t = +t.toFixed(1); out.hostiles = up; out.samDown = !!pl.down; out.mateUp = mate ? mate.state !== 'dead' : null;
  out.rooms = g.roomClear?.active ? g.roomClear.rooms.filter((r: any) => r.clear).length : null;
  if (E.kind === 'rescue') { const Hs = (g.rescue.hostages ?? []).map((h: any) => h.gd ?? h); out.hostages = [Hs.filter((h: any) => h.state !== 'dead').length, Hs.length]; }
  out.sw = switches();   // (as they read at the END: what the run was played under)
  if (M.mark && PO) { const K = M.mark, S0 = PO.PAIR_STATS; K.given = S0.given; K.marks = S0.marks; K.taken = S0.taken; K.blown = S0.blown; K.watchedHolds = S0.watched; K.anyway = S0.anyway; K.cancelled = S0.cancelled; }
  if (PO) M.pairStats = { on: !!PO.PAIR.on, ...PO.PAIR_STATS };
  if (PU?.PAIRUP_STATS) M.pairupStats = PU.PAIRUP.on ? { ...PU.PAIRUP_STATS } : null;
  if (SN) M.sneak = SN.SNEAK.on ? { ...SN.SNEAK_STATS, waitS: r2(SN.SNEAK_STATS.waitS) } : null;
  if (SP) M.spottedStats = SP.SPOTTED.on ? { ...SP.SPOTTED_STATS } : null;
  const fr = (k: number) => P0.mateN ? r2(k / P0.mateN) : null, P0 = M.pre;
  const P = M.pre; out.m = { ...M, pre: P.n ? { follower: fr(P.follower), followerSilent: fr(P.followerSilent), sneaking: fr(P.sneaking), orders: Object.fromEntries(Object.entries(P.orders).map(([k, v]) => [k, fr(v as number)])), n: P.n, secs: M.preSecs, dMean: r2(P.dSum / P.n), dMax: r2(P.dMax), far6: r2(P.far6 / P.n), far9: r2(P.far9 / P.n), mateLos: r2(P.mateLos / P.n), mateCone: r2(P.mateCone / P.n), mateOnlyLos: r2(P.mateOnlyLos / P.n), mateOnlyCone: r2(P.mateOnlyCone / P.n), samLos: r2(P.samLos / P.n), samCone: r2(P.samCone / P.n), mateDoor: r2(P.mateDoor / P.n), mateLit: r2(P.mateLit / P.n), mateStill: r2(P.mateStill / P.n), samCrouch: r2(P.samCrouch / P.n), samSky: r2((P.samSky ?? 0) / P.n), moon: MOON, mateVis: r2(P.mateVisSum / P.n), samVis: r2(P.samVisSum / P.n), mateVisMax: r2(P.mateVisMax), samVisMax: r2(P.samVisMax), mateAhead: r2(P.mateAheadOfSam / P.n) } : null };
  out.silent = { ...SILENT_STATS, on: squadSilent(g) }; out.moon = MOON; out.careful = CAREFUL;
  if (SP) out.spotted = { on: SP.SPOTTED.on, ...SP.SPOTTED_STATS };
  if (DG) { try { out.digest = DG.hashDigest(DG.digestGame(g, true)); } catch { out.digest = null; } }
  return { out, trace };
}

if (flag('--one')) {
  const [scn, seed] = flag('--one')!.split(':'); const arm = (flag('--arm') ?? 'pair') as Arm; if (!ARMS.includes(arm)) { console.error(`--arm: ${ARMS.join(' | ')}`); process.exit(2); }
  const { out, trace } = await one(scn, Number(seed), arm, Number(flag('--cap') ?? 300), has('--trace'));
  if (flag('--outfile')) writeFileSync(flag('--outfile')!, JSON.stringify(out));
  else { if (!has('--trace') && has('--print-trace')) console.log(trace.join('\n')); console.log(has('--json') ? JSON.stringify(out, null, 1) : `${scn}:${seed} ${arm} → ${out.cls} (${out.end}${out.why ? ' · ' + String(out.why).split('\n')[0] : ''}) at ${out.t} s · theirs ${out.hostiles}/${out.hostilesOf} up · Sam ${out.samDown ? 'DOWN' : 'up'}${out.mate ? ` · ${out.mate} ${out.mateUp ? 'up' : 'DOWN'}` : ''} · first: ${out.m.first ? `${out.m.first.how} at ${out.m.first.t} s` : 'nothing'}`); }
  process.exit(out.end === 'error' ? 1 : 0);
}

// ───────────────────────────── the pool: a JSON line per run in <out>/<scn>.<arm>.jsonl; a seed already there is not run again
const outDir = resolve(flag('--out') ?? 'pair-sneak-runs'); mkdirSync(outDir, { recursive: true });
const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
const scns = (flag('--scn') ?? 'records-pair').split(','), arms = (flag('--arms') ?? 'solo,pair').split(',') as Arm[], seeds = seedsOf(flag('--seeds') ?? '433-576');
for (const a of arms) if (!ARMS.includes(a)) { console.error(`arm '${a}': ${ARMS.join(' | ')}`); process.exit(2); }
const jobs = Math.max(1, Number(flag('--jobs') ?? 4)), capN = Number(flag('--cap') ?? 300), tag = flag('--tag') ?? '';
const fileOf = (scn: string, arm: string) => resolve(outDir, `${scn}.${arm}${tag ? '.' + tag : ''}.jsonl`);
const done = new Set<string>();
for (const scn of scns) for (const arm of arms) { const f = fileOf(scn, arm); if (!existsSync(f)) continue; for (const l of readFileSync(f, 'utf8').split('\n')) { if (!l.trim()) continue; try { const r = JSON.parse(l); if (r.end !== 'error') done.add(`${scn}|${arm}|${r.seed}`); } catch { /* a cut line: run again */ } }
  if (!readFileSync(f, 'utf8').endsWith('\n')) appendFileSync(f, '\n'); }   // (an errored run is run again: the tally takes a seed's LAST row; a cut last line must not swallow the next append)
const todo: { scn: string; arm: string; seed: number }[] = [];
for (const seed of seeds) for (const scn of scns) for (const arm of arms) if (!done.has(`${scn}|${arm}|${seed}`)) todo.push({ scn, arm, seed });
console.error(`${todo.length} runs to do (${done.size} already there) → ${outDir}`);
let next = 0, n = 0, failed = 0, errors = 0; const t0 = Date.now();
const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
  const file = resolve(tmpdir(), `pairsneak-${process.pid}-${j.scn}-${j.arm}-${j.seed}.json`);
  const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.scn}:${j.seed}`, '--arm', j.arm, '--cap', String(capN), '--outfile', file], { stdout: 'ignore', stderr: 'pipe', cwd: process.cwd(), env: process.env });
  const errText = await new Response(pr.stderr).text(); await pr.exited;
  try { const r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); n++; appendFileSync(fileOf(j.scn, j.arm), JSON.stringify(r) + '\n');
    if (r.cls === 'error') { errors++; console.error(`  ERROR ${j.scn}:${j.seed} ${j.arm} — ${String(r.why).split('\n')[0]}`); }
    if (n % 20 === 0) console.error(`  ${n}/${todo.length} · ${Math.round((Date.now() - t0) / 1000)} s · last ${j.scn}:${j.seed} ${j.arm} ${r.cls}`); }
  catch { failed++; console.error(`  FAILED ${j.scn}:${j.seed} ${j.arm} — ${errText.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`); } } };
await Promise.all(Array.from({ length: jobs }, worker));
console.error(`done: ${n} runs in ${Math.round((Date.now() - t0) / 1000)} s${errors ? ` · ${errors} ERROR rows (run the same command again once fixed: an errored seed is run again)` : ''}${failed ? ` · ${failed} FAILED (no row written: run the same command again)` : ''}`);
process.exit(failed || errors ? 1 : 0);
