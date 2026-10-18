// THE BIG SLOT (src/game/kit.ts BIGSLOT — every card has ONE big slot beside its pouches: the wall charge, the shield, the breaching shotgun, the dynamic
// hammer; src/game/bigkit.ts — the last two on a locked door: yours a row in the boot's place, a teammate's on a door order), headless:
//   bun run tools/qa/bigslot-check.ts [card|off|you|mate|shut|moves|wiring]      (BIGKIT_BREAK=1 = the tools do nothing to a lock: every 'the lock is gone' line must fail)
// The maintainer, 10-14: "you have a single big slot on the bottom that can fit larger kit items and then smaller pouches for other stuff" · "i do think we
// should change the breaching shotgun to not take up a primary weapon slot" · "and then we should also add a dynamic hammer".
//   card    the switch on: one 'big' row a card, the weapon row a rifle or a pistol, no shield row and no wall charge row; no step of the row puts two big
//           things on a man; a stored shotgun-as-gun card is read as the issued gun with the shotgun in the big slot; a stored card with two big things comes
//           down to one (the shield before a wall charge or a hammer) and says so; a hand that still sets 'shield', 'walls' or the shotgun as a gun is
//           answered through the big row; the issued kit and every squad kit of the table are legal; a big thing fills the slot and no pouch; a table
//           from before the big slot marks the four big things by default. The switch off: a teammate's rows are the build before's, the weapon row
//           offers the shotgun, and a stored `big` is kept, inert
//   off     the switch off: a hammer forced onto the Player gets no row at a locked door, a staged man whose card says hammer carries none, and the
//           room clear's manager door under open and clear is the same run by digest with the cards' big slots filled as with them empty
//   you     the plain night's locked storage door, the tool put on you off your card. The shotgun and the hammer each, from the face the leaf opens away
//           from and from the face it opens toward (where the frame holds a boot): the row stands in the boot's place, and inside three seconds the lock is
//           gone — the shotgun's as gunfire, the hammer's with no shot: ONE blow where a boot would do, BIGSLOT.swings where the frame holds one, and
//           through that beat the HUD never says 'the frame took the boot' (a bare boot there does); from the face it opens toward the leaf stays home
//           and a hand opens it. A wedged door gives to the hammer and offers the shotgun nothing; a steel door offers neither
//   mate    the room clear's manager door under open and clear. A man whose card carries the shotgun keeps his rifle, brings the M870 up for the lock and
//           has his own gun back the moment it is off — and at once when the order is taken away or he is given another with it up. A man whose card
//           carries the hammer takes the lock in one blow and no shot. And a door locked on the face it opens toward, wedged (no pick opens it):
//           refused as ever without a tool, taken by the hammer in BIGSLOT.swings blows and pulled by hand — but refused to a SILENT squad, hammer or
//           no; the shotgun takes a keyed lock from that face the same way
//   shut    BIGSLOT.shut + BIGSLOT.beside (the maintainer after playing, 10-15: "i don't see how to use breaching shotgun or dynamic hammer" · "these
//           things should work for unlocked doors too" · "helps also not be directly in front of the door when opening" · "hammer should also help with
//           barricaded doors"). YOU at a door that is NOT locked: its own rows stand and the tool's row is listed under them; performed, it is worked from
//           beside the latch jamb, the latch is broken and the door ENDS OPEN from either face with no second press; a wedged door gives to the hammer
//           from the face it opens toward too. A TEAMMATE: the squad's own row on a door's tools — on H, shown on the door's first page, X then H —
//           takes an unlocked door with the tool from either face and ends (no second trip to the lock), takes a locked one without the halt at a door
//           found shut, is refused to a silent squad, and is not there when nobody carries one; a plain open and clear on an unlocked door still uses
//           the handle. Both knobs off: the build of 10-14 (no row at an unlocked door, the leaf left home from the face it opens toward, in front)
//   moves   BIGSLOT.moves (the maintainer, 10-15 evening, with Door Kickers 2 footage: "using the hammer shouldn't require being directly in front of the
//           door?" · "they put away their gun, equip the hammer, wind up, and then hit the door in one motion"). YOU, from where a stack's second man
//           stands (outside the hand's reach): the row is there, he WALKS to a place beside the frame and is never in the opening; a man on the latch
//           jamb leaves him the place off that man's shoulder, or the hinge jamb when he came from that side and the leaf opens away; the animator is
//           told each blow a wind-up ahead and it lands when told; the shotgun's place is a hand from the lock. A TEAMMATE's hammer is off his back
//           as he is sent and back on it after; both tools from hard by the frame. Off: the build of 10-15 morning. OVER THE RIFLE: with his rifle slung
//           across his back neither tool's boxes lie inside the rifle's (box against box, on this stand's body and rifle, and in the game's own frame);
//           with the rifle in his hands the tool lies on his back with no clearance. Looks at no picture
//   wiring  the two stands' row and word, the knob registry, the journal's tables (a recording from before the table replays with the switch off), slots.json
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself, and says which stand it ran on. Where a verdict needs a state no
// level of the repo has (a lock keyed to the face a leaf opens toward, a wedge under a leaf, the frame rule on the frozen stand) the check sets it by hand
// and the verdict's line says so. Nothing here looks at a picture: neither tool has ever been seen on a GPU.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, loadCharacter, ROOT } from './headless.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const BK = await import(`${ROOT}/src/game/bigkit.ts`);
const { SHIELD } = await import(`${ROOT}/src/game/shield.ts`);
const { BIG_STATS } = BK;
const { doorPt, alongOf, offOf } = await import(`${ROOT}/src/game/doortools.ts`);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { killGuard, handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { BIG_TAG, SC20K_TAG, RIG, rifleM4, sc20kBoxes, bigBoxes } = await import(`${ROOT}/src/game/rigProps.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
const { KITANIM, kitSlingFront } = await import(`${ROOT}/src/game/kitanim.ts`);
const { Character } = await import(`${ROOT}/src/game/character.ts`);
/** two drawn boxes, each a centre, half extents and a turn (Box.rot, else its yaw): how far apart at least (> 0), or how far inside each other (< 0) — the
 *  widest gap over the fifteen axes two boxes can be told apart on */
const boxGap = (A: any, B: any): number => {
  type V = number[]; const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const axes = (b: any): V[] => { const q = b.rot ?? quat.yaw(b.yaw); return [quat.rotate(q, [1, 0, 0]), quat.rotate(q, [0, 1, 0]), quat.rotate(q, [0, 0, 1])]; };
  const a = axes(A), b = axes(B), d = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]]; let best = -Infinity;
  const on = (L: V) => { const n = Math.hypot(L[0], L[1], L[2]); if (n < 1e-6) return; const l = [L[0] / n, L[1] / n, L[2] / n], r = (X: any, ax: V[]) => X.h[0] * Math.abs(dot(ax[0], l)) + X.h[1] * Math.abs(dot(ax[1], l)) + X.h[2] * Math.abs(dot(ax[2], l)); best = Math.max(best, Math.abs(dot(d, l)) - r(A, a) - r(B, b)); };
  for (const x of a) on(x); for (const x of b) on(x); for (const x of a) for (const y of b) on(cross(x, y)); return best; };
/** THE TOOL ACROSS A BACK THAT CARRIES A RIFLE TOO (rigProps.ts bigBoxes with its `clear`, sc20kBoxes 'slung'): a bare man of this stand's body, standing, the
 *  stand's own rifle slung behind him — the nearest the tool's boxes come to the rifle's, m, with the clearance asked for and with none. Both lie in the back's
 *  one frame, so the pose changes nothing between them. */
const overRifle = async (kind: 'hammer' | 'shotgun') => { const ch = await loadCharacter(), c = new Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [2, 0, 3], yaw: 0.7 }); for (let i = 0; i < 60; i++) c.update(DT);
  const rifle: any[] = []; sc20kBoxes(c, rifle, RIG.sc20k, 'slung', [0, 0, 0], undefined, rifleM4(RIG));
  const near = (clear: boolean) => { const tool: any[] = []; bigBoxes(c, kind, 0, tool, RIG, clear); let w = Infinity; for (const r of rifle) for (const t of tool) w = Math.min(w, boxGap(r, t)); return { gap: w, n: tool.length }; };
  return { clear: near(true), flat: near(false), rifle: rifle.length, cast: !!ch.cast }; };
/** the hollow of his right fist as the PICTURE has it (the drawn wrist: the look-only pass of inhand.ts may have moved it off bones.handR), and how far a point is from a drawn box (0 inside) */
const hollowR = (c: any): number[] => { const w = c.world, p = c.skel.nodePos(c.anim.nodes.handR), hf = c.handFrameR(), h = [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; return [0, 1, 2].map(i => h[i] + hf.fingers[i] * 0.09 - hf.back[i] * 0.03); };
const ptGap = (b: any, p: number[]): number => { const q = b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)], v = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]], qx = -q[0], qy = -q[1], qz = -q[2], qw = q[3], tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]),
  l = [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]; return Math.hypot(Math.max(0, Math.abs(l[0]) - b.h[0]), Math.max(0, Math.abs(l[1]) - b.h[1]), Math.max(0, Math.abs(l[2]) - b.h[2])); };
/** the big slot's hammer as it is DRAWN on the man with this character id (rigProps.ts bigBoxes, by its tag): how many boxes, and the head's centre; `all` = every box the frame draws on anybody */
const drawnTool = (g: any, id: number) => { const out: any[] = []; handProps(g, out); const mine = out.filter(b => b.name === BIG_TAG && b.owner === (id & 0xff)), head = mine.find(b => b.h[0] > 0.05); return { n: mine.length, head: head ? [...head.c] as number[] : null, all: out.length }; };
const SIL = await import(`${ROOT}/src/game/silent.ts`);
const { PACKSIDE } = await import(`${ROOT}/src/game/packside.ts`);   // (held off in this rig: these lines are about the tool across a BARE back — its place at a pack's side and the hand that goes there are packside-check.ts's, on both stands)
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { harnessProfile, FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const J = (o: unknown) => JSON.stringify(o), DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const STAND = harnessProfile() as string, BROKEN = process.env.BIGKIT_BREAK === '1', SNUG_BROKEN = process.env.BIGSNUG_BREAK === '1';
/** the doors' frame rule as the stand has it (headless.ts pins it as it loads): every game here starts from it, whatever the one before raised */
const WAY0 = { oneWay: DOORWAY.oneWay as boolean, frameHolds: DOORWAY.frameHolds as boolean };
/** … and whether the plain night wears your card (kit.ts KIT_SOLO — a game stood up while it is up puts the table's card on its fresh Player) */
const SOLO0 = { ...K.KIT_SOLO };
const memStore = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
const fields = (i: number): string[] => K.kitRows(i).map((r: any) => r.field as string);
const rowOf = (i: number, f: string) => K.kitRows(i).find((r: any) => r.field === f);
/** how many big things a card holds, counted off its fields (never asked of the table under test) */
const bigThings = (m: any) => (m.shield ? 1 : 0) + (m.walls | 0) + (m.big && m.big !== 'none' ? 1 : 0);
const stats = () => ({ ...BIG_STATS }) as Record<string, number>;
const since = (a: Record<string, number>) => Object.fromEntries(Object.entries(BIG_STATS as Record<string, number>).map(([k, v]) => [k, v - a[k]])) as Record<string, number>;
/** the kit table, its rules, the switch, the doors' frame rule, the silent order's switch and the dice as they stood, put back after `fn` (the store the table writes to is left on nothing) */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const cards = K.KIT.members.map((m: any) => ({ ...m })), on = K.KIT.on, slots = K.SLOTS.on, big = K.BIGSLOT.on, plate = SHIELD.on, shut = K.BIGSLOT.shut, beside = K.BIGSLOT.beside, moves = K.BIGSLOT.moves, snug = K.BIGSLOT.snug, solo = { ...K.KIT_SOLO }, way = { oneWay: DOORWAY.oneWay, frameHolds: DOORWAY.frameHolds }, hush = SIL.SILENT.on, side = PACKSIDE.on, rnd = Math.random;
  try { return await fn(); } finally { PACKSIDE.on = side; K.kitLoad(null, ''); K.BIGSLOT.on = big; SHIELD.on = plate; K.BIGSLOT.shut = shut; K.BIGSLOT.beside = beside; K.BIGSLOT.moves = moves; K.BIGSLOT.snug = snug; K.SLOTS.on = slots; K.KIT.on = on; for (let i = 0; i < cards.length; i++) K.KIT.members[i] = cards[i]; Object.assign(K.KIT_SOLO, solo); Object.assign(DOORWAY, way); SIL.SILENT.on = hush; Math.random = rnd; }
}

// where Sam stands for the manager's door (his side of it is the side the squad works it from): the corridor, off the line of the opening
const SAM_MANAGER = [24.0, 0, 11.2];
type Ev = { t: number; kind: string; weapon?: string; who?: number; loud: boolean };
/** One game under a seed, the switch as `on` says (the frozen stand pins it off as it stands a game up: written after), `cards` written on the loadout
 *  cards BEFORE the staging — so the staging is what hands a man his tool — and the room clear staged (`stage: false` = the plain night, Sam alone).
 *  Sam in god mode and dark; every game event but footfalls kept, with its time. */
async function rig(seed: number, o: { cards?: Record<number, Record<string, unknown>>; stage?: boolean; on?: boolean; old?: boolean; nomoves?: boolean; nosnug?: boolean } = {}) {
  Math.random = seeded(0x51b6 + seed * 7919);
  Object.assign(DOORWAY, WAY0); Object.assign(K.KIT_SOLO, SOLO0); for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = K.kitDefault(i);   // (nothing of the game before this one: its frame rule, its cards)
  const W: any = await hushed(() => standUp()); const game = W.game; PACKSIDE.on = false; K.BIGSLOT.on = o.on ?? true; K.BIGSLOT.shut = K.BIGSLOT.beside = !o.old; K.BIGSLOT.moves = !o.old && !o.nomoves; K.BIGSLOT.snug = !o.old && !o.nosnug && !SNUG_BROKEN;   // (`old`: the knobs of 10-15 off — the tools as the build of 10-14 had them; `nomoves`: the evening's alone — the row inside the hand's reach, the one place, the punch)
  for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = { ...K.kitDefault(i), ...(o.cards?.[i] ?? {}) };
  game.godMode = true;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(String(t)); msg(t); }; }   // (every line the HUD is handed)
  const why = o.stage === false ? null : await hushed(() => game.roomClear.start(seed));
  const seen = new Set<any>();
  const R = { W, game, input: W.input, O: game.orders, D: game.doorTools, NB: game.nightBreach, why, said, ev: [] as Ev[], post: null as null | (() => void),
    get ops(): any[] { return game.nightBreach.ops; },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT);
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind !== 'step') R.ev.push({ t: e.time, kind: e.kind, weapon: e.weapon, who: e.who, loud: !!e.loud }); }
      R.post?.(); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { const d = game.doors.list.find((x: any) => x.def.name === name); if (!d) throw new Error(`no door '${name}' in the level`); return d; },
    /** every beat of every door order so far, seconds after `t0` */
    beats(t0: number): string { return [...R.D.done, ...R.D.ops].flatMap((op: any) => op.beats).map((b: any) => `${f2(b.t - t0)} ${b.what}`).join(' | '); },
    evs(t0: number, kinds: string[]): string { return R.ev.filter(e => e.t >= t0 - 1e-6 && kinds.includes(e.kind)).map(e => `${f2(e.t - t0)} ${e.kind}${e.weapon ? `:${e.weapon}` : ''}`).join(', ') || 'none'; },
  };
  await hushed(() => R.step(30));
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;
const rowsOf = (g: any): string[] => g.nearby.filter((x: any) => x.kind === 'door').map((x: any) => x.verb as string);
/** the face of d the leaf opens AWAY from (a boot there drives it) and the one it opens toward (where it rests on the frame's stop) */
const faceOf = (g: any, d: any, which: 'push' | 'pull'): 1 | -1 => { const pull = ([1, -1] as const).find(s => g.doors.pullFace(d, doorPt(d, d.def.width / 2, 0.75, s))) ?? 1; return (which === 'pull' ? pull : -pull) as 1 | -1; };
/** THE FRAME HOLDS A BOOT (doors.ts DOORWAY.oneWay + frameHolds) is the page's rule and held off on the frozen stand: raised by hand for a verdict about
 *  the face a leaf opens toward — true = it had to be (kept() puts it back) */
function frameUp(g: any): boolean { if (g.doors.frameRule) return false; DOORWAY.oneWay = true; DOORWAY.frameHolds = true; return true; }
/** a leaf put home on its latch and locked against the man at `from`, by hand: `lockId` 'wedge:…' = a wedge under it (digin.ts), which no pick opens */
function lockAgainst(g: any, d: any, from: number[], lockId?: string) { d.angle = 0; d.vel = 0; d.latched = true; d.locked = true; d.lockBroken = false; d.keySide = g.doors.side(d, from); if (lockId) d.lockId = lockId; }

// ───────────────────────────────────────────────────────────── card
export async function bigCard(): Promise<boolean> {
  const F = family('bigslot-card: one big slot a card — the shotgun off the weapon row, the hammer beside it, never two big things, never a pouch');
  await kept(async () => {
    try {
      await hushed(() => standUp());   // (the tables stood as the stand has them)
      const ALLOWED = ['none', 'shotgun', 'hammer', 'wall', 'shield'];
      // (THE SHIELD is out of the page since 10-15 — shield.ts SHIELD.on, off on the shipped stand: this family is about the card WITH every big thing the
      // build has, so it raises that switch too, as it raises the big slot's; the card without the shield is tools/qa/noshield-check.ts's)
      K.BIGSLOT.on = true; SHIELD.on = true; K.kitLoad(null, '');
      const per = [0, 1, 2, 3, 4].map(i => { const f = fields(i), big = rowOf(i, 'big'), gun = rowOf(i, 'weapon'); return { f, big: (big?.values ?? []) as string[], gun: (gun?.values ?? []) as string[] }; });
      F.verdict(K.SLOTS.on && per.every(p => p.f.filter(x => x === 'big').length === 1 && !p.f.includes('shield') && !p.f.includes('walls') && p.gun.join() === 'rifle,pistol' && p.big[0] === 'none' && p.big.includes('shotgun') && p.big.includes('hammer') && p.big.every(v => ALLOWED.includes(v)))
        && !per[0].big.includes('shield') && per.slice(1).every(p => p.big.includes('shield')),
        'the switch on, the pouches rule on: every card has ONE big row — empty, the shotgun, the hammer (a wall charge where the build has one; the shield a teammate\'s alone) — its weapon row is a rifle or a pistol, and there is no shield row and no wall charge row',
        per.map((p, i) => `${i}: ${p.f.join(' ')} · weapon ${p.gun.join('/')} · big ${p.big.join('/')}`).join('\n    '));
      K.kitLoad(null, '?noslots'); const free = [0, 1].map(i => ({ f: fields(i), big: (rowOf(i, 'big')?.values ?? []) as string[], gun: (rowOf(i, 'weapon')?.values ?? []) as string[] }));
      F.verdict(!K.SLOTS.on && free.every(p => p.f.filter(x => x === 'big').length === 1 && !p.f.includes('shield') && !p.f.includes('walls') && p.gun.join() === 'rifle,pistol' && p.big.includes('shotgun') && p.big.includes('hammer')),
        'the same with the pouches rule off (the frozen stand\'s free rows): the big row is still the one home of the shotgun, the hammer and the shield', free.map((p, i) => `${i}: ${p.f.join(' ')} · big ${p.big.join('/')}`).join(' · '));

      // no step of the row leaves two big things on a man — walked twice round, both ways, on you and on a teammate
      K.kitLoad(null, '');
      let worst = 0, refused = 0; const walked: string[] = [];
      for (const i of [0, 1]) { const n = rowOf(i, 'big').values.length, seen = new Set<string>();
        for (const dir of [1, -1] as const) for (let k = 0; k < n * 2; k++) { const t = K.kitTry(i, 'big', dir); if (!t.ok) refused++; seen.add(String(t.value)); worst = Math.max(worst, bigThings(K.KIT.members[i]), K.kitCost(i).big?.used ?? 9); }
        walked.push(`${i}: ${[...seen].join(' → ')}`); if (seen.size !== n) worst = 9; K.kitSet(i, 'big', 'none'); }
      F.verdict(worst === 1 && refused === 0, 'stepped twice round, both ways, the row visits every one of its values, is never refused, and the card never holds two big things', `${walked.join(' · ')} · most big things on a card at any step ${worst} · refused ${refused}`);

      // a kit stored by the build before: the shotgun as a man's gun
      { const old = memStore({ [K.KIT_LS]: J({ v: 2, members: [0, 1, 2, 3, 4].map(i => (i <= 1 ? { ...K.kitDefault(i), weapon: 'shotgun' } : K.kitDefault(i))) }) });
        K.kitLoad(old, ''); const you = { ...K.KIT.members[0] }, mate = { ...K.KIT.members[1] }, legal = K.kitLegal(), words = K.kitWords(1);
        F.verdict(you.weapon === K.kitDefault(0).weapon && you.big === 'shotgun' && mate.weapon === K.kitDefault(1).weapon && mate.big === 'shotgun' && K.kitGun(mate) !== 'm870' && legal === null && /shotgun/.test(words),
          'a stored card whose GUN is the shotgun (the build before\'s; yours and a teammate\'s) is read as the issued gun with the shotgun in the big slot', `you: weapon ${you.weapon}, big ${you.big} · Red One: weapon ${mate.weapon} (${K.kitGun(mate)}), big ${mate.big} · legal ${legal} · "${words}"`); }
      // … and one over the big slot
      { const walls = rowOf(1, 'big').values.includes('wall'), over = walls ? { shield: true, walls: 1 } : { shield: true, big: 'hammer' };
        const st = memStore({ [K.KIT_LS]: J({ v: 2, members: [0, 1, 2, 3, 4].map(i => (i === 1 ? { ...K.kitDefault(1), ...over } : K.kitDefault(i))) }) });
        K.kitLoad(st, ''); const m = { ...K.KIT.members[1] }, note = K.KIT_NOTE[1], c = K.kitCost(1);
        F.verdict(bigThings(m) === 1 && c.big?.used === 1 && /left behind/.test(note) && /big slot/.test(note) && K.kitLegal() === null,
          `a stored teammate's card with ${walls ? 'a shield AND a wall charge' : 'a shield AND a hammer (this build has no wall charge row: the hammer stands in for it)'} comes down to one big thing, and the card says what stayed behind`, `kept: shield ${m.shield}, walls ${m.walls}, big ${m.big} · big slot ${J(c.big)} · note: "${note}"`); }

      // … the shield is the last thing a man over his big slot gives up: beside a hammer it is the hammer that stays home
      { const st = memStore({ [K.KIT_LS]: J({ v: 2, members: [0, 1, 2, 3, 4].map(i => (i === 1 ? { ...K.kitDefault(1), shield: true, big: 'hammer' } : K.kitDefault(i))) }) });
        K.kitLoad(st, ''); const m = { ...K.KIT.members[1] }, note = K.KIT_NOTE[1];
        F.verdict(m.shield === true && m.big === 'none' && !m.walls && K.bigOf(m) === 'shield' && /hammer/.test(note) && /left behind/.test(note) && !/shield/.test(note) && K.kitLegal() === null,
          'a stored teammate\'s card with a shield AND a hammer keeps the SHIELD and leaves the hammer behind, in words', `kept: shield ${m.shield}, walls ${m.walls}, big ${m.big} · note: "${note}"`); }
      // a hand that still names the rows of the build before (a tool, a tally) is answered through the big row
      { K.kitLoad(null, ''); const gun0 = K.kitDefault(1).weapon, walls = rowOf(1, 'big').values.includes('wall'), was = (i: number) => `${K.bigOf(K.KIT.members[i])}`;
        const a = K.kitSet(1, 'shield', true), a1 = was(1), aF = K.KIT.members[1].shield;
        const b = K.kitSet(1, 'weapon', 'shotgun'), b1 = was(1), bGun = K.KIT.members[1].weapon, bShield = K.KIT.members[1].shield, bMost = bigThings(K.KIT.members[1]);
        const c = walls ? K.kitSet(1, 'walls', 1) : true, c1 = walls ? was(1) : 'wall', cMost = bigThings(K.KIT.members[1]);
        const d = walls ? K.kitSet(1, 'walls', 0) : true, d1 = walls ? was(1) : 'none';
        const e = K.kitSet(1, 'shield', true) && K.kitSet(1, 'shield', false), e1 = was(1);
        const y = K.kitSet(0, 'weapon', 'shotgun'), y1 = was(0), yGun = K.KIT.members[0].weapon; K.kitSet(0, 'big', 'none'); K.kitSet(1, 'big', 'none');
        F.verdict(a && a1 === 'shield' && aF === true && b && b1 === 'shotgun' && bGun === gun0 && bShield === false && bMost === 1 && c && c1 === 'wall' && cMost === 1 && d && d1 === 'none' && e && e1 === 'none' && y && y1 === 'shotgun' && yGun === K.kitDefault(0).weapon && K.kitLegal() === null,
          `the switch on, kitSet by the build before's names — 'shield' true, the weapon 'shotgun'${walls ? ", 'walls' 1" : ' (this build has no wall charge row: \'walls\' not asked)'} — is answered through the big row: one big thing at a time, and the weapon stays the issued gun`,
          `Red One: shield true → ${a} big ${a1} · weapon shotgun → ${b} big ${b1}, weapon ${bGun}, shield ${bShield} · walls 1 → ${c} big ${c1} · walls 0 → ${d} big ${d1} · shield on then off → ${e} big ${e1} · you: weapon shotgun → ${y} big ${y1}, weapon ${yGun}`); }

      // the issued kit and the table's squad kits
      { K.kitLoad(null, ''); const issued = K.kitLegal(), list = K.kitLoadouts() as { id: string; name: string }[];
        const each = list.map(l => { const w = K.kitLoadout(l.id), legal = K.kitLegal(), most = Math.max(...K.KIT.members.map(bigThings)); return { id: l.id, w, legal, most }; });
        F.verdict(issued === null && list.length >= 2 && each.every(e => e.w === null && e.legal === null && e.most <= 1) && K.SLOTS.table.v === 9,
          'the issued kit and every squad kit the screen can put on are legal fills under the big slot (slots.json v9), no man of them with two big things', `issued: ${issued === null ? 'legal' : issued} · ${each.map(e => `${e.id}: ${e.w ?? 'put on'}, ${e.legal ?? 'legal'}, most big things ${e.most}`).join(' · ')} · table v${K.SLOTS.table.v}`); }

      // a big thing fills the slot and no pouch — yours on a card whose four pouches are full
      { K.kitLoad(null, ''); const lines: string[] = []; let ok = true;
        for (const i of [0, 1]) for (const v of ['shotgun', 'hammer']) { K.kitSet(i, 'big', 'none'); const c0 = K.kitCost(i), set = K.kitSet(i, 'big', v), c1 = K.kitCost(i), price = K.kitRowCost(i, rowOf(i, 'big'));
          ok &&= set && c0.big?.used === 0 && c0.big.total === 1 && c1.big?.used === 1 && c1.big.total === 1 && c1.used === c0.used && c1.total === c0.total && !price?.pouches && K.kitLegal() === null;
          lines.push(`${i} ${v}: set ${set} · pouches ${c0.used} of ${c0.total} → ${c1.used} of ${c1.total} · big ${J(c0.big)} → ${J(c1.big)}`); }
        const full = K.kitCost(0); K.kitSet(0, 'big', 'none'); K.kitSet(1, 'big', 'none');
        F.verdict(ok && full.used === full.total, 'the shotgun or the hammer on a card reads 1 of 1 in its big slot and leaves its pouches as they were — yours taken with all four pouches full', lines.join('\n    ')); }

      // a table from before the big slot (no tool marked big, no member given a slot): the four things the slot is for are big by default
      { const RAW = JSON.parse(readFileSync(resolve(ROOT, 'src/game/slots.json'), 'utf8')), strip = <T extends object>(o: T) => { const { big: _big, ...rest } = o as T & { big?: unknown }; return rest; };
        const old = { ...RAW, members: RAW.members.map(strip), tools: RAW.tools.map(strip) };
        K.kitLoad(null, ''); let why: string | null = 'not asked', marks = '', slotsOf = '', cost: { used: number; big: unknown } | null = null, back: string | null = 'not put back';
        try { why = K.slotsSet(old); const T = K.SLOTS.table; marks = ['walls', 'shield', 'shotgun', 'hammer'].map(k => `${k} ${T.items[k] ? !!T.items[k].big : 'no such tool'}`).join(', '); slotsOf = J(T.big);
          K.kitSet(1, 'big', 'hammer'); const c = K.kitCost(1); cost = { used: c.used, big: c.big }; K.kitSet(1, 'big', 'none'); }
        finally { back = K.slotsSet(RAW); }
        const issued = K.kitCost(1, K.kitDefault(1)).used, T = K.SLOTS.table;
        F.verdict(why === null && !/false|no such/.test(marks) && slotsOf === J([1, 1, 1, 1, 1]) && cost?.used === issued && J(cost?.big) === J({ used: 1, total: 1 }) && back === null && T.v === 9 && !!T.items.hammer?.big,
          'a slots table of the shape before v9 (no `big` on any tool or member) is taken, and marks the wall charge, the shield, the shotgun and the hammer big, one slot a man — the hammer on a card costs no pouch under it (the shipped table put back after)', `taken: ${why ?? 'yes'} · ${marks} · big slots ${slotsOf} · Red One with a hammer: pouches ${cost?.used} (issued ${issued}), big ${J(cost?.big)} · put back: ${back ?? 'yes'}, v${T.v}`); }

      // the switch off: the build before's rows, and `big` inert
      { K.BIGSLOT.on = false; K.kitLoad(null, '');
        const f = fields(1), walls = f.includes('walls'), want = ['weapon', 'suppressed', 'light', 'nvg', 'bangs', 'smoke', 'charges', ...(walls ? ['walls'] : []), 'frags', ...(f.includes('wand') ? ['wand'] : []) /* (a teammate's optical wand: a row of his card while WAND.mate is on, no affair of the big slot's) */, 'shield', 'suit', 'trim'];
        const guns = [0, 1].map(i => (rowOf(i, 'weapon').values as string[]).join('/')), cost = K.kitCost(1);
        F.verdict(f.join() === want.join() && guns.every(g => g === 'rifle/pistol/shotgun') && !fields(0).includes('big') && cost.big === null,
          'THE SWITCH OFF: a teammate\'s rows are the build before\'s to the row, the weapon row offers the shotgun (yours too), and no card has a big row or a big slot to count', `Red One: ${f.join(' ')} · weapon rows ${guns.join(' · ')} · you: ${fields(0).join(' ')} · kitCost(1).big ${J(cost.big)}`);
        const st = memStore({ [K.KIT_LS]: J({ v: 2, members: [0, 1, 2, 3, 4].map(i => (i === 1 ? { ...K.kitDefault(1), big: 'hammer' } : i === 2 ? { ...K.kitDefault(2), weapon: 'shotgun' } : K.kitDefault(i))) }) });
        K.kitLoad(st, ''); const off = { ...K.KIT.members[1] }, gun2 = { ...K.KIT.members[2] }, issued = K.kitCost(1, K.kitDefault(1)).used, used = K.kitCost(1).used, words = K.kitWords(1);
        const wrote = K.kitSet(1, 'light', !off.light), stored = JSON.parse(st.m.get(K.KIT_LS) ?? '{}').members?.[1]?.big;
        K.BIGSLOT.on = true; K.kitLoad(memStore(Object.fromEntries(st.m)), ''); const back = K.KIT.members[1].big;
        F.verdict(off.big === 'hammer' && used === issued && !/hammer/.test(words) && gun2.weapon === 'shotgun' && gun2.big === 'none' && wrote && stored === 'hammer' && back === 'hammer',
          'a stored `big` read with the switch off is kept on the card, inert — no pouch, no word of it — a stored shotgun stays that man\'s gun, a row changed on that visit does not write the big thing out of the store, and the switch on again finds it', `off: big ${off.big}, pouches ${used} (issued ${issued}), "${words}" · Red Two: weapon ${gun2.weapon}, big ${gun2.big} · after a row changed the store has ${stored} · switch on again: ${back}`); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

/** an entry order on d as the menu's row gives it — and, where the stand halts an entry at a door found shut (DOORTOOLS.testDoor, the page's: "your call"),
 *  the same row again, which is the order that takes the lock. Stepped until the lock is off, the order is refused or over, or `cap` seconds. */
function enter(R: Rig, d: any, cap = 45) {
  const give = (): string | null => R.O.give('openClear', R.O.targetAt(d.frameCentre)), last = () => R.D.done[R.D.done.length - 1];
  const t0 = R.game.time; let w = give(), again = false, tGive = t0;
  R.until(() => { if (!d.locked || typeof w === 'string') return true; if (R.D.ops.length || R.game.time - tGive < 0.5) return false;
    if (!again && last()?.ended === 'found shut') { again = true; w = give(); tGive = R.game.time; return false; } return true; }, cap);
  return { t0, w, again, gone: !d.locked && !!d.lockBroken, secs: d.locked ? NaN : R.game.time - t0, ended: R.D.ops.length ? '' : String(last()?.ended ?? '') };
}

// ───────────────────────────────────────────────────────────── off
export async function bigOff(): Promise<boolean> {
  const F = family('bigslot-off: the switch off is the build as it was — no row, no carrier, the same run');
  await kept(async () => {
    try {
      // you: a tool forced onto the Player by hand
      { const R = await rig(21, { stage: false, on: false }), g = R.game, pl = g.player, d = R.door('storage'); g.aiEnabled = false;
        const spot = doorPt(d, d.def.width / 2, 0.75, faceOf(g, d, 'push')); if (!g.doors.lockedOut(d, spot, pl.keys)) lockAgainst(g, d, spot);
        g.teleportPlayer(spot); R.step(12); const bare = rowsOf(g), out = g.doors.lockedOut(d, spot, pl.keys);
        pl.bigKit = 'hammer'; R.step(3); const ham = rowsOf(g), a = BK.samBig(g, d); pl.bigKit = 'shotgun'; R.step(3); const gun = rowsOf(g), b = BK.samBig(g, d);
        K.BIGSLOT.on = true; R.step(3); const on = rowsOf(g); K.BIGSLOT.on = false; R.step(3);
        F.verdict(out && bare.includes('kick') && ham.join() === bare.join() && gun.join() === bare.join() && a === null && b === null && on.includes('breach') && !on.includes('kick'),
          'the switch off, bigKit forced to the hammer and then the shotgun on a Player at a door locked against him: the rows are the rows he had, the boot among them (the same man with the switch raised is offered the shotgun in its place)', `locked against him ${out} · bare: ${bare.join(' ')} · hammer forced: ${ham.join(' ')} · shotgun forced: ${gun.join(' ')} · switch on: ${on.join(' ')}`); }
      // the squad: cards that say hammer and shotgun, staged with the switch off, against the cards as issued
      const run = async (cards: Record<number, Record<string, unknown>>, forced: boolean) => {
        const R = await rig(8, { cards, on: false }), g = R.game, d = R.door('manager'); g.teleportPlayer(SAM_MANAGER); R.step(5); if (forced) g.player.bigKit = 'hammer';
        const big = R.ops.map((m: any) => K.kitBig(m) as string), ham = R.ops.map((m: any) => BK.carriesHammer(m) as boolean), you = forced ? 'forced' : g.player.bigKit, st = stats();
        const e = enter(R, d); R.step(60 * 4);
        return { h: hashDigest(digestGame(g, true)), big, ham, you, e, st: since(st), kicks: R.D.stats.kicks as number, guns: R.ops.map((m: any) => m.weapon.def.id as string), beats: R.beats(e.t0) };
      };
      const a = await run({}, false), b = await run({ 0: { big: 'shotgun' }, 1: { big: 'hammer' }, 2: { big: 'shotgun' } }, true);
      F.verdict(b.big.every(x => x === 'none') && b.ham.every(x => !x) && Object.values(b.st).every(n => n === 0) && b.kicks === 1 && b.e.gone && b.guns.every(x => x !== 'm870'),
        'staged with the switch off, men whose cards say hammer and shotgun carry neither (kitBig none): the locked manager\'s door is the boot\'s, and nothing of bigkit.ts ran', `kitBig ${b.big.join(', ')} · carries a hammer ${b.ham.join(', ')} · counters ${J(b.st)} · door tools' kicks ${b.kicks} · lock off ${b.e.gone} · ${b.beats}`);
      F.verdict(a.h === b.h && a.e.gone, 'and that run — the order, the boot, four seconds of the room behind it — digests the same as with every card as issued and nothing forced', `as issued ${a.h} · big slots filled, the hammer forced on you ${b.h}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── you
/** the plain night, the tool on your card and put on you by the card (kitSolo), you at arm's length off the middle of `door`'s leaf on `face`, the row
 *  performed and three seconds given it. `lock`: a wedge put under the leaf by hand. */
async function you(seed: number, tool: 'shotgun' | 'hammer', face: 'push' | 'pull', o: { door?: string; lock?: string; open?: boolean; old?: boolean } = {}) {
  const R = await rig(seed, { stage: false, cards: { 0: { big: tool } }, old: o.old }), g = R.game, pl = g.player, d = R.door(o.door ?? 'storage'); g.aiEnabled = false;
  const raised = face === 'pull' && frameUp(g), verb = tool === 'shotgun' ? 'breach' : 'hammer';
  // (a steel door: the face its lock is against, as the level keys it — a boot rings off either)
  const steel = !!d.def.steel, side = steel ? ([1, -1] as const).find(s => g.doors.side(d, doorPt(d, d.def.width / 2, 0.75, s)) === d.keySide) ?? 1 : faceOf(g, d, face), spot = doorPt(d, d.def.width / 2, 0.75, side);
  const keyed = !o.open && (!g.doors.lockedOut(d, spot, pl.keys) || !!o.lock); if (keyed) lockAgainst(g, d, spot, o.lock);
  if (o.open) { d.angle = 0; d.vel = 0; d.latched = true; d.locked = false; d.lockBroken = false; }   // (`open`: shut on its latch and NOT locked, by hand)
  g.teleportPlayer(spot); R.step(12); const bare = rowsOf(g);
  K.kitSolo(g); R.step(3); const carried = pl.bigKit as string, rows = rowsOf(g);
  const out = g.doors.lockedOut(d, spot, pl.keys) as boolean, held = g.doors.bootHolds(d, spot) as boolean, offered = BK.samBig(g, d) as string | null;
  const k = bare.indexOf('kick'), inPlace = rows.includes(verb) && !rows.includes('kick') && (k >= 0 ? rows.length === bare.length && rows.every((v, i) => (i === k ? v === verb : v === bare[i])) : rows.filter(v => v !== verb).join() === bare.join());
  const st = stats(), t0 = g.time, said0 = R.said.length, blows = BK.hammerBlows(g, d, spot) as number, picked = g.selectVerb('door', verb); if (picked) { R.input.pressed.add('Space'); R.step(); }
  const began = pl.kick?.tool?.kind === tool, need = (pl.kick?.tool?.need ?? NaN) as number;
  // where he stands when the first blow lands or the first shell goes, as metres along the leaf from its hinge (0‥width = in the opening)
  let at: number[] | null = null; R.post = () => { if (!at && BIG_STATS.samBlows + BIG_STATS.samShells > st.samBlows + st.samShells) at = [...pl.char.pos]; };
  const given = () => (o.open ? !d.latched || !!d.lockBroken : !d.locked);
  R.until(given, 3); const secs = given() ? g.time - t0 : NaN; R.until(() => !pl.kick, 2); R.step(6); R.post = null;
  const p0 = doorPt(d, 0, 0, side), p1 = doorPt(d, 1, 0, side), along = at ? (at[0] - p0[0]) * (p1[0] - p0[0]) + (at[2] - p0[2]) * (p1[2] - p0[2]) : NaN, beside = along < -0.05 || along > d.def.width + 0.05;
  const home0 = d.isClosed() as boolean, angle0 = d.angle as number; if (!home0) R.until(() => Math.abs(d.angle) > 0.5, 2); const endsOpen = Math.abs(d.angle) > 0.5;
  const res = { R, g, d, raised, keyed, steel, carried, bare, rows, out, held, offered, inPlace, picked, began, need, blows, secs, gone: !d.locked && !!d.lockBroken, st: since(st), t0,
    shots: R.ev.filter(e => e.t >= t0 && (e.kind === 'shot' || e.kind === 'guardShot')), kicks: R.ev.filter(e => e.t >= t0 && e.kind === 'kick').length,
    thuds: R.ev.filter(e => e.t >= t0 && e.kind === 'door' && e.loud && e.t < t0 + (Number.isFinite(secs) ? secs : 3) - 1e-6).length, said: R.said.slice(said0),
    home: home0, angle: endsOpen ? d.angle as number : angle0, after: rowsOf(g), hand: '', opened: false, along, beside, endsOpen };
  if (face === 'pull' && !steel && home0 && !o.open) { const hand = res.after.find(v => v === 'pull' || v === 'push'); if (hand && g.selectVerb('door', hand)) { res.hand = hand; R.input.pressed.add('Space'); R.step(); R.until(() => Math.abs(d.angle) > 0.5, 2); res.opened = Math.abs(d.angle) > 0.5; } }
  return res;
}
/** the control for the hammer's HUD line: the same door, the same face, no tool on him and no beat running — a boot of his landed on the leaf (doors.ts
 *  kickIn called by hand: the kick row itself declines at that face, 'a boot will not shift it', and throws none), and what the HUD is told of its thud */
async function bareBoot(seed: number) {
  const R = await rig(seed, { stage: false }), g = R.game, d = R.door('storage'); g.aiEnabled = false; frameUp(g);
  const spot = doorPt(d, d.def.width / 2, 0.75, faceOf(g, d, 'pull')); lockAgainst(g, d, spot); g.teleportPlayer(spot); R.step(12);
  const t0 = g.time, n0 = R.said.length, gave = g.doors.kickIn(d, g.player.char.pos, PLAYER_ID) as boolean; R.step(6);
  return { said: R.said.slice(n0), thud: !gave && R.ev.some(e => e.t >= t0 && e.kind === 'door' && e.loud), locked: d.locked as boolean };
}
const byHand = (r: { keyed: boolean; raised: boolean }) => [r.keyed ? 'the lock keyed to this face BY HAND (the office keys its doors to the other)' : '', r.raised ? 'the frame rule raised BY HAND (the frozen stand holds it off)' : ''].filter(Boolean).join(' · ') || 'the door as the level has it';
export async function bigYou(): Promise<boolean> {
  const F = family('bigslot-you: your big slot\'s tool at a door locked against you — the shotgun or the hammer in the boot\'s place, from either face');
  await kept(async () => {
    try {
      for (const face of ['push', 'pull'] as const) {
        const where = face === 'push' ? 'the face the leaf opens AWAY from' : 'the face the leaf opens TOWARD (the frame holds a boot)';
        { const r = await you(31, 'shotgun', face);
          F.verdict(r.carried === 'shotgun' && r.out && r.held === (face === 'pull') && r.inPlace && r.offered === 'shotgun' && r.picked && r.began,
            `YOU, THE SHOTGUN, ${where}: your card puts it on you, and the storage door's rows have 'shoot the lock off' in the boot's place — performed, a committed beat`, `${byHand(r)} · on you ${r.carried} · locked against you ${r.out} · a boot held by the frame ${r.held} · without it: ${r.bare.join(' ')} · with it: ${r.rows.join(' ')} · began ${r.began}`);
          F.verdict(r.gone && r.secs <= 3 && r.st.samShot === 1 && r.st.samShells >= 1, 'the lock is gone inside three seconds, shot off', `lock off ${!r.d.locked}, keep broken ${!!r.d.lockBroken} after ${f2(r.secs)} s · shells ${r.st.samShells}, locks shot ${r.st.samShot}${BROKEN ? ' · BIGKIT_BREAK=1' : ''}`);
          F.verdict(r.shots.some(e => e.kind === 'shot' && e.weapon === 'm870' && e.loud), 'and it is heard as GUNFIRE: a loud \'shot\' of the m870 among the game\'s events', `events: ${r.R.evs(r.t0, ['shot', 'guardShot', 'kick'])}`);
          if (face === 'push') F.verdict(!r.d.latched && Math.abs(r.angle) > 0.5, 'from that face the leaf is flung in, as after the boot', `latched ${r.d.latched}, angle ${f2(r.angle)}`);
          else F.verdict(r.gone && r.endsOpen && r.hand === '', 'from that face nothing flings the leaf — the same hands pull it open: the door ENDS OPEN, no second press (BIGSLOT.shut)', `open ${r.endsOpen} (angle ${f2(r.d.angle)}) · a second row pressed: ${r.hand || 'none'}`);
          F.verdict(r.began && r.beside, 'and it is worked from BESIDE the latch jamb, out of the opening (BIGSLOT.beside)', `he stood ${f2(r.along)} m along a ${f2(r.d.def.width)} m leaf from its hinge when it went`); }
        { const r = await you(32, 'hammer', face);
          F.verdict(r.carried === 'hammer' && r.out && r.held === (face === 'pull') && r.inPlace && r.offered === 'hammer' && r.picked && r.began,
            `YOU, THE HAMMER, ${where}: your card puts it on you, and the rows have 'hammer it open' in the boot's place — performed, a committed beat`, `${byHand(r)} · on you ${r.carried} · locked against you ${r.out} · a boot held by the frame ${r.held} · without it: ${r.bare.join(' ')} · with it: ${r.rows.join(' ')} · began ${r.began}`);
          F.verdict(r.gone && r.secs <= 3 && r.st.samHammered === 1, 'the lock is gone inside three seconds, hammered', `lock off ${!r.d.locked}, keep broken ${!!r.d.lockBroken} after ${f2(r.secs)} s · hammered ${r.st.samHammered}${BROKEN ? ' · BIGKIT_BREAK=1' : ''}`);
          const want = face === 'pull' ? K.BIGSLOT.swings : 1, lead = K.BIGSLOT.moves ? K.BIGSLOT.equip : 0, onTime = face === 'pull' ? r.secs >= lead + BK.bigWind() + BK.bigSwing() * (want - 1) - DT : r.secs <= lead + BK.bigWind() + 0.1;   // (BIGSLOT.moves: the hammer comes off his back first — BIGSLOT.equip)
          F.verdict(r.st.samBlows === want && r.need === want && r.blows === want && K.BIGSLOT.swings === 2 && r.thuds === want - 1 && onTime && r.kicks >= 1 && r.shots.length === 0 && r.st.samShells === 0,
            face === 'push' ? 'in ONE BLOW, where a boot would do — off his back and wound up (BIGSLOT.equip, then the wind-up of bigWind()), no thud before it — loud as the boot and never gunfire: a \'kick\' among the game\'s events and no shot' : 'in TWO BLOWS (BIGSLOT.swings), where the frame holds a boot — the first a thud in the frame — loud as the boot and never gunfire: a \'kick\' among the game\'s events and no shot',
            `blows ${r.st.samBlows} (the beat's need ${r.need}, hammerBlows ${r.blows}; BIGSLOT.swings ${K.BIGSLOT.swings}, windup ${K.BIGSLOT.windup}, swing ${K.BIGSLOT.swing}) · thuds before the lock went ${r.thuds} · events: ${r.R.evs(r.t0, ['shot', 'guardShot', 'kick', 'door'])}`);
          if (face === 'pull') { const boot = await bareBoot(37), took = /frame took the boot/;
            F.verdict(r.thuds >= 1 && !r.said.some(t => took.test(t)) && boot.thud && boot.said.some(t => took.test(t)) && boot.locked,
              'NO FALSE HUD LINE: through that beat — its first blow a thud in the frame, raised as yours — the HUD is never told \'the frame took the boot\' (a boot of his landed there by hand with no tool\'s beat running is)', `the hammer's beat: thuds ${r.thuds}, said: ${r.said.map(t => `"${t}"`).join(' ') || 'nothing'} · a boot landed there by hand (doors.kickIn): said ${boot.said.map(t => `"${t}"`).join(' ') || 'nothing'}, still locked ${boot.locked}`); }
          if (face === 'push') F.verdict(!r.d.latched && Math.abs(r.angle) > 0.5, 'from that face the leaf is flung in, as after the boot', `latched ${r.d.latched}, angle ${f2(r.angle)}`);
          else F.verdict(r.gone && r.endsOpen && r.hand === '', 'from that face nothing flings the leaf — the same hands pull it open: the door ENDS OPEN, no second press (BIGSLOT.shut)', `open ${r.endsOpen} (angle ${f2(r.d.angle)}) · a second row pressed: ${r.hand || 'none'}`);
          F.verdict(r.began && r.beside, 'and it is worked from BESIDE the latch jamb, out of the opening (BIGSLOT.beside)', `he stood ${f2(r.along)} m along a ${f2(r.d.def.width)} m leaf from its hinge when it went`); }
      }
      // a wedge under the leaf (set by hand: lockId 'wedge:storage', as digin.ts writes one — no defender of the plain night wedges a door)
      { const gun = await you(33, 'shotgun', 'push', { lock: 'wedge:storage' }), ham = await you(34, 'hammer', 'push', { lock: 'wedge:storage' });
        F.verdict(gun.out && gun.carried === 'shotgun' && !gun.rows.includes('breach') && gun.offered === null && gun.rows.join() === gun.bare.join() && !gun.began && gun.st.samShells === 0 && gun.d.locked,
          'a WEDGED door (the wedge set by hand) offers the shotgun nothing: a wedge at the leaf\'s foot is no keep — his rows are the rows he had', `locked against him ${gun.out} · lock '${gun.d.lockId}' · without it: ${gun.bare.join(' ')} · with it: ${gun.rows.join(' ')} · shells ${gun.st.samShells}`);
        F.verdict(ham.out && ham.rows.includes('hammer') && ham.began, '… and offers the hammer its row', `without it: ${ham.bare.join(' ')} · with it: ${ham.rows.join(' ')} · began ${ham.began}`);
        F.verdict(ham.gone && ham.secs <= 3 && ham.st.samBlows === 1 && ham.need === 1 && ham.st.samHammered === 1 && ham.shots.length === 0, 'the wedged door gives to the hammer: the lock is gone in its one blow (the face a boot would do at), no shot', `lock off ${!ham.d.locked}, broken ${!!ham.d.lockBroken} after ${f2(ham.secs)} s · blows ${ham.st.samBlows} · events: ${ham.R.evs(ham.t0, ['shot', 'guardShot', 'kick'])}${BROKEN ? ' · BIGKIT_BREAK=1' : ''}`); }
      // steel
      { const gun = await you(35, 'shotgun', 'push', { door: 'stairwell' }), ham = await you(36, 'hammer', 'push', { door: 'stairwell' });
        const none = (r: typeof gun) => r.steel && r.out && r.carried !== 'none' && r.offered === null && !r.rows.includes('breach') && !r.rows.includes('hammer') && r.rows.join() === r.bare.join() && !r.began && r.d.locked && !r.d.lockBroken;
        F.verdict(none(gun) && none(ham) && gun.st.samShells === 0 && ham.st.samBlows === 0, 'a STEEL door (the stair door, locked against him as the level has it) offers neither: his rows are the rows he had, and nothing is spent on it', `shotgun carried: ${gun.rows.join(' ')} (bare ${gun.bare.join(' ')}) · hammer carried: ${ham.rows.join(' ')} (bare ${ham.bare.join(' ')}) · locked against him ${gun.out}/${ham.out} · still locked ${gun.d.locked}/${ham.d.locked}`); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── a teammate
export async function bigMate(): Promise<boolean> {
  const F = family('bigslot-mate: a teammate\'s big slot on a door order — the shotgun up for the lock and slung after, the hammer\'s blows');
  await kept(async () => {
    try {
      const SEED = 8;   // (the seed tools/qa/shotgun-probes.ts takes this door on: the pair lives to the lock either way)
      // the shotgun: his rifle his own, the M870 up for the lock, his rifle back
      { const R = await rig(SEED, { cards: { 1: { big: 'shotgun' } } }), g = R.game, d = R.door('manager'), [gd, other] = R.ops; g.teleportPlayer(SAM_MANAGER); R.step(5);
        const own = gd.weapon.def.id as string, big = K.kitBig(gd) as string, bigOther = K.kitBig(other) as string, locked = d.locked && d.latched, st = stats();
        let tOut = NaN, inHand = '';
        R.post = () => { if (isNaN(tOut) && gd.slung?.out) { tOut = g.time; inHand = gd.weapon.def.id; } };
        const e = enter(R, d), tGone = g.time; R.step(15); R.post = null;
        const now = gd.weapon.def.id as string, out = !!gd.slung?.out, by = st, s = since(by), shell = R.ev.filter(x => x.t >= e.t0 && x.kind === 'guardShot' && x.weapon === 'm870' && x.who === gd.char.id).length;
        F.verdict(R.why === null && locked && own !== 'm870' && gd.route.weapon !== 'm870' && big === 'shotgun' && bigOther === 'none' && g.player.bigKit === 'none',
          'A TEAMMATE, THE SHOTGUN: staged with it in his card\'s big slot he holds his own gun — the shotgun is kit (kitBig), and nobody else carries one', `${gd.callsign}: ${own}, big slot ${big} · ${other.callsign}: ${other.weapon.def.id}, big slot ${bigOther} · you: ${g.player.bigKit}`);
        F.verdict(e.w === null && s.drawn === 1 && inHand === 'm870' && tGone - tOut >= K.BIGSLOT.draw - DT, `open and clear on the locked manager's door${e.again ? ' (the stand halts an entry at a door found shut: the row given again, as the lead\'s "your call" asks)' : ''}: he brings the M870 up off its sling, and no shell goes before it has been up its beat`, `give: ${e.w ?? 'taken'} · drawn ${s.drawn} · in his hands ${inHand} from ${f2(tOut - e.t0)} s · the lock went ${f2(tGone - tOut)} s later (BIGSLOT.draw ${K.BIGSLOT.draw})`);
        F.verdict(e.gone && shell >= 1 && R.D.stats.kicks === 0, 'the lock is gone, shot off — his shell, and no boot', `lock off ${!d.locked}, keep broken ${!!d.lockBroken} at ${f2(e.secs)} s · his m870 shells heard ${shell} · door tools: shot ${R.D.stats.shot}, kicks ${R.D.stats.kicks}${BROKEN ? ' · BIGKIT_BREAK=1' : ''} · ${R.beats(e.t0)}`);
        F.verdict(e.gone && now === own && !out && gd.route.weapon !== 'm870' && s.slung === 1, 'and a quarter of a second after it his own gun is in his hands again, the shotgun slung', `now ${now} (his ${own}), out ${out}, slung ${s.slung}`); }
      // the order taken away, and another given, with the gun up
      { const R = await rig(SEED, { cards: { 1: { big: 'shotgun' } } }), g = R.game, d = R.door('manager'), gd = R.ops[0]; g.teleportPlayer(SAM_MANAGER); R.step(5);
        const own = gd.weapon.def.id as string, target = () => R.O.targetAt(d.frameCentre), last = () => R.D.done[R.D.done.length - 1];
        /** the row given (again where the stand halts at a door found shut) and stepped until the gun is up or the lock is off */
        const up = () => { let w = R.O.give('openClear', target()), again = false, t = g.time;
          R.until(() => { if (gd.slung?.out || !d.locked || typeof w === 'string') return true; if (!R.D.ops.length && g.time - t > 0.5 && !again && last()?.ended === 'found shut') { again = true; w = R.O.give('openClear', target()); t = g.time; } return false; }, 45);
          return !!gd.slung?.out && gd.weapon.def.id === 'm870' && d.locked; };
        const up1 = up(); R.O.clear(); R.step(2); const a = { gun: gd.weapon.def.id as string, out: !!gd.slung?.out, route: gd.route.weapon as string };
        const up2 = up(); const w = R.O.give('fallIn', target()); R.step(2); const b = { gun: gd.weapon.def.id as string, out: !!gd.slung?.out, route: gd.route.weapon as string };
        R.step(60); const still = d.locked && gd.weapon.def.id === own;
        F.verdict(up1 && a.gun === own && !a.out && a.route !== 'm870', 'the order TAKEN AWAY with the M870 up and no shell gone: two frames on, his own gun is back in his hands', `up ${up1} · after the squad's orders were cleared: ${a.gun} (his ${own}), out ${a.out}, route ${a.route}`);
        F.verdict(up2 && w === null && b.gun === own && !b.out && b.route !== 'm870' && still, 'the same door again, and ANOTHER ORDER given him with it up (fall in): two frames on, his own gun; the lock was never shot', `up ${up2} · fall in: ${w ?? 'taken'} · ${b.gun}, out ${b.out}, route ${b.route} · a second later: locked ${d.locked}, ${gd.weapon.def.id}`); }
      // the hammer
      { const R = await rig(SEED, { cards: { 1: { big: 'hammer' } } }), g = R.game, d = R.door('manager'), gd = R.ops[0]; g.teleportPlayer(SAM_MANAGER); R.step(5);
        const own = gd.weapon.def.id as string, big = K.kitBig(gd) as string, st = stats(); let m870 = false; R.post = () => { m870 ||= gd.weapon.def.id === 'm870'; };
        const e = enter(R, d), tGone = g.time; R.step(15); R.post = null;
        const s = since(st), shots = R.ev.filter(x => x.t >= e.t0 && x.t <= tGone + 1e-6 && (x.kind === 'shot' || x.kind === 'guardShot')), kicks = R.ev.filter(x => x.t >= e.t0 && x.t <= tGone + 1e-6 && x.kind === 'kick' && x.who === gd.char.id).length;
        F.verdict(R.why === null && big === 'hammer' && BK.carriesHammer(gd) && own !== 'm870' && e.w === null && s.mateBlows === 1 && !/hammer: a blow/.test(R.beats(e.t0)),
          `A TEAMMATE, THE HAMMER: staged with it in his card's big slot and ordered onto the locked manager's door${e.again ? ' (the row given again after the halt)' : ''}, he lands ONE blow — the face a boot would do at`, `${gd.callsign}: ${own}, big slot ${big} · give: ${e.w ?? 'taken'} · blows ${s.mateBlows} · ${R.beats(e.t0)}`);
        F.verdict(e.gone && s.mateHammered === 1 && R.D.stats.kicks === 0, 'the lock is gone, hammered — that blow\'s, and no boot after it', `lock off ${!d.locked}, keep broken ${!!d.lockBroken} at ${f2(e.secs)} s · hammered ${s.mateHammered} · door tools' kicks ${R.D.stats.kicks}${BROKEN ? ' · BIGKIT_BREAK=1' : ''}`);
        F.verdict(shots.length === 0 && s.drawn === 0 && !m870 && kicks >= 1, 'no shot from the order to the lock going: loud as the boot (his \'kick\' among the events), never gunfire — and no shotgun ever in his hands', `shots before the lock went ${shots.length} · his 'kick' events ${kicks} · drawn ${s.drawn} · an m870 in his hands ${m870}`); }
      // the face the leaf opens toward. The break room's north door from inside the room: shut and locked against the squad by hand — and the room's
      // defenders taken off the floor first (the stack would stand among them: the fight is the room fight's dice, not this check's)
      { const pull = async (tool: string, lockId?: string, silent = false) => {
          const R = await rig(SEED, { cards: tool === 'none' ? {} : { 1: { big: tool } } }), g = R.game, d = R.door('breakroom_n'), gd = R.ops[0], raised = frameUp(g);
          await hushed(() => { for (const h of R.NB.hostiles) if (h.state !== 'dead') killGuard(g, h, [1, 0, 0], true); R.step(60); });
          const sam = doorPt(d, d.def.width + 1.2, 1.4, faceOf(g, d, 'pull')); lockAgainst(g, d, sam, lockId); g.teleportPlayer(sam); R.step(5);
          const switched = silent && !SIL.SILENT.on; if (silent) { SIL.SILENT.on = true; SIL.setSilent(g, true); R.step(2); }   // (the squad's silent order — its switch is held off on the frozen stand: raised by hand)
          const quiet = SIL.squadSilent(g) as boolean, held = g.doors.bootHolds(d, sam) as boolean, st = stats(), e = enter(R, d); R.until(() => Math.abs(d.angle) > 0.5, 4); R.step(15);
          return { R, d, gd, raised, switched, quiet, held, e, refused: typeof e.w === 'string' ? e.w : e.ended, s: since(st), open: Math.abs(d.angle) > 0.5, gun: gd.weapon.def.id as string, out: !!gd.slung?.out, shove: /shove|pull/.test(R.beats(e.t0)), kicks: R.D.stats.kicks as number, picks: R.D.stats.picks as number };
        };
        const none = await pull('none', 'wedge:breakroom_n'), ham = await pull('hammer', 'wedge:breakroom_n'), gun = await pull('shotgun');
        const hand = `set BY HAND: the leaf shut and locked against the squad from inside the room, the room's defenders taken off the floor${ham.raised ? ', the frame rule raised (the frozen stand holds it off)' : ''}`;
        F.verdict(none.held && none.d.locked && !none.open && (typeof none.e.w === 'string' ? /no boot/.test(none.e.w) : /no boot/.test(none.e.ended)) && Object.values(none.s).every(n => n === 0),
          'A DOOR LOCKED ON THE FACE IT OPENS TOWARD, wedged (no pick opens it), nobody carrying a tool: the entry is refused as it always was', `${hand} · the frame holds a boot ${none.held} · give: ${none.e.w ?? 'taken'} · ended: ${none.e.ended || '-'} · still locked ${none.d.locked}`);
        F.verdict(ham.held && ham.e.w === null && ham.e.gone && ham.s.mateBlows === K.BIGSLOT.swings && K.BIGSLOT.swings === 2 && /hammer: a blow/.test(ham.R.beats(ham.e.t0)) && ham.s.mateHammered === 1 && ham.kicks === 0,
          'the same door with a hammer in the stack is NOT refused: two blows (BIGSLOT.swings, where the frame holds a boot) and the lock is gone', `give: ${ham.e.w ?? 'taken'} · lock off ${!ham.d.locked}, broken ${!!ham.d.lockBroken} at ${f2(ham.e.secs)} s · blows ${ham.s.mateBlows}, hammered ${ham.s.mateHammered}${BROKEN ? ' · BIGKIT_BREAK=1' : ''} · ${ham.R.beats(ham.e.t0)}`);
        F.verdict(ham.e.gone && ham.open, '… and the leaf, left home in its frame by the blow, is then opened by hand and the entry goes on', `angle ${f2(ham.d.angle)} · open ${ham.open}`);
        F.verdict(gun.held && gun.e.w === null && gun.e.gone && gun.s.drawn === 1 && gun.s.slung === 1 && gun.picks === 0 && gun.open && gun.gun !== 'm870' && !gun.out,
          'a keyed lock on that face with the SHOTGUN in the stack: shot off from the face the leaf opens toward (no pick), the leaf pulled by hand, his own gun back', `give: ${gun.e.w ?? 'taken'} · lock off ${!gun.d.locked}, broken ${!!gun.d.lockBroken} at ${f2(gun.e.secs)} s · drawn ${gun.s.drawn}, slung ${gun.s.slung} · picks ${gun.picks} · open ${gun.open} · now ${gun.gun}${BROKEN ? ' · BIGKIT_BREAK=1' : ''} · ${gun.R.beats(gun.e.t0)}`);
        // a SILENT squad's loud tools stay slung (silent.ts): the same wedged door, hammer in the stack or not, is refused in the same words
        const qNone = await pull('none', 'wedge:breakroom_n', true), qHam = await pull('hammer', 'wedge:breakroom_n', true);
        F.verdict(qNone.quiet && qHam.quiet && qHam.held && BK.carriesHammer(qHam.gd) && qHam.d.locked && !qHam.open && qNone.d.locked && /no boot|silent|quiet/i.test(qHam.refused) && qHam.refused === qNone.refused && Object.values(qHam.s).every(n => n === 0) && qHam.kicks === 0,
          'the squad told SILENT, a hammer man in the stack, that wedged door: refused exactly as with no tool — the same words, no blow, the lock whole', `${qHam.switched ? 'the silent order\'s switch raised BY HAND (the frozen stand holds it off) · ' : ''}silent ${qNone.quiet}/${qHam.quiet} · no tool: "${qNone.refused}" · a hammer: "${qHam.refused}" · blows ${qHam.s.mateBlows} · still locked ${qHam.d.locked} · ${qHam.R.beats(qHam.e.t0) || 'no order ran'}`); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── any shut door, from beside the frame
/** the room clear, `tool` on the first teammate's card, and the big slot's own row on a door: the manager's from the corridor (the face the leaf opens AWAY
 *  from) or the break room's north door from inside the room (the face it opens TOWARD — its defenders taken off the floor first, as bigMate does). The door
 *  NOT locked unless `lock` says so (by hand either way). `key`: the row given as the page gives it — the menu opened on the door, then H; else by its id
 *  (`order`: another row's). Stepped until the door stands open, the order is refused or over. */
async function mateShut(tool: 'none' | 'hammer' | 'shotgun', o: { face?: 'push' | 'pull'; lock?: boolean | string; order?: string; key?: boolean; silent?: boolean; old?: boolean; nosnug?: boolean; /** called after every frame from the order on (the moves' family) */ watch?: (R: Rig, gd: any, d: any) => void } = {}) {
  const R = await rig(8, { cards: tool === 'none' ? {} : { 1: { big: tool } }, old: o.old, nosnug: o.nosnug }), g = R.game, pullFace = o.face === 'pull', d = R.door(pullFace ? 'breakroom_n' : 'manager'), gd = R.ops[0];
  const raised = pullFace && frameUp(g);
  if (pullFace) await hushed(() => { for (const h of R.NB.hostiles) if (h.state !== 'dead') killGuard(g, h, [1, 0, 0], true); R.step(60); });
  const sam = pullFace ? doorPt(d, d.def.width + 1.2, 1.4, faceOf(g, d, 'pull')) : SAM_MANAGER;
  if (o.lock) lockAgainst(g, d, sam, typeof o.lock === 'string' ? o.lock : undefined); else { d.angle = 0; d.vel = 0; d.latched = true; d.locked = false; d.lockBroken = false; }
  g.teleportPlayer(sam); R.step(5);
  const switched = !!o.silent && !SIL.SILENT.on; if (o.silent) { SIL.SILENT.on = true; SIL.setSilent(g, true); R.step(2); }
  const st = stats(), t0 = g.time, target = () => R.O.targetAt(d.frameCentre), id = o.order ?? 'bigClear';
  let w: string | null = null, shown = '', menuDown = true;
  if (o.key) { const up = R.O.open(target()); R.step(2); shown = ((R.O.hud().menu?.rows ?? []) as any[]).flatMap(r => r.opts.map((x: any) => `${x.key ? `[${x.key}] ` : ''}${x.text}`)).join(' | ');
    R.input.pressed.add('KeyH'); R.step(); menuDown = !R.O.menu; if (!up || !menuDown) w = 'the menu took no H'; }
  else w = R.O.give(id, target());
  const big = R.D.ops.some((op: any) => op.big);
  if (o.watch) R.post = () => o.watch!(R, gd, d);
  R.until(() => typeof w === 'string' || Math.abs(d.angle) > 0.5 || (!R.D.ops.length && g.time - t0 > 0.5), 30); const secs = g.time - t0; R.step(o.watch ? 80 : 20); R.post = null;
  const beats = R.beats(t0), last = R.D.done[R.D.done.length - 1], trips = (beats.match(/(?:^|\| )[\d.]+ (?:hammer|gun):/g) ?? []).length;
  return { R, g, d, gd, raised, switched, w, shown, menuDown, big, secs, beats, trips, s: since(st), open: Math.abs(d.angle) > 0.5, broken: !!d.lockBroken, locked: d.locked as boolean, ended: R.D.ops.length ? '' : String(last?.ended ?? ''),
    kicks: R.D.stats.kicks as number, gun: gd.weapon.def.id as string, out: !!gd.slung?.out, shell: R.ev.filter(x => x.t >= t0 && x.kind === 'guardShot' && x.weapon === 'm870').length, mateKick: R.ev.filter(x => x.t >= t0 && x.kind === 'kick' && x.who === gd.char.id).length };
}
export async function bigShut(): Promise<boolean> {
  const F = family('bigslot-shut: the tools open ANY shut door, from beside the frame, and the door ends open — yours on the door\'s rows, the squad\'s on H');
  await kept(async () => {
    try {
      const B = BROKEN ? ' · BIGKIT_BREAK=1' : '';
      // YOU, a door that is not locked
      for (const tool of ['hammer', 'shotgun'] as const) for (const face of ['push', 'pull'] as const) {
        const r = await you(tool === 'hammer' ? 41 : 42, tool, face, { open: true }), verb = tool === 'shotgun' ? 'breach' : 'hammer', n = r.bare.length;
        const where = face === 'push' ? 'the face the leaf opens AWAY from' : 'the face it opens TOWARD';
        F.verdict(!r.out && r.carried === tool && r.offered === tool && n > 0 && r.rows.slice(0, n).join() === r.bare.join() && r.rows.length === n + 1 && r.rows[n] === verb,
          `YOU, THE ${tool.toUpperCase()}, a storage door that is NOT locked, ${where}: the door's own rows stand as they were and the tool's row is listed under them`, `${r.raised ? 'the frame rule raised BY HAND · ' : ''}the door unlocked BY HAND · locked against you ${r.out} · without it: ${r.bare.join(' ')} · with it: ${r.rows.join(' ')}`);
        F.verdict(r.picked && r.began && r.beside, 'performed, it is worked from BESIDE the latch jamb, out of the opening\'s line', `began ${r.began} · he stood ${f2(r.along)} m along a ${f2(r.d.def.width)} m leaf from its hinge when it went`);
        const loud = tool === 'hammer' ? r.kicks >= 1 && r.shots.length === 0 && r.st.samBlows === 1 && r.st.samHammered === 1 : r.shots.some(e => e.kind === 'shot' && e.weapon === 'm870' && e.loud) && r.st.samShells === 1 && r.st.samShot === 1;
        F.verdict(r.endsOpen && r.hand === '' && !!r.d.lockBroken && Number.isFinite(r.secs) && r.secs <= 3 && loud,
          tool === 'hammer' ? 'ONE blow breaks the latch — loud as the boot, no shot — and the door ENDS OPEN with no second press' : 'ONE shell breaks the latch — gunfire — and the door ENDS OPEN with no second press',
          `open ${r.endsOpen} (angle ${f2(r.d.angle)}) · latch broken ${!!r.d.lockBroken} after ${f2(r.secs)} s · blows ${r.st.samBlows}, shells ${r.st.samShells} · events: ${r.R.evs(r.t0, ['shot', 'guardShot', 'kick'])}${B}`);
      }
      // a barricaded door from the face it opens toward
      { const r = await you(43, 'hammer', 'pull', { lock: 'wedge:storage' });
        F.verdict(r.out && r.held && r.rows.includes('hammer') && r.began && r.gone && r.need === K.BIGSLOT.swings && r.st.samBlows === K.BIGSLOT.swings && r.endsOpen && r.shots.length === 0,
          'A BARRICADED DOOR (a wedge set by hand) from the face it opens TOWARD: the hammer has its row there too, takes it in BIGSLOT.swings blows, and the door ends open', `${byHand(r)} · rows: ${r.rows.join(' ')} · lock off ${!r.d.locked}, broken ${!!r.d.lockBroken} after ${f2(r.secs)} s · blows ${r.st.samBlows} of ${r.need} · open ${r.endsOpen}${B}`); }
      // both knobs off: the build of 10-14
      { const a = await you(44, 'hammer', 'push', { open: true, old: true }), b = await you(45, 'hammer', 'pull', { old: true });
        F.verdict(a.offered === null && a.rows.join() === a.bare.join() && !a.began && a.st.samBlows === 0, 'BOTH KNOBS OFF (BIGSLOT.shut, BIGSLOT.beside): a door that is not locked offers the hammer nothing — his rows are the rows he had', `without it: ${a.bare.join(' ')} · with it: ${a.rows.join(' ')} · blows ${a.st.samBlows}`);
        F.verdict(b.gone && b.home && b.hand !== '' && b.opened && !b.beside, '… and at a locked one, from the face it opens toward, the leaf stands home unlocked for a hand, worked from in front of it — as it was', `home ${b.home} · '${b.hand}' → open ${b.opened} · he stood ${f2(b.along)} m along a ${f2(b.d.def.width)} m leaf${B}`); }
      // A TEAMMATE: the squad's own row
      { const r = await mateShut('hammer', { key: true });
        F.verdict(/\[H\] hammer and clear|H: hammer and clear/.test(r.shown) && r.w === null && r.menuDown && r.big, 'A TEAMMATE, THE HAMMER: the menu opened on the (unlocked) manager\'s door shows the row\'s key on its first page — and H gives it from there: X, then H', `the menu's rows: ${r.shown} · after H: menu down ${r.menuDown}, a door order of the tool's ${r.big}`);
        F.verdict(r.open && r.broken && r.s.mateBlows === 1 && r.s.mateHammered === 1 && r.kicks === 0 && r.trips === 1 && r.shell === 0 && r.mateKick >= 1, 'he takes the door with ONE blow from beside the frame — loud as the boot, no shot, no boot after it — and the entry goes in', `open ${r.open} after ${f2(r.secs)} s · latch broken ${r.broken} · blows ${r.s.mateBlows}, hammered ${r.s.mateHammered} · door tools' kicks ${r.kicks}${B} · ${r.beats}`); }
      { const r = await mateShut('shotgun');
        F.verdict(r.w === null && r.open && r.broken && r.s.drawn === 1 && r.s.slung === 1 && r.shell >= 1 && r.kicks === 0 && r.trips === 1 && r.gun !== 'm870' && !r.out, 'A TEAMMATE, THE SHOTGUN, the same unlocked door (the row by its id): the M870 up, a shell into the latch, the leaf in, his own gun back', `give: ${r.w ?? 'taken'} · open ${r.open} · latch broken ${r.broken} · drawn ${r.s.drawn}, slung ${r.s.slung} · shells heard ${r.shell} · now ${r.gun}${B} · ${r.beats}`); }
      { const r = await mateShut('hammer', { face: 'pull' });
        F.verdict(r.w === null && r.open && r.broken && r.s.mateBlows === 1 && r.s.mateHammered === 1 && r.trips === 1, 'THE FACE THE LEAF OPENS TOWARD, unlocked (the break room\'s north door from inside, set by hand): one blow, the leaf left home — and a hand pulls it; the tool is not sent to it a second time', `${r.raised ? 'the frame rule raised BY HAND · ' : ''}give: ${r.w ?? 'taken'} · open ${r.open} after ${f2(r.secs)} s · blows ${r.s.mateBlows} · trips to the door with the tool ${r.trips}${B} · ${r.beats}`); }
      { const r = await mateShut('hammer', { lock: true });
        F.verdict(r.w === null && !r.locked && r.broken && r.s.mateHammered === 1 && r.ended !== 'found shut' && !/found shut/.test(r.beats), 'a LOCKED door under that row: no halt at a door found shut — the row is the call — and the lock is hammered off in the one order', `give: ${r.w ?? 'taken'} · lock off ${!r.locked}, broken ${r.broken} · hammered ${r.s.mateHammered} · ended '${r.ended || 'running'}'${B} · ${r.beats}`); }
      { const r = await mateShut('hammer', { order: 'openClear' });
        F.verdict(r.w === null && r.open && r.s.mateBlows === 0 && r.kicks === 0 && !r.broken, 'a plain OPEN AND CLEAR on the unlocked door, a hammer in the stack: the handle, as ever — no blow, the latch whole', `open ${r.open} · blows ${r.s.mateBlows} · kicks ${r.kicks} · latch broken ${r.broken} · ${r.beats}`); }
      { const none = await mateShut('none', { key: true }), quiet = await mateShut('hammer', { silent: true }), old = await mateShut('hammer', { old: true });
        F.verdict(typeof none.w === 'string' && !/H: |\[H\]/.test(none.shown) && !none.big && none.s.mateBlows === 0, 'NOBODY CARRIES ONE: the door\'s menu shows no H and the key gives nothing', `the menu's rows: ${none.shown} · H: ${none.w}`);
        // (silent.ts: with SILENT.toolsLoud the row is one of LOUD_ROWS, as bang and clear and the charge are — picking it IS the squad going loud; without, it is refused)
        F.verdict(SIL.SILENT.toolsLoud ? quiet.w === null && !SIL.squadSilent(quiet.g) && quiet.s.mateHammered === 1 && quiet.open && (SIL.LOUD_ROWS as string[]).includes('bigClear') : typeof quiet.w === 'string' && /silent/.test(quiet.w) && quiet.s.mateBlows === 0 && !quiet.open,
          SIL.SILENT.toolsLoud ? 'the squad told SILENT: the row is a LOUD tool (silent.ts LOUD_ROWS) — picking it is the squad going loud, and the hammer takes the door' : 'the squad told SILENT (SILENT.toolsLoud off): the row is refused in its own words, and no blow lands',
          `${quiet.switched ? 'the silent order\'s switch raised BY HAND · ' : ''}give: ${quiet.w ?? 'taken'} · silent after ${SIL.squadSilent(quiet.g)} · hammered ${quiet.s.mateHammered} · open ${quiet.open}${B}`);
        { const HF = await import(`${ROOT}/src/game/holdfire.ts`); F.verdict((HF.LIFT_ORDERS as string[]).includes('bigClear'), 'and it is an order that means fire (holdfire.ts LIFT_ORDERS), as open and clear is', `LIFT_ORDERS: ${(HF.LIFT_ORDERS as string[]).join(' ')}`); }
        // a wedge nobody has tried, only the shotgun to hand: the menu does not read the wedge (the stand that halts at a door found shut) — or says so (the stand that does not)
        { const DT2 = (await import(`${ROOT}/src/game/doortools.ts`)).DOORTOOLS, r = await mateShut('shotgun', { lock: 'wedge:manager' });
          F.verdict(DT2.testDoor ? r.w === null && r.locked && r.s.drawn === 0 && /tried the door|found shut/.test(r.beats + r.ended) : typeof r.w === 'string' && /wedged/.test(r.w), DT2.testDoor ? 'a WEDGED door nobody has tried, only the shotgun in the stack: the row is taken — the menu reads no wedge — and the lead\'s hand finds it; no shell is spent' : 'a WEDGED door, only the shotgun in the stack (this stand\'s squad knows a door\'s lock): refused, a shell shifts no wedge',
            `give: ${r.w ?? 'taken'} · still locked ${r.locked} · drawn ${r.s.drawn} · ended '${r.ended}' · ${r.beats}`); }
        F.verdict(typeof old.w === 'string' && /no such order/.test(old.w) && old.s.mateBlows === 0, 'BIGSLOT.shut off: the squad has no such row (the build of 10-14)', `give: ${old.w}`); }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── wiring
export async function bigWiring(): Promise<boolean> {
  const F = family('bigslot-wiring: the switch is a row of the two stands, a knob table and a table of the journal');
  await kept(async () => {
    try {
      const W: any = await hushed(() => standUp()), g = W.game, stood = K.BIGSLOT.on as boolean, env = process.env.TPS_BIGSLOT;
      const want = STAND === 'frozen' ? env === '1' : env === undefined ? true : env === '1';
      F.verdict(stood === want, `the ${STAND} stand stands a game up with the switch ${want ? 'ON' : 'OFF'}${env !== undefined ? ` (TPS_BIGSLOT=${env})` : STAND === 'frozen' ? ' (held off: TPS_BIGSLOT=1 raises it)' : ' (as the page opens: TPS_BIGSLOT=0 holds it off)'}`, `BIGSLOT.on after the stand-up: ${stood}`);
      const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], KN = await import(`${ROOT}/src/game/knobs.ts`), R = KN.knobRegistry(), JN = (KN.JOURNAL_KNOBS as readonly string[]).includes('BIGSLOT');
      F.verdict(s.includes('TPS_BIGSLOT') && FROZEN_HOLDS['BIGSLOT.on'] === 'TPS_BIGSLOT=1' && R.BIGSLOT === K.BIGSLOT && JN, 'the switch is a row of the two stands\' list, has its word, is in the knob registry and among the tables a recording carries', `STAND_ENV ${s.includes('TPS_BIGSLOT')} · FROZEN_HOLDS ${FROZEN_HOLDS['BIGSLOT.on']} · registry ${R.BIGSLOT === K.BIGSLOT} · JOURNAL_KNOBS ${JN}`);
      const JR = await import(`${ROOT}/src/game/journal.ts`);
      K.BIGSLOT.on = true; const own = JR.knobsSnapshot(g), carried = (own.tables as any).BIGSLOT?.on; const old = JR.knobsSnapshot(g); delete (old.tables as any).BIGSLOT;
      await hushed(() => JR.applyKnobs(g, old)); const without = K.BIGSLOT.on as boolean;
      await hushed(() => JR.applyKnobs(g, own)); const withIt = K.BIGSLOT.on as boolean;
      F.verdict(carried === true && without === false && withIt === true, 'a recording made with the switch on carries it and replays with it on; one from before the table replays with it OFF', `the snapshot's table says ${carried} · applied with no BIGSLOT table: ${without} · applied with its own: ${withIt}`);
      { K.BIGSLOT.on = true; K.BIGSLOT.shut = K.BIGSLOT.beside = true; const now = JR.knobsSnapshot(g), was = JR.knobsSnapshot(g), t = (was.tables as any).BIGSLOT; delete t.shut; delete t.beside;
        await hushed(() => JR.applyKnobs(g, was)); const a = { on: K.BIGSLOT.on, shut: K.BIGSLOT.shut, beside: K.BIGSLOT.beside };
        await hushed(() => JR.applyKnobs(g, now)); const b = { on: K.BIGSLOT.on, shut: K.BIGSLOT.shut, beside: K.BIGSLOT.beside };
        F.verdict(a.on === true && a.shut === false && a.beside === false && b.shut === true && b.beside === true, 'a recording from the build of 10-14 (a BIGSLOT table with no `shut` and no `beside`) replays with the big slot ON and both of them OFF; one made now, with both on', `applied the older table: ${J(a)} · applied its own: ${J(b)}`); }
      const T = K.SLOTS.table, bigs = Object.entries(T.items as Record<string, { big?: boolean }>).filter(([, it]) => it.big).map(([k]) => k).sort();
      F.verdict(T.v === 9 && T.big.length === K.KIT_MEMBERS && T.big.every((n: number) => n === 1) && ['hammer', 'shield', 'shotgun'].every(k => bigs.includes(k)), 'slots.json is v9: one big slot a man, and the shield, the shotgun and the hammer marked big (the wall charge with them where the build prices one)', `v${T.v} · big slots ${J(T.big)} · big things: ${bigs.join(', ')}`);
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── moves
/** BIGSLOT.moves, YOU: the plain night's storage door, shut and NOT locked (by hand), the tool on your card; you stood `from` = [metres along the frame line
 *  from the hinge, metres off the wall] on `face`; `man`: a guard of the floor stood BY HAND on the latch jamb (where a stack's lead stands — the plain
 *  night has no teammate). The row taken if it is there, and every frame of the beat watched. */
async function walkTo(seed: number, tool: 'shotgun' | 'hammer', face: 'push' | 'pull', from: [number, number], o: { man?: boolean; /** a second man of the file, stood by hand at [along, off] */ second?: [number, number]; nomoves?: boolean } = {}) {
  const R = await rig(seed, { stage: false, cards: { 0: { big: tool } }, nomoves: o.nomoves }), g = R.game, pl = g.player, d = R.door('storage'), W = d.def.width as number; g.aiEnabled = false;
  const raised = face === 'pull' && frameUp(g), verb = tool === 'shotgun' ? 'breach' : 'hammer', side = faceOf(g, d, face);
  d.angle = 0; d.vel = 0; d.latched = true; d.locked = false; d.lockBroken = false;
  const spot = doorPt(d, from[0], from[1], side), floor = !g.col.nav.isBlocked(spot[0], spot[2]);
  const fc = (p: number[]) => ({ along: alongOf(d, p), off: offOf(d, p, side) as number });
  // (the stand-ins are guards of the floor, who shuffle and work a leaf they stand by — a teammate on his mark does neither: each is put back on his
  // mark every frame, and the leaf put home until the row is taken)
  const alive = g.guards.filter((m: any) => m.state !== 'dead'), man: any = o.man ? alive[0] : null, second: any = o.second ? alive[1] : null;
  const marks: [any, number[]][] = []; if (man) { const j = g.doors.kickSpotSide(d, doorPt(d, W / 2, 0.75, side)); marks.push([man, [j.pos[0], 0, j.pos[2]]]); } if (second) marks.push([second, doorPt(d, o.second![0], o.second![1], side)]);
  const pin = () => { for (const [m, p] of marks) { m.char.pos = [...p]; m.char.vel = [0, 0, 0]; } }; pin();
  for (const m of g.guards) if (m !== man && m !== second) m.char.pos = [m.char.pos[0] + 400, 0, m.char.pos[2] + 400];   // (every other man of the floor off it: nobody walks into the picture)
  // (a guard of the floor stood by a leaf works on it — a teammate on his mark does not: the leaf is put home again every frame until the row is taken)
  const home = () => { d.angle = 0; d.vel = 0; d.latched = true; pin(); }; if (man) R.post = home;
  const mine = (x: any) => x.kind === 'door' && x.door === d;
  g.teleportPlayer(spot); R.step(12); const bare = g.nearby.filter(mine).map((x: any) => x.verb as string);
  K.kitSolo(g); R.step(3); const rows = g.nearby.filter(mine).map((x: any) => x.verb as string), reach = Math.min(flat(d.pos, spot), flat(d.frameCentre, spot));
  // the row taken: Space on it where it is the list's (a nearer door may have the list's one such row — then the same call the row makes, BY HAND)
  const st = stats(), t0 = g.time, listed = rows.includes(verb), picked = listed && g.selectVerb('door', verb) && g.hover?.door === d; R.post = null;
  // (… and THROUGH the beat, until a blow or a shell of his has landed: a guard of the floor is staff, and a leaf he stands by is brought round to him by his
  //  body — doors.ts update; a teammate's is not. Put home inside the frame, after the doors' own update, so his beat never finds it open under his hands)
  if (man) { const D: any = g.doors, up0 = D.update.bind(D), h0 = st.samBlows + st.samShells;
    D.update = (...a: any[]) => { const r = up0(...a); if (pl.kick && BIG_STATS.samBlows + BIG_STATS.samShells === h0 && !d.lockBroken) { d.angle = 0; d.vel = 0; d.latched = true; } return r; }; }
  if (picked) { R.input.pressed.add('Space'); R.step(); } else if (BK.samBigFar(g, d, pl.char.pos) || (reach < 1.35 && BK.samBig(g, d))) { BK.samBigStart(g, d); R.step(); }
  const began = pl.kick?.tool?.kind === tool && pl.kick.door === d, place = began ? fc(pl.kick.spot) : null;
  if (process.env.DBG) console.log('DBG', seed, face, 'sam', J(fc(pl.char.pos)), 'man', man ? J(fc(man.char.pos)) : '-', 'rows', rows.join(','), 'listed', listed, 'picked', picked, 'began', began, 'place', J(place), 'spots', BK.bigSpots(g, d, side, tool).map((x: any) => J(fc(x.pos))).join(' '), 'closed', d.isClosed(), d.angle);
  // every frame of the beat: where he is, whether his legs walk, the longest step of one frame, what the animator is told, when the blows land
  let inOpening = 0, walked = 0, stride = 0, posed = 0, firstTold = NaN, told: number[] = [], landed: number[] = [], arrive = NaN, endTold = NaN, gunFrames = 0, at: number[] | null = null, last = [...pl.char.pos], hits = st.samBlows + st.samShells;
  let turned = false; const via0 = began ? pl.kick.tool.moves?.via : undefined;
  let pullK = NaN, moved = false;
  const dist3 = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), hand = () => [...(pl.char.bones.handR ?? pl.char.pos)] as number[];
  const drawn0 = drawnTool(g, pl.char.id), back0 = drawn0.head ? dist3(drawn0.head, hand()) : NaN; let headAt = NaN, inHand = NaN;
  R.post = () => { pin(); if (via0 && pl.kick && !pl.kick.tool?.moves?.via) turned = true; const p = pl.char.pos, f = fc(p), T = pl.kick?.tool, P = pl.char.anim.bigTool; stride = Math.max(stride, flat(p, last)); last = [...p];
    if (pl.kick) { if (f.along > 0.05 && f.along < W - 0.05 && f.off < 1.3) inOpening++; if (pl.char.anim.speed > 0.2) walked++; }
    if (!moved && Math.abs(d.angle) > 0.02) { moved = true; pullK = pl.char.anim.bigK; }
    if (P) { posed++; if (P.blows.length && Number.isNaN(firstTold)) firstTold = P.blows[0] - P.t; told = [...P.blows]; if (P.end >= 0) endTold = P.end; }
    if (T?.moves?.arrived && Number.isNaN(arrive)) arrive = T.t;
    const n = BIG_STATS.samBlows + BIG_STATS.samShells; if (n > hits) { hits = n; landed.push(T ? T.t : NaN); at ??= [...p];
      if (T?.moves && Number.isNaN(headAt)) { const D = drawnTool(g, pl.char.id); if (D.head) { headAt = dist3(D.head, T.moves.at); inHand = dist3(D.head, hand()); } } } };
  R.until(() => !d.latched || !!d.lockBroken, 6); const secs = g.time - t0; R.until(() => !pl.kick, 3);
  // his legs are his own: the tool is still on its way back (the pose kept, his gun locked) — and then it is on him again
  const freeAt = { posed: !!pl.char.anim.bigTool, lock: pl.equipT as number, end: pl.char.anim.bigTool?.end ?? NaN, t: pl.char.anim.bigTool?.t ?? NaN };
  // THE TAIL (bigkit.ts samBigTail): no tool's row is his inside it, a teleport drops it — read on a copy of the moment, the run itself goes on untouched —
  // and how long after the blow a round could leave his gun
  const other = g.doors.list.find((x: any) => x !== d && !x.off && !x.def.steel && x.isClosed()), tail = { on: BK.samBigTail(g) as boolean, row: other ? BK.samBig(g, other, other.pos) : 'no other door', rowAfter: null as unknown, left: BK.samBigLeft(g) as number };
  // (the door's end and where the men stand are read NOW, the stand-ins still on their marks: left alone for seconds a guard of the floor shuts a leaf and walks)
  R.until(() => Math.abs(d.angle) > 0.5, 2); const open = Math.abs(d.angle) > 0.5, manAt = man && at ? flat(man.char.pos, at) : NaN, secondAt = second && at ? flat(second.char.pos, at) : NaN;
  let gunAt = NaN; for (let i = 0; i < 200; i++) { R.step(1); if (Number.isNaN(gunAt) && !pl.char.anim.bigTool && pl.equipT <= 0 && !pl.char.anim.kitBusy && !pl.char.anim.hideHeldItem) { gunAt = g.time - t0 - (landed[0] ?? NaN); if (i >= 40) break; } }
  tail.rowAfter = other ? BK.samBig(g, other, other.pos) : 'no other door';
  R.post = null; const drawn1 = drawnTool(g, pl.char.id), back1 = drawn1.head ? dist3(drawn1.head, hand()) : NaN;
  const stood = at ? fc(at) : null;
  return { R, g, d, W, raised, floor, reach, bare, rows, picked, listed, began, corner: via0 ? fc(via0) : null, turned, secondAt, place, stood, drawn0, drawn1, back0, back1, headAt, inHand, freeAt, man, manAt, inOpening, walked, stride, posed, firstTold, told, landed, arrive, endTold, secs,
    open, broken: !!d.lockBroken, gave: !!d.lockBroken && since(st).samHammered + since(st).samShot === 1, st: since(st), poseAfter: pl.char.anim.bigTool, pullK, gunAt, tail, lockAt: at ? flat(at, BK.bigSpots(g, d, side, tool)[0]?.at ?? d.pos) : NaN,
    shots: R.ev.filter(e => e.t >= t0 && (e.kind === 'shot' || e.kind === 'guardShot')).length, kicks: R.ev.filter(e => e.t >= t0 && e.kind === 'kick').length };
}
/** the least the muzzle may stand off the leaf as a teammate's shell leaves from the close place (doortools.ts gunStep refuses it at 0.05 m; measured 0.13) */
const MUZZLE_ROOM = 0.09;
export async function bigMoves(): Promise<boolean> {
  const F = family('bigslot-moves: the tool is taken from where a stack stands, walked to a place beside the frame, and swung as one wound-up move (BIGSLOT.moves)');
  await kept(async () => {
    try {
      const B = BROKEN ? ' · BIGKIT_BREAK=1' : '', E = K.BIGSLOT.equip as number, WU = BK.bigWind() as number;
      const frame = (r: Awaited<ReturnType<typeof walkTo>>) => `he stood ${r.stood ? `${f2(r.stood.along)} m along a ${f2(r.W)} m leaf, ${f2(r.stood.off)} m off the wall` : 'nowhere (no blow)'}`;
      // from the stack's file: 1.5 m past the latch edge along the wall — outside the hand's reach of the leaf
      { const r = await walkTo(61, 'hammer', 'push', [0.86 + 1.5, 0.6]), c = await walkTo(61, 'hammer', 'push', [0.86 + 1.5, 0.6], { nomoves: true });
        F.verdict(r.floor && r.reach > 1.35 && !r.bare.length && r.rows.join() === 'hammer' && r.picked && r.began, 'YOU, THE HAMMER, stood where a stack\'s second man stands (1.5 m past the latch edge, by the wall — outside the hand\'s reach of the leaf): the door\'s one row there is \'hammer it open\', and Space begins it', `floor there ${r.floor} · ${f2(r.reach)} m from the doorway (the hand reaches 1.35) · rows without the hammer: ${r.bare.join(' ') || 'none'} · with it: ${r.rows.join(' ') || 'none'} · began ${r.began}`);
        F.verdict(!c.rows.length && !c.began && c.st.samBlows === 0, '… and with the moves OFF the same place offers nothing (the build before: step to the leaf first)', `rows: ${c.rows.join(' ') || 'none'} · began ${c.began}`);
        F.verdict(r.walked >= 20 && r.stride <= 1.5 * DT * 1.6 && r.inOpening === 0 && !!r.stood && r.stood.along > r.W + 0.05 && r.stood.off < 0.8 && r.st.samWalks === 1, 'he WALKS to the latch jamb — legs moving, no frame\'s step longer than a walk\'s — never in the opening, and works it hard by the frame', `${frame(r)} · frames his legs walked ${r.walked} · longest step ${f2(r.stride / DT)} m/s · frames in the opening ${r.inOpening} · walks counted ${r.st.samWalks}`);
        const due = Math.max(r.arrive, E) + WU;
        F.verdict(r.posed > 0 && r.told.length === 1 && Math.abs(r.told[0] - due) < 2 * DT && r.firstTold >= WU - 2 * DT && r.landed.length === 1 && Math.abs(r.landed[0] - r.told[0]) < 2 * DT && r.endTold >= r.landed[0] + 0.2 && r.freeAt.posed && r.freeAt.lock > 0.3 && Math.abs(r.freeAt.lock - r.tail.left) < 1e-6 && r.poseAfter === null && r.tail.on && r.tail.row === null && r.tail.rowAfter === 'hammer' && r.gunAt < 1.6,
          'THE BEAT: the animator is told the blow a whole wind-up ahead — it lands BIGSLOT.equip after his hands left his gun or as he arrives, whichever is later, plus the wind-up (BIGSLOT.heft) — it lands when told, is followed through before the tool starts back, his legs are his own while it goes back (his gun locked until it has, no row of the tool his until it has), and his hands are his own after', `legs back at ${f2(r.freeAt.t)} s with the tool still out ${r.freeAt.posed}, gun locked ${f2(r.freeAt.lock)} s (what is left of the stow: ${f2(r.tail.left)}) · another shut door's row inside the tail: ${r.tail.row ?? 'none'}, after it: ${r.tail.rowAfter} · a round could leave his gun ${f2(r.gunAt)} s after the blow · arrived ${f2(r.arrive)} s · told ${r.told.map(f2).join(', ')} s (${f2(r.firstTold)} s ahead; due ${f2(due)}) · landed ${r.landed.map(f2).join(', ')} s · put back from ${f2(r.endTold)} s · pose after: ${r.poseAfter === null ? 'none' : 'still set'}`);
        F.verdict(r.open && r.broken && r.st.samBlows === 1 && r.st.samHammered === 1 && r.kicks >= 1 && r.shots === 0, 'ONE blow, loud as the boot and no shot, and the door ENDS OPEN', `open ${r.open} · latch broken ${r.broken} after ${f2(r.secs)} s · blows ${r.st.samBlows} · kicks heard ${r.kicks} · shots ${r.shots}${B}`);
        // what is DRAWN (combat.ts handProps → rigProps.ts bigBoxes): on his back, in his hands with its head on the lock at the blow, on his back again — and nothing with the moves off
        F.verdict(r.drawn0.n === 2 && r.back0 > 0.3 && r.headAt < 0.25 && r.inHand < 0.45 && r.drawn1.n === 2 && r.back1 > 0.3 && c.drawn0.n === 0 && r.drawn0.all === c.drawn0.all + 2,
          'THE HAMMER IS DRAWN: two boxes on his back before (the head well clear of his hand), the head on the point he strikes as the blow lands, on his back again after — and with the moves off nothing is drawn (the frame\'s boxes are the build before\'s)', `before: ${r.drawn0.n} boxes, head ${f2(r.back0)} m from his right hand · at the blow: head ${f2(r.headAt)} m from the point, ${f2(r.inHand)} m from his hand · after: ${r.drawn1.n}, ${f2(r.back1)} m · moves off: ${c.drawn0.n} (${c.drawn0.all} boxes in the frame against ${r.drawn0.all})${B}`); }
      // across a back that carries a rifle too: neither tool lies inside it (rigProps.ts bigClearOf — a number a tool, and as far again as the rifle itself rides out on this body)
      { const h = await overRifle('hammer'), sg = await overRifle('shotgun'), cm = (x: number) => (x * 100).toFixed(1), ROOM = 0.003;
        F.verdict(h.rifle > 0 && h.clear.n === 2 && sg.clear.n > 2 && h.clear.gap >= ROOM && sg.clear.gap >= ROOM && h.flat.gap < -0.005 && sg.flat.gap < -0.005,
          'OVER THE RIFLE: with his rifle slung across his back the hammer and the slung shotgun ride clear of it — no box of either inside a box of the rifle (and laid where they lie with no rifle under them, both would be)', `${h.cast ? 'the cast body' : 'the mannequin'}, a rifle of ${h.rifle} boxes · hammer ${cm(h.clear.gap)} cm off it (${cm(h.flat.gap)} with no clearance) · shotgun ${cm(sg.clear.gap)} cm (${cm(sg.flat.gap)}) · want ${cm(ROOM)} or more`); }
      // … and THE GAME's own word for it (combat.ts handProps): the plain night, the tool on Sam's card. The pistol drawn — his rifle across his back — the frame's
      // tool boxes are the cleared ones and stand off the frame's rifle boxes; the rifle in his hands — nothing across his back — they lie where they lie with
      // no clearance; and the hand that goes for the hammer's handle is told the same distance the drawer used (anim.bigClear), nothing for the shotgun
      for (const tool of ['hammer', 'shotgun'] as const) { const R = await rig(73, { stage: false, cards: { 0: { big: tool } } }), g = R.game, pl = g.player, an: any = pl.char.anim; g.aiEnabled = false; K.kitSolo(g); R.step(3);
        // (the shotgun across his back is a long gun's boxes with no tag of their own: the frame's tool is told by WHERE it is — the drawer's boxes, asked for
        //  with the clearance and with none, found among the frame's)
        const own = (b: any) => b.owner === (pl.char.id & 0xff), at = (x: any, y: any) => Math.hypot(x.c[0] - y.c[0], x.c[1] - y.c[1], x.c[2] - y.c[2]) < 1e-6;
        const read = () => { const out: any[] = []; handProps(g, out); const mine = out.filter(own), rf = mine.filter(b => b.name === SC20K_TAG);
          const as = (clear: boolean) => { const o: any[] = []; bigBoxes(pl.char, tool, 0, o, RIG, clear); const hit = o.map(x => mine.find(b => at(b, x))); return hit.every(Boolean) ? hit as any[] : null; };
          const cl = as(true), fl = as(false), t = cl ?? fl ?? []; let gap = Infinity; for (const r of rf) for (const x of t) if (r !== x) gap = Math.min(gap, boxGap(r, x));
          return { n: t.length, rifle: rf.length, gap, cleared: !!cl, flat: !!fl, told: an.bigClear as number }; };
        const slot = (code: string, up: boolean) => { R.input.pressed.add(code); R.step(1); return R.until(() => pl.rifleUp === up && !(pl.equipT > 0) && an.bigK === 0, 6) && (R.step(30), true); };
        const s1 = slot('Digit1', false), front = !!(KITANIM.on && kitSlingFront(g)), back = read(), s2 = slot('Digit2', true), hand = read(), cm = (x: number) => (x * 100).toFixed(1);
        F.verdict(s1 && s2 && pl.hasRifle && back.n > 0 && back.rifle > 0 && !front && back.cleared && !back.flat && back.gap >= 0.003 && (tool === 'hammer' ? back.told > 0.05 : back.told === 0) && hand.n === back.n && hand.flat && !hand.cleared && hand.told === 0,
          `… IN THE GAME, ${tool === 'hammer' ? 'THE HAMMER' : 'THE SHOTGUN'}: the pistol drawn and his rifle across his back, the frame's tool is drawn clear of the frame's rifle; the rifle in his hands, it lies on his back with no clearance — and the hand going for the handle is told the drawer's distance`,
          `pistol drawn ${s1}${front ? ' (THE RIFLE HANGS IN FRONT: nothing across his back to clear)' : ''}: ${back.n} tool boxes, ${back.rifle} of the rifle, ${cm(back.gap)} cm apart, the cleared ones ${back.cleared}, the hand told ${cm(back.told)} cm · rifle up ${s2}: the uncleared ones ${hand.flat}, the hand told ${cm(hand.told)} cm`); }
      // the face the leaf opens TOWARD, nobody by it: nothing flings it — the same hands pull it, once the tool is back on him
      { const r = await walkTo(70, 'hammer', 'pull', [0.86 + 1.5, 0.6]);
        F.verdict(r.began && r.gave && r.open && r.pullK < 0.2 && r.inOpening === 0, 'THE FACE IT OPENS TOWARD: the latch is broken from beside the frame, the hammer goes back onto him, and only then do the same hands pull the leaf open', `${r.raised ? 'the frame rule raised BY HAND · ' : ''}${frame(r)} · blows ${r.st.samBlows} · the hammer ${f2(r.pullK)} of the way into his hands as the leaf first moved · open ${r.open}${B}`); }
      // a teleport inside the tail (cancelActions): nothing of the beat is left on him
      { const R = await rig(71, { stage: false }), g = R.game, pl = g.player; K.BIGSLOT.moves = true; K.kitSolo(g);
        pl.char.anim.bigTool = { kind: 'hammer', t: 1.0, equip: 0.6, windup: 0.45, stow: 0.45, blows: [0.7], end: 0.95, at: [pl.char.pos[0], 1, pl.char.pos[2] + 0.5] };
        R.step(2); const kept = BK.samBigTail(g) as boolean, k = pl.char.anim.bigK as number; g.teleportPlayer([...pl.char.pos]); R.step(1);
        F.verdict(kept && k > 0.5 && pl.char.anim.bigTool === null && !BK.samBigTail(g), 'A TELEPORT INSIDE THE TAIL (cancelActions): the pose is dropped — his hands are his own', `the tail ran ${kept}, the tool ${f2(k)} of the way in his hands · after the teleport: ${pl.char.anim.bigTool === null ? 'nothing' : 'STILL POSED'}`); }
      // a man on the latch jamb (the lead's own mark), you behind him
      for (const face of ['push', 'pull'] as const) {
        const r = await walkTo(face === 'push' ? 62 : 63, 'hammer', face, [0.86 + 1.5, 0.6], { man: true });
        F.verdict(r.began && !!r.stood && r.stood.along > r.W + 0.05 && r.stood.off > 0.85 && r.manAt >= 0.4 && r.inOpening === 0 && r.open && r.gave,
          `A MAN ON THE LATCH JAMB (stood there by hand), you behind him, the face the leaf opens ${face === 'push' ? 'AWAY from' : 'TOWARD'}: it is worked from off his shoulder — out of the opening, not on him — and the hammer takes it and the door ends open`, `${r.raised ? 'the frame rule raised BY HAND · ' : ''}${frame(r)} · ${f2(r.manAt)} m from the man · frames in the opening ${r.inOpening} · open ${r.open} · the hammer took it ${r.gave}${B}`); }
      // third in the file: a second man between you and the door
      { const r = await walkTo(69, 'hammer', 'push', [0.86 + 1.74, 0.5], { man: true, second: [0.86 + 1.04, 0.5] });
        F.verdict(r.began && !!r.corner && r.turned && r.corner.off > 1.0 && !!r.stood && r.stood.along > r.W + 0.05 && r.manAt >= 0.4 && r.inOpening === 0 && r.open && r.gave,
          'THIRD IN THE FILE (two men stood by hand between you and the door): the row is still yours, he walks ROUND the second man — one corner, off the wall — to the lead\'s shoulder, and the door ends open', `rows: ${r.rows.join(' ') || 'none'} · the corner ${r.corner ? `${f2(r.corner.along)} m along, ${f2(r.corner.off)} m off the wall` : 'none'}, turned ${r.turned} · ${frame(r)} · ${f2(r.manAt)} m from the lead, ${f2(r.secondAt)} from the second man · frames in the opening ${r.inOpening} · open ${r.open}${B}`); }
      // the same man on the latch jamb, you on the hinge side
      { const r = await walkTo(64, 'hammer', 'push', [-1.2, 0.6], { man: true }), q = await walkTo(65, 'hammer', 'pull', [-1.2, 0.6], { man: true });
        F.verdict(r.began && !!r.stood && r.stood.along < -0.05 && r.stood.off < 0.8 && r.inOpening === 0 && r.open && r.gave, '… you on the HINGE side, the face it opens away from: the hinge jamb is his place — he does not cross the opening to stand on the lead', `${frame(r)} · frames in the opening ${r.inOpening} · open ${r.open}${B}`);
        F.verdict(q.began && !!q.stood && q.stood.along > q.W && q.open && q.gave, '… and on the face it opens TOWARD the hinge jamb is nobody\'s place (the leaf is pulled round over it): he walks past the shut leaf to the lead\'s shoulder, works it from there, and the door ends open', `${q.raised ? 'the frame rule raised BY HAND · ' : ''}rows: ${q.rows.join(' ') || 'none'} · ${frame(q)} · open ${q.open}${B}`); }
      // the control: the moves off, in the hand's reach, the man on the jamb — in front of the leaf, as it was
      { const c = await walkTo(66, 'hammer', 'push', [0.43, 0.75], { man: true, nomoves: true }), r = await walkTo(66, 'hammer', 'push', [0.43, 0.75], { man: true });
        F.verdict(c.began && !!c.stood && c.stood.along > 0 && c.stood.along < c.W && c.walked === 0, 'THE MOVES OFF, a man on the latch jamb, you in the hand\'s reach: slid to the boot\'s spot square in the opening — the build before', `${frame(c)} · frames his legs walked ${c.walked}`);
        F.verdict(r.began && !!r.stood && (r.stood.along < -0.05 || r.stood.along > r.W + 0.05) && r.open && r.gave, '… and ON, from that same place: out of the opening', `${frame(r)} · open ${r.open}${B}`); }
      // the shotgun: a hand from the lock
      { const r = await walkTo(67, 'shotgun', 'push', [0.86 + 1.5, 0.6]), far = Math.hypot(0.45 + 0.2, 1.0);
        F.verdict(r.began && !!r.stood && r.stood.along > r.W + 0.05 && r.lockAt < far - 0.15 && r.inOpening === 0 && r.landed.length >= 1 && r.told.length >= 1 && Math.abs(r.landed[0] - r.told[0]) < 2 * DT && r.open && r.st.samShells >= 1 && r.shots >= 1,
          'YOU, THE SHOTGUN, from the stack\'s file: walked to the latch jamb, nearer the lock than its pattern needs, the shell told to the animator and gone when told — gunfire — and the door ends open', `${frame(r)} · ${f2(r.lockAt)} m from the lock (the list before: ${f2(far)}) · told ${r.told.map(f2).join(', ')} · gone ${r.landed.map(f2).join(', ')} · shells ${r.st.samShells} · open ${r.open}${B}`); }
      // a teammate: the squad's H row on the manager's door
      for (const tool of ['hammer', 'shotgun'] as const) {
        let out = 0, toldAhead = NaN, place: number[] | null = null, hung = 0, drawnN = Infinity, offGun = 0, headAt = Infinity, muzzle = NaN, mz0: number[] | null = null, mzOff = 0; const seenBlows = new Set<number>();
        const r = await mateShut(tool, { watch: (R, gd, d) => { const H = gd.bigOut, op = R.D.ops.find((o: any) => o.kick?.gun?.by === gd);
          if (H) { out++; const t = R.game.time - H.t0; for (const b of H.blows) if (!seenBlows.has(b) && b > t) { seenBlows.add(b); if (Number.isNaN(toldAhead)) toldAhead = b - t; } }
          if (gd.char.anim.bigTool) { hung++; const D = drawnTool(R.game, gd.char.id); drawnN = Math.min(drawnN, D.n); if (gd.char.anim.hideHeldItem) offGun++;
            if (gd.char.anim.hideHeldItem && H && H.blows.some((b: number) => R.game.time - H.t0 >= b - WU && R.game.time - H.t0 <= b)) { const c = gd.char, y = c.bodyYaw, dx = c.muzzle[0] - c.pos[0], dz = c.muzzle[2] - c.pos[2], L = [dx * Math.cos(y) - dz * Math.sin(y), c.muzzle[1] - c.pos[1], dx * Math.sin(y) + dz * Math.cos(y)];   // (his gun's muzzle in his body's own frame, through the wind-up to the blow: the swing must not carry it — character.ts reads it off the whole pose under the layer)
              if (!mz0) mz0 = L; else mzOff = Math.max(mzOff, Math.hypot(L[0] - mz0[0], L[1] - mz0[1], L[2] - mz0[2])); }
            if (D.head && H && H.blows.some((x: number) => Math.abs(x - (R.game.time - H.t0)) < 1.5 * DT)) headAt = Math.min(headAt, Math.hypot(D.head[0] - H.at[0], D.head[1] - H.at[1], D.head[2] - H.at[2])); }
          if (op?.kick) place = [...op.kick.pos];
          if (op?.kick?.gun && !d.lockBroken) muzzle = offOf(d, gd.char.muzzle, op.side) as number; } });   // (the last frame before the lock went: where the muzzle was as the shell left)
        const side = BK.bigSide(r.d, place ?? r.gd.char.pos) as 1 | -1, near = place ? offOf(r.d, place, side) as number : NaN, al = place ? alongOf(r.d, place) : NaN, far = 1.0;   // (the list before stood him a metre and more off the wall)
        if (tool === 'hammer') F.verdict(r.open && r.broken && r.s.mateBlows === 1 && out > 0 && hung > 0 && toldAhead >= WU - 3 * DT && r.s.hammersOut >= 1 && r.s.hammersIn >= 1 && r.gd.bigOut === null && r.gd.char.anim.bigTool === null && near < far - 0.1 && (al < -0.05 || al > r.d.def.width + 0.05) && r.shell === 0 && drawnN === 2 && offGun > 0 && headAt < 0.3 && mz0 !== null && mzOff < 0.12,
          'A TEAMMATE, THE HAMMER (X then H on the manager\'s door): it is off his back while he is sent, the blow told a whole wind-up ahead, swung from hard by the frame and out of the opening, DRAWN on him throughout (his own gun let hang — its line not carried round by the swing — the head on the point as the blow lands), put back after — and the entry goes in', `drawn: ${drawnN} boxes every frame, ${offGun} frames his hands were off his gun, his gun's muzzle moved ${f2(mzOff)} m in his own frame through the wind-up (red at 0.12), head ${f2(headAt)} m from the point at the blow · open ${r.open} · blows ${r.s.mateBlows} · frames it was out ${out}, posed ${hung} · told ${f2(toldAhead)} s ahead (a wind-up is ${f2(WU)}) · his place ${f2(near)} m off the wall (the list before: ${f2(far)} and more), ${f2(al)} m along a ${f2(r.d.def.width)} m leaf · out/in ${r.s.hammersOut}/${r.s.hammersIn} · on his back at the end ${r.gd.bigOut === null}${B} · ${r.beats}`);
        else F.verdict(r.open && r.broken && r.shell >= 1 && near < far - 0.1 && (al < -0.05 || al > r.d.def.width + 0.05) && !r.out && muzzle >= MUZZLE_ROOM, 'A TEAMMATE, THE SHOTGUN: shot from hard by the frame — nearer the leaf than the list before — out of the opening, the muzzle with room to spare off the leaf (gunStep refuses a shell at 0.05 m: a pose that pushes the gun forward must not quietly send him to the boot), slung after — and the entry goes in', `open ${r.open} · shells ${r.shell} · the muzzle ${f2(muzzle)} m off the leaf as the shell left (refused at 0.05, red under ${f2(MUZZLE_ROOM)}) · his place ${f2(near)} m off the wall (the list before: ${f2(far)} and more), ${f2(al)} m along a ${f2(r.d.def.width)} m leaf · m870 still out ${r.out}${B} · ${r.beats}`); }
      // BIGSLOT.snug — each thing stays IN A HAND while it is off him (character.ts BIGMOVE.snug). The same teammate, the same door, the hammer: every frame of
      // the beat, how far the hammer as DRAWN (rigProps bigBoxes at the animator's bigK) is from the hollow of his right fist while it is off his back, and how
      // far his right hand has gone from his own gun's grip with the gun still drawn in it (his body's frame: from where the hand was as the beat began, and —
      // putting the tool back — from where it is the frame after the beat). With the switch off both are the build before's, and far out.
      { const fly = async (nosnug: boolean) => { let outOf = 0, n = 0, between = 0, told: boolean | undefined, hid = -1, after: number[] | null = null, was = false; const gunAt: number[][] = [];
          const inBody = (c: any) => { const h = c.bones.handR ?? c.pos, y = c.bodyYaw, dx = h[0] - c.pos[0], dz = h[2] - c.pos[2]; return [dx * Math.cos(y) - dz * Math.sin(y), h[1] - c.pos[1], dx * Math.sin(y) + dz * Math.cos(y)]; };
          const r = await mateShut('hammer', { nosnug, watch: (_R, gd) => { const c = gd.char, an = c.anim; if (!an.bigTool) { if (was && !after) after = inBody(c); return; } was = true; n++; told = an.bigTool.snug;
            if (an.bigK > 0.02) { const a: any[] = []; bigBoxes(c, 'hammer', an.bigK, a); const hol = hollowR(c); if (a.length) outOf = Math.max(outOf, Math.min(...a.map(x => ptGap(x, hol)))); if (an.bigK < 0.98) between++; }
            if (an.hideHeldItem) { if (hid < 0) hid = gunAt.length; } else gunAt.push(inBody(c)); } });
          const d3 = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); let carried = 0;
          gunAt.forEach((p, i) => { const ref = hid < 0 || i < hid ? gunAt[0] : after; if (ref) carried = Math.max(carried, d3(p, ref)); });
          return { open: r.open, n, outOf, between, carried, gunFrames: gunAt.length, told }; };
        const on = await fly(false), off = await fly(true), cm = (x: number) => (x * 100).toFixed(1), S = SNUG_BROKEN ? ' · BIGSNUG_BREAK=1' : '';
        F.verdict(on.open && on.n > 0 && on.between > 0 && on.outOf < 0.03 && on.carried < 0.06,
          'IN A HAND ALL THE WAY (BIGSLOT.snug), a teammate on the manager\'s door: off his back, the hammer is never drawn more than 3 cm from the hollow of his fist, and his own gun is never carried more than 6 cm by a hand on its way to the tool', `the hammer ${cm(on.outOf)} cm out of his fist at the worst (${on.between} frames between his back and his hand, of ${on.n}) · his gun carried ${cm(on.carried)} cm off its place (${on.gunFrames} frames drawn in his hand inside the beat) · the animator told snug ${on.told} · door open ${on.open}${S}`);
        F.verdict(off.open && off.outOf > 0.06 && off.carried > 0.12 && !off.told, '… and with the switch OFF the first-pass timing stands: the tool drawn part way between his back and a fist that has left, his gun carried toward his shoulder', `the hammer ${cm(off.outOf)} cm out of his fist (${off.between} frames between) · his gun carried ${cm(off.carried)} cm (${off.gunFrames} frames) · the animator told snug ${off.told} · door open ${off.open}`);
        // … and the WHOLE move by the record alone, the same on any stand (in the game the fight may take a teammate before he has put the tool back — bigkit.ts
        // hammerIn `hard`: on his back at once, as the sim has it — so the put-back's share and the turned back are asked here): a teammate stood still at the
        // aim, his chest turned `turn` rad off his feet, the hammer out, one blow, back.
        const R = await rig(8, { cards: { 1: { big: 'hammer' } } }), c = R.ops[0].char, an = c.anim; R.game.aiEnabled = false; R.step(2);
        const by = (snug: boolean, turn: number) => { let out = 0, back = 0, n = 0; const yaw = c.bodyYaw, up = an.upper;
          const T = { kind: 'hammer' as const, equip: K.BIGSLOT.equip as number, windup: BK.bigWind() as number, stow: K.BIGSLOT.stow as number, blows: [1.3], end: 1.55, at: [c.pos[0] + Math.sin(yaw) * 0.8, 1, c.pos[2] + Math.cos(yaw) * 0.8] };
          for (let t = 0; t <= T.end + T.stow + 1e-9; t += DT) { c.bodyYaw = yaw; c.aimYaw = yaw + turn; an.upper = 'aim'; an.bigTool = { ...T, t, snug }; c.update(DT);
            if (!(an.bigK > 0.02)) continue; const a: any[] = []; bigBoxes(c, 'hammer', an.bigK, a); if (!a.length) continue; const hol = hollowR(c), gap = Math.min(...a.map(x => ptGap(x, hol)));
            if (t >= T.end) { back = Math.max(back, gap); if (an.bigK < 0.98) n++; } else out = Math.max(out, gap); }
          an.bigTool = null; c.aimYaw = yaw; an.upper = up; c.update(DT); return { out, back, n }; };
        const turns = [0, 1, -1], sn = turns.map(t => by(!SNUG_BROKEN, t)), was = turns.map(t => by(false, t)), list = (l: { out: number; back: number; n: number }[]) => l.map((x, i) => `turned ${turns[i]} rad: out ${cm(x.out)}, back ${cm(x.back)} cm (${x.n} frames)`).join(' · ');
        F.verdict(sn.every(x => x.n > 0 && x.out < 0.01 && x.back < 0.01), 'BY THE RECORD, OUT AND BACK, his chest square and turned a radian either way at the aim: the hammer is never drawn more than 1 cm from the hollow of his fist, taken out or put back', `${list(sn)}${S}`);
        F.verdict(was.every(x => x.out > 0.03 && x.back > 0.03) && was.slice(1).every(x => x.out > 0.05 && x.back > 0.05), '… and by a record with no `snug` (the build before, a stored pose): over 3 cm out of his fist both ways with his chest square, over 5 turned', list(was)); }
      // the journal: a recording from before each key
      { const R = await rig(68, { stage: false }), g = R.game, JR = await import(`${ROOT}/src/game/journal.ts`);
        for (const key of ['moves', 'snug'] as const) { K.BIGSLOT[key] = true; const now = JR.knobsSnapshot(g), was = JR.knobsSnapshot(g); delete (was.tables as any).BIGSLOT[key];
          await hushed(() => JR.applyKnobs(g, was)); const a = K.BIGSLOT[key] as boolean; await hushed(() => JR.applyKnobs(g, now)); const b = K.BIGSLOT[key] as boolean;
          F.verdict(a === false && b === true, key === 'moves' ? 'a recording from before the key (a BIGSLOT table with no `moves`) replays with the moves OFF; one made now, with them on' : '… and one from before `snug` replays with the first-pass timing; one made now, in a hand all the way', `applied the older table: ${a} · the newer: ${b}`); } }
    } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  });
  return F.done();
}

export async function bigslotCheck(only?: string): Promise<boolean> {
  console.log(`bigslot-check on the ${STAND.toUpperCase()} stand${STAND === 'frozen' ? ' (the switch is held off there: the check raises it itself)' : ' (TPS_PROFILE=shipped: the page as it opens)'}${BROKEN ? ' — BIGKIT_BREAK=1: the tools do nothing to a lock, the lock lines below must FAIL' : ''}`);
  let ok = true;
  const parts: [string, () => Promise<boolean>][] = [['card', bigCard], ['off', bigOff], ['you', bigYou], ['mate', bigMate], ['shut', bigShut], ['moves', bigMoves], ['wiring', bigWiring]];
  for (const [name, fn] of parts) if (!only || only === name) ok = (await fn()) && ok;
  console.log(`\nbigslot-check (${STAND} stand): ${ok ? 'ALL PASS' : 'FAILED'}`);
  return ok;
}
if (import.meta.main) { const ok = await bigslotCheck(process.argv[2]); process.exit(ok ? 0 : 1); }
