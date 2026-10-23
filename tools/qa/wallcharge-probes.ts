// The 'wallcharge' probes (src/game/wallcharge.ts — the door charge's twin on a partition wall), run as their own program:
//   bun run tools/qa/wallcharge-probes.ts [all | menu | squad | sam | refusals | trigger | reset | off | hold] [--scn block-squads,compound-four,warehouse-four] [--verbose]
// Headless = the Proxy device: nothing is drawn. Each family runs on every scenario of --scn (a squad of four on a level with partitions). The module only runs
// under the destruction goal's switch (destructionSwitch.ts DESTRUCTION.on), which these probes raise themselves, at the page's chaos 0.5.
//   (menu)      X on a partition: the floor's rows with row 5 'wall tools ▸', and behind it row 3 'breach the wall · uses both charges' — X, 5, 3: the door charge's own
//               presses; every digit 1‥5; nothing held when the order has gone; the floor's and a door's menus are untouched; WALLCHARGE.menu 'direct' = X, 5;
//   (squad)     the order by those presses: one man sets it (a charge leaves the bag when it is ON the wall), the rest stand off out of the blast, and nothing
//               happens until Sam's F; then a hole a man walks through (the route between the two faces drops to a few metres, a man's circle stands in it), the
//               squad unhurt, the man placed right behind it down, the one down the room flash-blind and staggered, the one behind the next wall untouched;
//               every man goes in through the hole, ends on a point of his own inside, and the order ends 'in';
//   (sam)       with no squad: Sam at the foot of a partition has the Space row 'breach the wall · uses both charges', stands on it setSecs (a step breaks it off, nothing
//               spent), F blows it, and he walks through; no row on structure, none with the switch off;
//   (refusals)  each in words, said by a man, nothing spent and nothing under way after: concrete / outer wall / steel, none left, a teammate behind the wall, a
//               teammate too close, no room to stand off, already on it, it's open;
//   (trigger)   F with a wall charge and a door charge both set blows the nearer and only it; the menu's 'blow the charge' row is the same trigger;
//   (reset)     a restart with one set and an order under way: nothing set, nothing under way, the bag full, the wall whole; (Sam alone) a checkpoint taken with
//               one set, loaded: none on the wall, the bag full; taken after a blast, loaded: the hole is the engine's to keep, no charge anywhere;
//   (hold)      no stand-off post of any wall place is in a doorway where the floor has four marks out of one (a place that has not is dealt the marks as
//               without the rule — the rule's own fallback — and only such a place may show one; OFFFRAME_BREAK=1 must fail), none at the foot of a hole already in that wall; in through a wall into a room with doors
//               of its own, each door a point has a line to is one man's to hold, his gun on it (WALLCHARGE.doors off: every gun on the room, as it was);
//   (off)       WALLCHARGE.on false: a wall's menu IS the floor's, the order is refused, no Space row, input and tick do nothing — and a played half-minute with
//               the switch on and nobody using it digests exactly as with it off; the same with the destruction's own switch down.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const WC = await import(`${ROOT}/src/game/wallcharge.ts`);
const { WALLCHARGE, WALLCHARGE_DEFAULTS, wallAt, wallPt, wallOff, wallAlong, WALL_ORDER } = WC;
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { OWNCHARGE } = await import(`${ROOT}/src/game/owncharge.ts`);
const { OWNBLOW } = await import(`${ROOT}/src/game/ownblow.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { WALLS } = await import(`${ROOT}/src/game/wallbreak.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const VERBOSE = argv.includes('--verbose');
const SCNS = (flag('--scn') ?? 'block-squads,compound-four,warehouse-four').split(',');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
let CHECKS = 0, FAILS = 0;
function family(title: string): { verdict: Verdict; note: (s: string) => void; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; CHECKS++; if (!ok) FAILS++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, note: s => console.log(`  (note) ${s}`),
    done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS));
let ownWas: boolean | null = null;   // (owncharge.ts's switch as it stood before a rig of Sam alone held it off: put back with the other knobs)
const restoreKnobs = () => { Object.assign(WALLCHARGE, JSON.parse(JSON.stringify(WALLCHARGE_DEFAULTS))); Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); if (ownWas !== null) { OWNCHARGE.on = ownWas; ownWas = null; } };
const entryOf = (id: string): any => SCENARIOS.find((e: any) => e.id === id);
const levelOfFile = (file: string): any => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };

/** One game on a scenario's level. `squad`: the scenario started (the four on the floor) — false: the level with Sam alone. `still`: the other side deaf, blind
 *  and held where it stands (the mechanics under test, not the fight). `sw` / `wc`: the destruction's switch / this module's. */
async function rig(scn: string, seed: number, o: { squad?: boolean; still?: boolean; sw?: boolean; wc?: boolean; chaos?: number } = {}) {
  restoreKnobs(); Math.random = seeded(0x9137 + seed * 7919); DESTRUCTION.on = o.sw ?? true; WALLCHARGE.on = o.wc ?? true;
  const E = entryOf(scn); if (!E) throw new Error(`no scenario '${scn}'`);
  const W: any = await quiet(() => standUp(E.level ? { level: levelOfFile(E.level) } : {})); const game = W.game, input = W.input;
  game.godMode = true; game.tune.chaos = o.chaos ?? 0.5;
  if (o.squad ?? true) { const { why } = await quiet(() => startFromQuery(game, new URLSearchParams(scenarioQuery(E)))); if (why) throw new Error(`start refused — ${why}`); }
  const said: string[] = [], spoke: { who: string; text: string }[] = [];
  { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; const say = game.say.bind(game); game.say = (gd: any, t: string, ...r: any[]) => { spoke.push({ who: gd?.callsign ?? '?', text: t }); return say(gd, t, ...r); }; }
  const O = game.orders, D = game.doorTools, C = game.wallCharge;
  OWNBLOW.on = false;   // (ownblow.ts, on on the shipped stand: these lines press the squad's key on a charge set by hand, as they were written; ownblow-check holds the row and raises the switch itself. restoreKnobs puts it back)
  // (A MAN ALONE: these lines were written on the door tools' own bag, which a man alone had whatever his kit card said. With charges of his own — owncharge.ts,
  // on on the shipped stand — he carries his card's and nothing else, which owncharge-check holds; here the switch is held off and the bag put back as it stood,
  // so the lines still ask what they asked: the wall's row, the setting, the blast. restoreKnobs puts the switch back, as the runner does after the probe.)
  if (!(o.squad ?? true) && OWNCHARGE.on) { ownWas = true; OWNCHARGE.on = false; D.alone(DOORTOOLS.charges); C.setCarried(null); }
  const staged: number | null = C.carried; if (C.carried !== null) C.setCarried(null);   // (the kit's slots rule — on on the shipped stand — issues no wall charge and has staged that count: these lines ask about the whole-bag rule they were written on. A restart stages the kit's count again; wallcharge-cost holds that)
  const still = () => { for (const gd of game.guards) if (gd.team !== 'operative') { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; if (gd.flashlight) gd.flashlight.enabled = false; } };
  const R = { W, game, input, O, D, C, said, spoke, scn, staged,
    get team(): any[] { return O.squad(); }, get up(): any[] { return O.squad().filter((m: any) => m.state !== 'dead'); },
    get hostiles(): any[] { return game.guards.filter((x: any) => x.team !== 'operative' && x.team !== 'civilian'); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; if (o.still ?? true) still(); W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    press(code: string) { input.pressed.add(code); R.step(); },
    /** X on p: the menu's first page, the page behind its opener (if any), Esc, Esc */
    menuOn(p: number[], byCode = false) {   // (byCode: the menu opened on the target at p without the cursor — a point the camera does not see past a nearer wall)
      if (byCode) { O.open(O.targetAt([p[0], p[1], p[2]])); R.step(2); } else { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(24); }
      const read = () => { const M = O.menu, hud = O.hud().menu; return M ? { ids: M.rows.map((r: any) => r.id).join(' '), keys: M.rows.map((r: any) => r.key ?? (r.hotKey ? 'hot' : '?')).join(' '), why: [...M.why] as (string | null)[], kind: M.target.kind as string, wall: !!M.target.wall,
        rows: (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ key: r.opts[0]?.key, text: r.opts[0]?.text, off: r.off })) } : null; };
      const first = read(); if (!first) { input.pressed.add('Escape'); R.step(); return null; }
      // the page a DIGIT opens: an opener on a hot key (the squad's throw row) is another menu
      const opener = O.menu.rows.find((r: any) => r.opens && r.key !== undefined); let page: ReturnType<typeof read> = null, back = true;
      if (opener) { input.pressed.add(`Digit${opener.key}`); R.step(); R.step(4); page = O.menu?.page === opener.opens ? read() : null; input.pressed.add('Escape'); R.step(); back = !!O.menu && O.menu.page === null; }
      input.pressed.add('Escape'); R.step();
      return { ...first, page, back, gone: O.menu === null };
    },
    /** X on p, then the digits, a third of a second apart — taps, nothing held */
    pick(p: number[], ...n: number[]) { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(20); for (const k of n) { input.pressed.add(`Digit${k}`); R.step(); R.step(6); } },
    get op(): any { return C.ops[0] ?? C.done[C.done.length - 1] ?? null; },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => `${f2(b.t)} ${b.what}`).join(' | '); },
    free(p: number[]) { return !game.col.nav.isBlocked(p[0], p[2]); },
    pathLen(a: number[], b: number[]): number { const path = game.col.nav.findPath(a, b); if (!path) return Infinity; let L = 0, q = a; for (const w of path) { L += flat(q, w); q = w; } return L + flat(q, b); },
    /** the squad brought to Sam at p (fall in, and the walk) */
    /** `keep`: the place on the wall Sam will point at. A teammate who has fallen in within the menu's own reach of it (ORDERS.manM) IS the target of a cursor or an
     *  order there — the man's rows, not the wall's — so he is stood a stride off it and held there (a man fallen in walks back to his place in the file): the
     *  player would point at a bit of wall nobody stands at. The file goes on closing up for a second or two after the last man 'arrives', so it is asked until
     *  nobody is at the place and nobody is still walking */
    gather(p: number[], secs = 75, keep?: number[]) { game.teleportPlayer([p[0], 0, p[2]]); R.step(3); O.give('fallIn', O.targetAt(game.player.char.pos), 'all'); const ok = R.until(() => R.up.every((m: any) => flat(m.char.pos, p) < 6 && O.of(m)?.arrived), secs);
      if (keep) for (let round = 0; round < 12; round++) { let moved = false;
        for (const m of R.up) { if (flat(m.char.pos, keep) >= ORDERS.manM + 0.3) continue; const others = [game.player.char.pos, ...R.up.filter((x: any) => x !== m).map((x: any) => x.char.pos)]; let best: Vec3 | null = null;
          for (let r = 0.5; r <= 3.5 && !best; r += 0.5) for (let a = 0; a < 12 && !best; a++) { const q: Vec3 = [m.char.pos[0] + Math.sin(a * Math.PI / 6) * r, 0, m.char.pos[2] + Math.cos(a * Math.PI / 6) * r];
            if (R.free(q) && flat(q, keep) >= ORDERS.manM + 0.6 && flat(q, p) <= 5.5 && !others.some(o => flat(o, q) < 0.7) && !game.col.solidBlocked([m.char.pos[0], 0.5, m.char.pos[2]], [q[0], 0.5, q[2]])) best = q; }
          if (best) { R.put(m, best); O.give('hold', O.targetAt(best), O.squad().indexOf(m)); moved = true; } }
        const was = R.up.map((m: any) => [m.char.pos[0], 0, m.char.pos[2]]); R.step(30);
        if (!moved && R.up.every((m: any, k: number) => flat(m.char.pos, was[k]) < 0.05)) break; }
      return ok; },
    /** the cursor held on the world point p while the camera settles on Sam (a teleport leaves it catching up for a few frames) */
    aim(p: number[], n = 24) { for (let i = 0; i < n; i++) { W.cursorAt([p[0], p[1], p[2]]); R.step(); } },
    /** Sam walked toward p on his own feet (the keys, straight at it) until `there` (default: on it) */
    walk(p: number[], secs = 8, there: () => boolean = () => flat(game.player.char.pos, p) <= 0.3) { const I = input;
      for (let i = 0; i < secs * 60 && !there(); i++) { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k); const pos = game.player.char.pos, dx = p[0] - pos[0], dz = p[2] - pos[2], d = Math.hypot(dx, dz), { fwd, right } = W.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;
        if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); R.step(); }
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k); R.step(); return there(); },
    /** a man set down at p, still */
    put(gd: any, p: number[]) { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.path = []; gd.pathGoal = null; gd.speed = 0; },
    /** put a DEFENDER, and make the place his post in the room fight too: a man the fight has on a move of its own (falling back out of a room it reads as lost)
     *  walks on to where THAT was going from wherever he is put */
    post(gd: any, p: number[]) { R.put(gd, p); const D = game.fight?.defs?.find((x: any) => x.gd === gd); if (!D) return; D.mode = 'hold'; D.station = [p[0], 0, p[2]]; D.room = game.fight.roomAt(p); D.ev = D.room ? D.room.entries.map(() => 0) : []; D.watch = D.want = D.glanceTo = -1; D.glanceUntil = -1; },
  };
  R.step(20);
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;

/** Partitions a charge can go on with room to work: floor on both faces out to `deep` metres, the near face's floor running along the wall for the stand-off,
 *  no door within 2.2 m — nearest Sam's start first (by the walk). Each: the point ON the wall (chest high; `top`: the same place on its top edge — what a camera above always sees of it, for the cursor), the wall as the
 *  module reads it from the near side, standing points either side. */
function partitions(R: Rig, n = 4, deep = 2.6): { p: Vec3; top: Vec3; W: any; near: Vec3; far: Vec3; walk: number }[] {
  const g = R.game, out: { p: Vec3; top: Vec3; W: any; near: Vec3; far: Vec3; walk: number }[] = [], sam = g.player.char.pos;
  // (THE SIDE TO WORK FROM is never a room its defenders stand in while the other face will do: gathered there the squad is in a fight before the charge is
  //  set, and the probe reads the fight. On the rebuilt block the wall nearest the start is the mess's, and its +side is the mess)
  const roomOf = (p: number[]) => g.fight?.roomAt?.(p) ?? null, theirs = new Set(R.hostiles.filter((h: any) => h.state !== 'dead').map((h: any) => roomOf(h.char.pos))); theirs.delete(null);
  for (const w of g.destr.walls.all()) { if (w.kind !== 'wall') continue; const b = w.box, alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2]; if (L < 1.6) continue;
    for (let u = -L + 1.2; u <= L - 1.2 + 1e-6; u += 0.6) { const mid0: Vec3 = alongX ? [b.c[0] + u, 1.05, b.c[2]] : [b.c[0], 1.05, b.c[2] + u], heldSide = (side: number) => theirs.has(roomOf(alongX ? [mid0[0], 0, mid0[2] + side * deep] : [mid0[0] + side * deep, 0, mid0[2]]));
     for (const side of heldSide(1) && !heldSide(-1) ? [-1, 1] : [1, -1]) {
      const mid: Vec3 = mid0, nrm: Vec3 = alongX ? [0, 0, side] : [side, 0, 0];
      const off = (d: number): Vec3 => [mid[0] + nrm[0] * d, 0, mid[2] + nrm[2] * d];
      if (![0.6, 1.2, deep].every(d => R.free(off(d)) && R.free(off(-d)))) continue;
      if (g.col.solidBlocked([off(deep)[0], 0.5, off(deep)[2]], [off(0.3)[0], 0.5, off(0.3)[2]]) || g.col.solidBlocked([off(-deep)[0], 0.5, off(-deep)[2]], [off(-0.3)[0], 0.5, off(-0.3)[2]])) continue;
      if (g.doors.list.some((d: any) => flat(d.frameCentre, mid) < 2.2)) continue;
      const near = off(deep), W = wallAt(g, mid, near); if (!W || !W.ok || W.index !== w.id) continue;
      if (!R.C.standoffPosts(W, 4)) continue;
      const walk = R.pathLen(sam, near); if (!isFinite(walk)) continue;
      out.push({ p: mid, top: [mid[0], b.c[1] + b.h[1], mid[2]], W, near, far: off(-deep), walk }); break; } } }
  // one place a wall, the nearest first — a place worked from floor nobody holds before one worked from a defenders' room
  const held = (x: { near: Vec3 }) => theirs.has(roomOf(x.near)) ? 1 : 0;
  const seen = new Set<number>(); return out.sort((a, b) => held(a) - held(b) || a.walk - b.walk).filter(x => !seen.has(x.W.index) && !!seen.add(x.W.index)).slice(0, n);
}
/** full-height walls a charge will not cut, by the word the module has for each */
function structure(R: Rig): Map<string, { p: Vec3; near: Vec3 }> {
  const g = R.game, out = new Map<string, { p: Vec3; near: Vec3 }>(), boxes = g.col.boxes;
  for (let i = 0; i < Math.min(g.destr.walls.authored, boxes.length); i++) { const b = boxes[i]; if (g.destr.walls.breakableAt(i) || (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Dynamic))) continue;
    const alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2]; if (L < 1.0 || b.c[1] + b.h[1] < 2.2) continue;
    for (let u = -L + 0.8; u <= L - 0.8 + 1e-6; u += 0.8) for (const side of [1, -1]) { const T = alongX ? b.h[2] : b.h[0];
      const mid: Vec3 = alongX ? [b.c[0] + u, 1.05, b.c[2] + side * T] : [b.c[0] + side * T, 1.05, b.c[2] + u], near: Vec3 = alongX ? [mid[0], 0, mid[2] + side * 1.5] : [mid[0] + side * 1.5, 0, mid[2]];
      if (!R.free(near) || !R.free(alongX ? [mid[0], 0, mid[2] + side * 0.6] : [mid[0] + side * 0.6, 0, mid[2]])) continue;
      const W = wallAt(g, mid, near); if (!W || W.ok || W.index !== i) continue;
      const key = W.why.split('.')[0]; if (!out.has(key)) out.set(key, { p: mid, near }); } }
  return out;
}
const chargePt = (W: any): Vec3 => wallPt(W, 0, 0, 1.05);

// ================================================================ menu
async function probeMenu(scn: string): Promise<boolean> {
  const F = family(`wallcharge-menu: the wall's menu — the floor's rows, row 5 'wall tools ▸', and behind it row 3, the charge (${scn})`);
  const R = await rig(scn, 3); const { O, D, C, game } = R;
  const P = partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides and room to stand off', 'none found'); return F.done(); }
  F.verdict(R.gather(P.near, 75, P.p), 'the squad falls in on Sam by the wall', `Sam ${at(P.near)} · wall #${P.W.index} at ${at(P.p)} · ${R.up.map((m: any) => `${m.callsign} ${f2(flat(m.char.pos, P.near))} m`).join(', ')}`);
  // (open floor: a place that is nobody's — no wall under it, no door, no teammate. In a three-metre room with a door in it every stride from Sam is one of
  //  those, so the search goes on out to the rooms round it)
  const ring: number[][] = [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [1.6, 1.6], [-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6]]; for (let r = 2.4; r <= 6; r += 1.2) for (let a = 0; a < 8; a++) ring.push([Math.sin(a * Math.PI / 4) * r, Math.cos(a * Math.PI / 4) * r]);
  let mFloor: ReturnType<Rig['menuOn']> = null; for (const [dx, dz] of ring) { const q: Vec3 = [P.near[0] + dx, 0, P.near[2] + dz]; if (!R.free(q) || wallAt(game, q) || game.doors.list.some((d: any) => flat(d.frameCentre, q) < ORDERS.doorPickM + 0.3) || R.up.some((m: any) => flat(m.char.pos, q) < ORDERS.manM + 0.2)) continue; const m = R.menuOn(q); if (m && m.kind === 'floor' && !m.wall) { mFloor = m; break; } }
  const mWall = R.menuOn(P.p);
  const keysOk = (m: any) => !!m && m.rows.every((r: any) => r.key === undefined || /^[1-5]$/.test(String(r.key)) || !/^\d$/.test(String(r.key)));
  F.verdict(!!mFloor && mFloor.kind === 'floor' && !mFloor.wall && !/wall/.test(mFloor.ids), 'X on open floor: the floor\'s own menu, no wall row', `floor rows: ${mFloor?.ids} [${mFloor?.keys}]`);
  F.verdict(!!mWall && mWall.kind === 'floor' && mWall.wall && mWall.rows.some((r: any) => String(r.key) === '5' && /^wall tools/.test(r.text)) && mWall.page?.ids === WALL_ORDER && mWall.page?.keys === '3' && /^breach the wall · uses both charges/.test(mWall.page?.rows[0]?.text ?? '') && !mWall.page?.rows[0]?.off && mWall.back && mWall.gone,
    'X on a partition: the floor\'s rows with row 5 = wall tools, and behind it row 3 \'breach the wall · uses both charges\' (Esc steps back, Esc again closes)', `rows: ${mWall?.ids} [${mWall?.keys}] ▸ ${mWall?.page?.ids} [${mWall?.page?.keys}] "${mWall?.page?.rows[0]?.text}" · row 5 "${mWall?.rows.find((r: any) => String(r.key) === '5')?.text}"`);
  { const a = (mFloor?.ids ?? '').split(' '), b = (mWall?.ids ?? '').split(' '), same = a.filter((x: string, i: number) => (mFloor!.keys.split(' ')[i] !== '5')).every((x: string) => b.includes(x));
    F.verdict(same && keysOk(mWall) && keysOk(mWall?.page), 'every other row of the floor\'s menu is on the wall\'s, on its own digit; no digit above 5 on either page', `floor [${mFloor?.keys}] · wall [${mWall?.keys}] · page [${mWall?.page?.keys}]`); }
  const door = [...game.doors.list].sort((x: any, y: any) => flat(x.frameCentre, game.player.char.pos) - flat(y.frameCentre, game.player.char.pos))[0], mDoor = door ? R.menuOn(door.frameCentre) : null;   // (the door nearest Sam: the level's first may be off his screen, and the cursor then is on whatever is at the screen's edge)
  F.verdict(!door || (!!mDoor && mDoor.kind === 'door' && !/wall/i.test(mDoor.ids + (mDoor.page?.ids ?? ''))), 'X on a door: the door\'s menu, untouched', `door rows: ${mDoor?.ids} ▸ ${mDoor?.page?.ids}`);
  // the three presses, nothing held
  const before = D.charges; R.pick(P.p, 5, 3); R.step(5);
  F.verdict(C.ops.length === 1 && O.menu === null && R.input.keys.size === 0 && D.charges === before, 'X, 5, 3 — three taps — and the order is under way: the menu gone, no key held, no charge spent yet (it leaves the bag when it is on the wall)',
    `ops ${C.ops.length} (${C.ops[0]?.phase}) · menu ${O.menu ? 'up' : 'gone'} · keys held ${R.input.keys.size} · charges ${D.charges} · ${R.said.filter(s => /^you:/.test(s)).slice(-1)[0] ?? ''}`);
  // 'direct'
  { const R2 = await rig(scn, 3); WALLCHARGE.menu = 'direct'; R2.step(2); const P2 = partitions(R2)[0]; R2.gather(P2.near, 75, P2.p); const m = R2.menuOn(P2.p);
    F.verdict(!!m && m.rows.some((r: any) => String(r.key) === '5' && /^breach the wall/.test(r.text)) && !m.page && keysOk(m), 'WALLCHARGE.menu \'direct\': the charge is the wall\'s row 5 itself (X, 5)', `rows: ${m?.ids} [${m?.keys}] · row 5 "${m?.rows.find((r: any) => String(r.key) === '5')?.text}"`); WALLCHARGE.menu = 'page'; R.step(2); }
  // the page's posture rows (silent.ts — on in the page, off in the harness): the floor's fifth row is 'go silent'; a wall's fifth is its tools, and 'go silent'
  // stays on the wall's menu below them with no digit (the wheel's); a silent squad sees the charge marked LOUD, and using it ends the silence
  { const SIL = await import(`${ROOT}/src/game/silent.ts`), was = SIL.SILENT.on; const R5 = await rig(scn, 3); SIL.SILENT.on = true; R5.step(3); const P5 = partitions(R5)[0]; R5.gather(P5.near, 75, P5.p);
    try {
      let q5: Vec3 | null = null; for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [1.6, 1.6], [-1.6, -1.6]]) { const q: Vec3 = [P5.near[0] + dx, 0, P5.near[2] + dz]; if (R5.free(q) && !wallAt(R5.game, q) && R5.O.targetAt(q).kind === 'floor') { q5 = q; break; } }
      const mf = q5 ? R5.menuOn(q5, true) : null, fi = (mf?.ids ?? '').split(' '), fk = (mf?.keys ?? '').split(' '), five = fi[fk.indexOf('5')];
      const mw = R5.menuOn(P5.p, true), wi = (mw?.ids ?? '').split(' '), wk = (mw?.keys ?? '').split(' ');
      F.verdict((five === 'silent' || five === 'loud') && wi[wk.indexOf('5')] === WC.WALL_PAGE && wi.includes(five) && wk[wi.indexOf(five)] === '?' && wi.indexOf(five) === wi.length - 1 && keysOk(mw),
        'with the silent / loud rows on (the page): the floor\'s 5 is the posture row; on a wall 5 is its tools and the posture row is still on the menu, last, without a digit', `floor: ${mf?.ids} [${mf?.keys}] · wall: ${mw?.ids} [${mw?.keys}]`);
      if (five === 'silent') { R5.O.give('silent', R5.O.targetAt(q5!), 'all'); R5.step(5); const quiet = SIL.squadSilent(R5.game), m2 = R5.menuOn(P5.p, true), txt = m2?.page?.rows[0]?.text ?? '';
        R5.O.give(WALL_ORDER, R5.O.targetAt(P5.p), 'all'); R5.step(5);
        F.verdict(quiet && / · LOUD/.test(txt) && !SIL.squadSilent(R5.game) && R5.C.ops.length === 1, 'a silent squad: the charge\'s row is marked LOUD like the door\'s, and giving it ends the silence', `silent ${quiet} · row "${txt}" · after the order: ${SIL.squadSilent(R5.game) ? 'STILL SILENT' : 'loud'} · ops ${R5.C.ops.length}`); }
    } finally { SIL.SILENT.on = was; } }
  // structure: the row is there, greyed, with the reason
  const S = structure(R); let shown = 0;
  for (const [key, s] of S) { game.teleportPlayer(s.near); R.step(3); const m = R.menuOn(s.p, true); const row = m?.page?.rows[0]; shown++;
    F.verdict(!!row && row.off && /a charge won't cut it/.test(m!.page!.why[0] ?? ''), `on ${key}: the row is listed, greyed, with why`, `"${row?.text}" off ${row?.off} · why: ${m?.page?.why[0]}`); }
  if (!shown) F.note('no structure wall with floor at its foot found on this level');
  return F.done();
}

// ================================================================ squad
async function probeSquad(scn: string): Promise<boolean> {
  const F = family(`wallcharge-squad: set, stand off, wait for Sam's word, a hole, the far side by the door charge's rule, in through the hole (${scn})`);
  const R = await rig(scn, 5); const { O, D, C, game } = R;
  const P = partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides and room to stand off', 'none found'); return F.done(); }
  R.gather(P.near, 75, P.p);
  const W0 = P.W, T = 2 * (W0.alongX ? W0.box.h[2] : W0.box.h[0]);
  const a: Vec3 = wallPt(W0, 0, 1.2), b: Vec3 = wallPt(W0, 0, -(T + 1.2)), before = R.pathLen(a, b);
  // three of the other side placed: right behind the charge · down the room in its view · behind the next solid thing
  const H = R.hostiles.filter((h: any) => h.state !== 'dead'); const col = game.col;
  const inn: Vec3 = wallPt(W0, 0, -(T + 0.45), 1.1);
  const inView = (q: Vec3) => R.free(q) && !col.solidBlocked(inn, [q[0], 1.1, q[2]]) && flat(q, chargePt(W0)) > DOORTOOLS.knockM + 0.5 && flat(q, chargePt(W0)) < DOORTOOLS.stunM - 0.5;
  const farPts: Vec3[] = []; for (let d = 3.0; d <= 7.5; d += 0.5) for (const du of [0, 1, -1, 2, -2]) { const q = wallPt(W0, du, -(T + d)); if (inView(q)) farPts.push(q); }
  // (a room that runs ALONG the wall, three metres deep — the rebuilt block's mess, a leg of an L — has its floor 'down the room' to one side, not straight in)
  if (!farPts.length) for (let d = 1.0; d <= 7.5; d += 0.5) for (const du of [3, -3, 4, -4, 5, -5, 6, -6]) { const q = wallPt(W0, du, -(T + d)); if (inView(q)) farPts.push(q); }
  // (out of the blast's view AND out of the squad's, from where it gathers and from every mark it stands off on: a man placed past the wall's end in a hall the
  //  squad looks down is shot before the charge goes, and 'untouched' is then asked of a dead man)
  const eyes: Vec3[] = [P.near, ...(C.standoffPosts(W0, 4) ?? [])], unseen = (q: Vec3) => eyes.every(e => col.shotBlocked([e[0], 1.2, e[2]], [q[0], 1.2, q[2]]));
  // (… and out of the view of the WHOLE opening, not of its middle alone: the blast takes a metre and more of wall either side of the charge, and a man hidden from
  //  the middle by the corner of a cupboard is in plain view of the hole's edge — flash-blind by the rule, 'untouched' by the line)
  const mouth: Vec3[] = []; for (let du = -1.5; du <= 1.5 + 1e-6; du += 0.3) for (const d of [0.1, 0.45]) mouth.push(wallPt(W0, du, -(T + d), 1.1));
  const hidPts: Vec3[] = []; for (let d = 1.0; d <= 7.5; d += 0.5) for (const du of [3, -3, 4, -4, 5, -5, 6, -6]) { const q = wallPt(W0, du, -(T + d)); if (R.free(q) && col.solidBlocked(inn, [q[0], 1.1, q[2]]) && col.solidBlocked(wallPt(W0, 0, 0.5, 1.1), [q[0], 1.1, q[2]]) && unseen(q) && mouth.every(e => !R.free(e) || col.solidBlocked(e, [q[0], 1.1, q[2]]))) hidPts.push(q); }
  const close = H[0], far = farPts.length ? H[1] : null, hid = hidPts.length ? H[2] : null;
  if (close) R.post(close, wallPt(W0, 0.2, -(T + 1.1))); if (far) R.post(far, farPts[0]); if (hid) R.post(hid, hidPts[0]);
  for (const h of H) if (h !== close && h !== far && h !== hid && flat(h.char.pos, chargePt(W0)) < DOORTOOLS.stunM + 1) R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);   // (nobody else in reach of it: the count below is these three's)
  R.step(2);
  const c0 = D.charges; R.pick(P.p, 5, 3); const op = C.ops[0];
  F.verdict(!!op && op.phase === 'place' && op.men.length === R.up.length, 'the order by X, 5, 3: every man on it, one of them to the wall', `${op ? `${op.men.length} men · ${op.lead.callsign} sets it at ${at(op.spot)}` : `no order — ${R.said.slice(-2).join(' / ')} · ${R.spoke.slice(-1)[0]?.text ?? ''}`}`);
  if (!op) return F.done();
  const W = op.wall, cp = chargePt(W);
  const setOk = R.until(() => C.set.length === 1, 45), tSet = game.time, lead = op.lead;
  const setAt = at(lead.char.pos), setOff = flat(lead.char.pos, op.spot), word = R.until(() => R.spoke.some(s => s.who === lead.callsign && s.text === 'charge set.'), 4);   // (wallcharge.ts WALLKILL: his word comes once he is clear of the charge — with the rule off, on the frame it is set and nothing is stepped here)
  F.verdict(setOk && D.charges === c0 - WALLCHARGE.cost && setOff < WALLCHARGE.setNear && word, 'a man sets it at the wall: on the wall after setSecs, one charge out of the bag, \'charge set.\'',
    `${lead.callsign} at ${setAt} (${f2(setOff)} m off his spot) · charges ${c0} → ${D.charges} · ${R.beats(op)}`);
  const armed = R.until(() => op.phase === 'armed', 45);
  const dists = R.up.map((m: any) => ({ m, d: flat(m.char.pos, cp), off: wallOff(W, m.char.pos) }));
  F.verdict(armed && dists.every(x => x.d >= WALLCHARGE.standoff[WALLCHARGE.standoff.length - 1] - 0.35 && x.off > 0) && R.spoke.some(s => s.text === 'stood off. your call.') && R.said.some(s => /charge set on the wall — F blows it/.test(s)),
    'the squad stands off: every man on the charge\'s side of the wall, two metres or more from it, and says so', `${dists.map(x => `${x.m.callsign} ${f2(x.d)} m`).join(' · ')} · ${f2(game.time - tSet)} s after it was set`);
  // nothing happens until Sam's word
  R.step(60 * 8);
  F.verdict(op.phase === 'armed' && C.set.length === 1 && !C.holeAt(W) && R.pathLen(a, b) === before && R.up.every((m: any) => flat(m.char.pos, cp) >= 1.6) && O.hud().status !== undefined && C['hudNotes']().some((n: any) => n.key === 'F'),
    'eight seconds on: nothing has happened — the wall whole, the charge on it, the men where they stood, the HUD saying F blows it', `phase ${op.phase} · set ${C.set.length} · route ${f2(R.pathLen(a, b))} m (was ${f2(before)}) · note "${C['hudNotes']()[0]?.text}"`);
  // rear security while they wait (the stack's rule at a door): the two stood furthest from the charge have their eyes spare for the way a man could come; the others' guns stay on the wall
  { const byDist = [...op.men].sort((x: any, y: any) => flat(op.mine.get(y).post, cp) - flat(op.mine.get(x).post, cp)), spare = op.men.filter((m: any) => op.mine.get(m).spare), want = byDist.slice(0, op.men.length >= 4 ? 2 : 1);
    const dd = (m: any) => flat(op.mine.get(m).post, cp), rest = op.men.filter((m: any) => !spare.includes(m));   // (two men the same distance off: either is 'the furthest')
    F.verdict(spare.length === want.length && spare.every((m: any) => rest.every((o: any) => dd(m) >= dd(o) - 1e-6)) && spare.every((m: any) => !!op.mine.get(m).from), 'while they wait, the men stood furthest from the charge watch the squad\'s back (eyes spare, as a stack\'s last men at a door); the rest keep the wall',
      `spare: ${spare.map((m: any) => `${m.callsign} ${f2(flat(op.mine.get(m).post, cp))} m`).join(', ') || 'nobody'} · on the wall: ${op.men.filter((m: any) => !spare.includes(m)).map((m: any) => `${m.callsign} ${f2(flat(op.mine.get(m).post, cp))} m`).join(', ')} · cover dealt ${spare.filter((m: any) => game.cover.has(m)).length} of them an opening`); }
  const upBefore = R.up.length, hp = R.up.map((m: any) => m.state);
  R.press('KeyF'); const tBlow = game.time;
  const hole = op.hole, after = R.pathLen(a, b), q: Vec3 = wallPt(W, hole ? hole.du : 0, -T / 2), q0: Vec3 = [...q] as Vec3, pushed = col.collideCircle(q, 0.3, 0.25, 1.5) ? flat(q, q0) : 0;
  F.verdict(!!hole && hole.half * 2 >= 1.2 && after < 4.5 && after < before && pushed < 0.01 && C.set.length === 0 && C.stats.holes === 1, 'F: a hole a man walks through — the route between the two faces is a few metres, a man\'s circle stands in the gap, the charge is gone off the wall',
    `hole ${hole ? f2(hole.half * 2) : '—'} m wide at ${hole ? f2(hole.du) : '—'} m along from the charge · route ${f2(before)} → ${f2(after)} m · circle pushed ${f2(pushed)} m · ${R.said.filter(s => /^charge blown/.test(s)).slice(-1)[0] ?? ''}`);
  F.verdict(R.up.length === upBefore && R.up.every((m: any) => m.dazzledUntil <= game.time) && C.stats.backblast === 0, 'the squad stood off is unhurt: nobody down, nobody flash-blind', `${R.up.length}/${upBefore} up · dazzled ${R.up.filter((m: any) => m.dazzledUntil > game.time).length} · backblast ${C.stats.backblast} · ${hp.join(',')}`);
  F.verdict((!close || close.state === 'dead') && (!far || (far.state !== 'dead' && far.dazzledUntil > game.time + 1 && far.staggerUntil > game.time)) && (!hid || (hid.state !== 'dead' && hid.dazzledUntil <= game.time)),
    'the far side by the door charge\'s rule: the man right behind it is down, the man down the room in its view is flash-blind and staggered, the man behind the next wall is untouched',
    `behind it (${close ? f2(flat(close.char.pos, cp)) : '—'} m): ${close?.state ?? 'nobody to place'} · in view (${far ? f2(flat(far.char.pos, cp)) : '—'} m): ${far ? `${far.state}, blind ${f2(far.dazzledUntil - game.time)} s, staggered ${f2(far.staggerUntil - game.time)} s` : 'no floor in view to place him'} · out of view: ${hid ? `${hid.state}, blind ${f2(Math.max(0, hid.dazzledUntil - game.time))} s` : 'no such floor'} · knocked ${C.stats.knocked} stunned ${C.stats.stunned}`);
  // in through the hole
  const men = [...op.men]; const ended = R.until(() => !C.ops.includes(op), WALLCHARGE.enterCap + 6);
  // (where he crossed: inside the hole's own record, or — the blast takes more of a partition than the hole it is owed, and a man who stood off further along
  //  comes in at a slant — anywhere the wall's line is open to a man's own circle: what he must never do is cross where wall still stands)
  const gap = (m: any, x: number) => { const c: Vec3 = wallPt(W, x, -T / 2), c0: Vec3 = [...c] as Vec3; return !col.collideCircle(c, m.char.radius, 0.2, 1.5) || flat(c, c0) < 0.01; };
  const through = men.map((m: any) => { const x = op.crossed.get(m); return { m, x, off: wallOff(W, m.char.pos), A: O.of(m), rec: x !== undefined && !!hole && Math.abs(x - hole.du) <= hole.half + 0.3, open: x !== undefined && gap(m, x) }; });
  F.verdict(ended && op.ended === 'in' && C.stats.entries === 1 && through.every(x => x.m.state === 'dead' || ((x.rec || x.open) && x.off < -T)),
    'the squad goes in THROUGH THE HOLE: every man crosses the wall\'s line inside the gap and ends past the far face; the order ends \'in\'', `${through.map(x => `${x.m.callsign} crossed at ${x.x === undefined ? '—' : f2(x.x)} m${x.rec ? '' : x.open ? ' (past the hole\'s record, the wall gone there too)' : ' (WALL STANDS THERE)'}, ${f2(-x.off - T)} m in`).join(' · ')} · hole ${hole ? `${f2(hole.du - hole.half)} to ${f2(hole.du + hole.half)}` : '—'} m · ended '${op.ended}' ${f2(game.time - tBlow)} s after the blast`);
  F.verdict(through.every(x => x.m.state === 'dead' || (x.A && x.A.order === WALL_ORDER && /^holding the (room|hole)$/.test(x.A.there))) && new Set(through.map(x => x.A?.post?.join(','))).size === through.length, 'and ends like every other entry: each man on a point of his own inside, holding the room',
    through.map(x => `${x.m.callsign} ${x.A?.there ?? 'no order'} ${x.A?.post ? at(x.A.post) : ''}`).join(' · '));
  // the door entry's last-out rule (DOORTOOLS.lastOut): three or more in — one man, the last through with a line to it, keeps the hole; nobody ends with a wall at his chest
  { const rear = through.filter(x => x.A?.there === 'holding the hole'), rw = rear[0]?.A?.watch, rp = rear[0]?.m.char.pos, mid: Vec3 = wallPt(W, hole ? hole.du : 0, -T / 2, 1.2);
    const want = WALLCHARGE.hole && DOORTOOLS.lastOut && men.length >= 3 ? 1 : 0, line = !!rw && !!rp && wallOff(W, rw) > 0 && !col.segmentBlocked([rp[0], 1.2, rp[2]], mid);
    F.verdict(rear.length <= 1 && (want === 0 ? rear.length === 0 : rear.length === 0 ? !/hole · /.test(R.beats(op)) : line), want ? 'WALLCHARGE.hole on, three or more in: one man keeps his gun on the hole they came in by (the door entry\'s last-out rule), watching out through it; the others face the room' : 'as shipped (WALLCHARGE.hole off) nobody is told off to the hole: every gun is on the room',
      `${men.length} in · ${rear.length ? `${rear[0].m.callsign} holds the hole from ${at(rp!)}, watch ${at(rw!)} (${f2(wallOff(W, rw!))} m out on the team's old side), line to the gap ${line}` : 'nobody holds the hole'} · ${(R.beats(op).match(/hole · [^|]+/) ?? ['no hole beat'])[0]}`);
    const walled = through.filter(x => x.m.state !== 'dead' && x.A?.face !== undefined && x.A.post && col.solidBlocked([x.A.post[0], 1.2, x.A.post[2]], [x.A.post[0] + Math.sin(x.A.face) * 0.9, 1.2, x.A.post[2] + Math.cos(x.A.face) * 0.9]));
    F.verdict(walled.length === 0, 'no man is left on his point facing a wall an arm away', walled.map(x => `${x.m.callsign} at ${at(x.A.post)}`).join(' · ') || `${through.length} men, all with a metre clear ahead`); }
  if (VERBOSE) console.log(`    beats: ${R.beats(op)}`);
  return F.done();
}

// ================================================================ sam
async function probeSam(scn: string): Promise<boolean> {
  const F = family(`wallcharge-sam: with no squad — the Space row at the foot of a partition, setSecs on it, F, and through (${scn})`);
  const R = await rig(scn, 7, { squad: false }); const { D, C, game, input } = R;
  const P = partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  const W0 = P.W, T = 2 * (W0.alongX ? W0.box.h[2] : W0.box.h[0]), foot = wallPt(W0, 0, 0.55), a: Vec3 = wallPt(W0, 0, 1.2), b: Vec3 = wallPt(W0, 0, -(T + 1.2)), before = R.pathLen(a, b);
  const rowNow = () => game.nearby.find((r: any) => r.kind === 'wall' && r.verb === 'charge'), marker = () => game.interactables.find((r: any) => r.kind === 'wall');
  game.teleportPlayer(wallPt(W0, 0, 2.4)); R.aim(P.top);
  const farRow = rowNow(), farMark = marker();
  F.verdict(R.team.length === 0 && !farRow && !!farMark && !farMark.inReach && /step closer/.test(farMark.line2), 'two metres off, cursor on the partition: its marker says step closer, no row yet', `squad ${R.team.length} · marker "${farMark?.line1} — ${farMark?.line2}" · row ${farRow ? 'offered' : 'none'}`);
  game.teleportPlayer(foot); R.aim(P.top);
  const row = rowNow();
  F.verdict(!!row && /^Space {2}breach the wall · uses both charges/.test(row.line2) && row.inReach, 'at its foot: the Space row \'breach the wall · uses both charges\' — the squad\'s row\'s own words', `row "${row?.line2}" · ${game.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' ')}`);
  // the row never costs him another: it ranks last of everything that takes one of the MAX_NEAR rows, and with nothing left in the bag the partition offers nothing at all
  // (OWN_ROW: the selector's 'cancel', and a stuck camera's 'take it back' — player.ts isOwn lists it past the MAX_NEAR, so its rank under the wall's takes no row from anything)
  { const { interactOrder, MAX_NEAR, INTERACT_PRIORITY } = await import(`${ROOT}/src/game/player.ts`), p = game.player.char.pos, OWN_ROW = ['cancel', 'wall', 'cam'];
    const door = { kind: 'door', pos: [p[0] + 0.9, 1, p[2]], line1: 'door', line2: '', inReach: true, off: false }, things = [{ it: row ?? { kind: 'wall', pos: p, inReach: true }, verbs: ['wall:charge'] }, { it: door, verbs: ['door:pick', 'door:rattle', 'door:kick'] }];
    things.sort((x: any, y: any) => interactOrder(p)(x.it, y.it)); const top = things.flatMap(t => t.verbs).slice(0, MAX_NEAR), rest = Object.entries(INTERACT_PRIORITY).filter(([k]) => !OWN_ROW.includes(k)), last = rest.every(([, v]) => (v as number) < INTERACT_PRIORITY.wall);
    F.verdict(!!row && last && !top.includes('wall:charge') && top.length === MAX_NEAR, 'three other rows in reach (a locked door\'s) beside the partition: the wall\'s row is not among the three — it ranks after every other kind that takes one of them', `top ${MAX_NEAR}: ${top.join(' ')} · wall ranks ${INTERACT_PRIORITY.wall}, the rest ≤ ${Math.max(...rest.map(([, v]) => v as number))} · a row of its own past the three: ${OWN_ROW.filter(k => k !== 'wall' && k in INTERACT_PRIORITY).map(k => `${k} ${(INTERACT_PRIORITY as any)[k]}`).join(', ')}`);
    const c0 = D.charges; D.charges = 0; R.step(2); R.aim(P.top); const m0 = marker(), r0 = rowNow(); D.charges = c0; R.step(2); R.aim(P.top);
    F.verdict(!m0 && !r0 && !!rowNow(), 'no charge left in the bag: no row and no marker on the partition; one back in the bag and the row is back', `charges 0: marker ${m0 ? 'shown' : 'none'}, row ${r0 ? 'offered' : 'none'} · charges ${c0}: row ${rowNow() ? 'offered' : 'none'}`); }
  // a step breaks it off, nothing spent
  const sel = game.selectVerb('wall', 'charge'); R.press('Space'); R.step(30);
  const setting = C.setting, run = game.nearby.length === 1 && game.nearby[0].running ? game.nearby[0] : null, prog = run?.progress ?? 0;
  game.teleportPlayer(wallPt(W0, 0.7, 0.55)); R.step(3);
  F.verdict(sel && setting && prog > 0.1 && !C.setting && C.set.length === 0 && D.charges === DOORTOOLS.charges && R.said.includes('charge not set'), 'a tap on the row starts it (the one running row, its ring filling); a step away half a second in breaks it off — nothing on the wall, nothing spent', `setting ${setting} (row "${run?.line2}", ring ${f2(prog)}) → ${C.setting} · set ${C.set.length} · charges ${D.charges} · "${R.said.slice(-1)[0]}"`);
  // Space again, and Esc, break it off like every sustained verb (interact.ts); a checkpoint waits for him (savestate.ts playerBusy)
  { game.teleportPlayer(wallPt(W0, 0, 0.55)); R.aim(P.top); const again = () => { R.step(20); R.aim(P.top); const ok = game.selectVerb('wall', 'charge'); R.press('Space'); R.step(20); return ok && C.setting; };
    const a1 = again(), busy = (await import(`${ROOT}/src/game/savestate.ts`)).playerBusy(game); R.press('Space'); R.step(3); const off1 = !C.setting;
    const a2 = again(); R.press('Escape'); R.step(3); const off2 = !C.setting;
    F.verdict(a1 && off1 && a2 && off2 && busy === 'setting a charge' && C.set.length === 0 && D.charges === DOORTOOLS.charges, 'Space again breaks it off, and so does Esc; while he is at it a checkpoint sees him busy', `started ${a1} → Space: ${off1 ? 'off' : 'STILL ON'} · started ${a2} → Esc: ${off2 ? 'off' : 'STILL ON'} · busy "${busy}" · set ${C.set.length} · charges ${D.charges}`); }
  game.teleportPlayer(foot); R.aim(P.top); game.selectVerb('wall', 'charge'); R.press('Space'); const t0 = game.time;
  const done = R.until(() => C.set.length === 1, DOORTOOLS.setSecs + 1);
  F.verdict(done && Math.abs(game.time - t0 - DOORTOOLS.setSecs) < 0.2 && D.charges === DOORTOOLS.charges - WALLCHARGE.cost && input.keys.size === 0 && R.said.some(s => /charge set on the wall — F blows it/.test(s)) && C.stats.bySam === 1, 'stood on it for setSecs with no key held: the charge is on the wall, one out of the bag, and he is told F blows it',
    `set after ${f2(game.time - t0)} s (setSecs ${DOORTOOLS.setSecs}) · charges ${D.charges} · keys held ${input.keys.size} · "${R.said.slice(-1)[0]}"`);
  R.step(60 * 5); F.verdict(C.set.length === 1 && !C.holeAt(C.set[0].wall) && R.pathLen(a, b) === before, 'five seconds on: nothing has happened', `set ${C.set.length} · route ${f2(R.pathLen(a, b))} m`);
  const Wc = C.set[0].wall; game.teleportPlayer(wallPt(Wc, 3.0, 0.8)); R.step(3); R.press('KeyF');
  const hole = C.holeAt(Wc), after = R.pathLen(a, b);
  F.verdict(!!hole && hole.half * 2 >= 1.2 && after < 4.5 && C.set.length === 0 && C.ops.length === 0, 'F from three metres along the wall: a hole a man fits through; no order follows (nobody to send)', `hole ${hole ? f2(hole.half * 2) : '—'} m · route ${f2(before)} → ${f2(after)} m · ops ${C.ops.length} · "${R.said.filter(s => /^charge blown/.test(s)).slice(-1)[0]}"`);
  if (hole) { const near = wallPt(Wc, hole.du, 0.9), far = wallPt(Wc, hole.du, -(T + 0.9)); game.teleportPlayer(near); R.step(3); const ok = R.walk(far, 8, () => wallOff(Wc, game.player.char.pos) < -(T + 0.4)), pos = game.player.char.pos;
    F.verdict(ok && wallOff(Wc, pos) < -T, 'Sam walks through it on his own feet', `from ${at(near)} to ${at(pos)} (${f2(-wallOff(Wc, pos) - T)} m past the far face)`); }
  // structure: no row
  let n = 0; for (const [key, s] of structure(R)) { const Ws = wallAt(game, s.p, s.near)!; game.teleportPlayer(wallPt(Ws, 0, 0.55)); R.aim([s.p[0], Ws.box.c[1] + Ws.box.h[1], s.p[2]]); n++;
    F.verdict(!marker() && !rowNow(), `at the foot of ${key}: no row, no marker (the squad's menu is where the reason is said)`, `nearby: ${game.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' ') || 'nothing'}`); }
  if (!n) F.note('no structure wall with floor at its foot on this level');
  return F.done();
}

// ================================================================ refusals
async function probeRefusals(scn: string): Promise<boolean> {
  const F = family(`wallcharge-refusals: each said in words by a man, nothing spent, nothing under way (${scn})`);
  const R = await rig(scn, 9); const { O, D, C, game } = R;
  const P = partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  const T = 2 * (P.W.alongX ? P.W.box.h[2] : P.W.box.h[0]);
  const refused = (label: string, want: RegExp, fn: () => string | null, undo?: () => void) => { const n0 = R.spoke.length, c0 = D.charges, why = fn(), heard = R.spoke.slice(n0).find(s => want.test(s.text));
    F.verdict(!!why && want.test(why) && !!heard && D.charges === c0 && C.ops.length === 0 && C.set.length === 0, label, `"${why}" · said by ${heard?.who ?? 'nobody'} · charges ${D.charges} · ops ${C.ops.length}`); undo?.(); R.step(2); };
  let n = 0;
  for (const [key, s] of structure(R)) { game.teleportPlayer(s.near); R.step(3); n++; refused(`${key}: a charge won't cut it`, new RegExp(`^${key}\\. a charge won't cut it\\.$`), () => O.give(WALL_ORDER, O.targetAt(s.p), 'all')); }
  if (!n) F.note('no structure wall with floor at its foot on this level'); else F.note(`structure found here: ${[...structure(R).keys()].join(', ')}`);
  R.gather(P.near, 75, P.p);
  const give = (who: any = 'all') => O.give(WALL_ORDER, O.targetAt(P.p), who);
  { const c = D.charges; D.charges = 0; refused('none left', /^no charges left\.$/, () => give(), () => { D.charges = c; }); }
  { const keep = { s: WALLCHARGE.standoff, b: WALLCHARGE.backM, ss: WALLCHARGE.safeStandoff, h: WALLCHARGE.safeHideM }; WALLCHARGE.standoff = [60]; WALLCHARGE.backM = []; WALLCHARGE.safeStandoff = [60, 60]; WALLCHARGE.safeHideM = 0;   // (the safety radius's marks too, where WALLCHARGE.safe is on: with those the floor always had somewhere)
    refused('no floor to stand off on (the stand-off distances forced past the room)', /^no room to stand off\.$/, () => give(), () => { WALLCHARGE.standoff = keep.s; WALLCHARGE.backM = keep.b; WALLCHARGE.safeStandoff = keep.ss; WALLCHARGE.safeHideM = keep.h; }); }
  if (R.up.length >= 2) { const mate = R.up[R.up.length - 1], home = [...mate.char.pos] as Vec3;
    R.O.give('hold', R.O.targetAt(game.player.char.pos), 'all'); R.step(2); R.up.forEach((m: any, i: number) => { if (i > 0) R.put(m, wallPt(P.W, 0, 4.5 + 0.9 * i)); });   // (the others well back; the first man is the one ordered)
    R.put(mate, wallPt(P.W, 0.3, -(T + 1.4))); R.step(1);
    refused('a teammate behind the wall (outside the order, in the blast once it is a hole)', new RegExp(`^${mate.callsign} is behind that wall\\.$`), () => give(0));
    R.put(mate, wallPt(P.W, 0.9, 0.8)); R.step(1);
    refused('a teammate too close to it on its own side (outside the order)', new RegExp(`^${mate.callsign} is too close to that wall\\.$`), () => give(0), () => { R.put(mate, home); R.gather(P.near, 75, P.p); }); }
  // one man with no walk to the wall (a pocket of floor no path reaches): he says so and is left as he was — the others set it. Alone, it is his refusal
  // (the pocket: a ring of walk-grid cells shut round a clear patch of floor well back from the wall, as a folding screen across a corner makes one; opened again after)
  const nav = game.col.nav, pocket = (() => { for (let d = 7; d <= 14; d += 0.5) for (const du of [0, 2, -2, 4, -4, 6, -6]) { const q = wallPt(P.W, du, d), cx = Math.floor(q[0] / nav.cell), cz = Math.floor(q[2] / nav.cell);
      if (cx < 3 || cz < 3 || cx >= nav.W - 3 || cz >= nav.H - 3) continue; let free = true; for (let z = -1; z <= 1 && free; z++) for (let x = -1; x <= 1; x++) if (nav.blocked[nav.idx(cx + x, cz + z)]) { free = false; break; }
      if (!free || R.up.some((m: any) => flat(m.char.pos, q) < 2.5) || flat(game.player.char.pos, q) < 2.5) continue;
      const ring: [number, number][] = []; for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (Math.max(Math.abs(x), Math.abs(z)) === 2) { const i = nav.idx(cx + x, cz + z); ring.push([i, nav.blocked[i]]); }
      return { at: [(cx + 0.5) * nav.cell, 0, (cz + 0.5) * nav.cell] as Vec3, shut: () => ring.forEach(([i]) => { nav.blocked[i] = 1; }), open: () => ring.forEach(([i, v]) => { nav.blocked[i] = v; }) }; } return null; })();
  if (!pocket) F.note('no clear patch of floor back from the wall to make a pocket of');
  if (pocket && R.up.length >= 2) { const mate = R.up[R.up.length - 1], home = [...mate.char.pos] as Vec3;
    pocket.shut(); R.put(mate, pocket.at); R.step(2); const was = O.of(mate);
    refused('the one man addressed has no walk to the wall', /^can't get there\.$/, () => give(mate));
    const n0 = R.spoke.length, c0 = D.charges, why = give(), op = C.ops[0], heard = R.spoke.slice(n0).find(s => s.who === mate.callsign && /^can't get there\.$/.test(s.text));
    F.verdict(why === null && C.ops.length === 1 && !!op && !op.men.includes(mate) && op.men.length === R.up.length - 1 && O.of(mate) === was && !!heard && D.charges === c0,
      'a teammate with no walk to the wall is left out with his own word: the others take the order', `give: ${why} · ops ${C.ops.length} · men on it ${op?.men.map((m: any) => m.callsign).join(', ')} · ${mate.callsign} ${heard ? `said "${heard.text}"` : 'said nothing'}, his order ${O.of(mate) === was ? 'as it was' : 'changed'}`);
    pocket.open(); R.put(mate, home); R.gather(P.near, 75, P.p); F.verdict(C.ops.length === 0 && C.set.length === 0 && D.charges === c0, '… and called back before it is set: nothing under way, nothing spent', `ops ${C.ops.length} · set ${C.set.length} · charges ${D.charges}`); }
  // already on it · it's open
  const first = give(); R.step(3);
  F.verdict(first === null && C.ops.length === 1, 'the order itself is taken', `give: ${first} · ops ${C.ops.length} (${C.ops[0]?.phase})`);
  { const n0 = R.spoke.length, why = give(), heard = R.spoke.slice(n0).find(s => /already on it/.test(s.text)); F.verdict(why === 'already on it.' && !!heard && C.ops.length === 1, 'given again while a man is on his way to set it: already on it', `"${why}" · said by ${heard?.who ?? 'nobody'} · ops ${C.ops.length}`); }
  R.until(() => C.ops[0]?.phase === 'armed', 60); const Wc = C.set[0]?.wall; C.blow(); R.until(() => C.ops.length === 0, 30);
  { const hole = Wc ? C.holeAt(Wc) : null, c0 = D.charges, n0 = R.spoke.length; game.teleportPlayer(wallPt(Wc, hole?.du ?? 0, 2.5)); R.step(3);
    const why = hole ? O.give(WALL_ORDER, O.targetAt(wallPt(Wc, hole.du, -T / 2, 1.05)), 'all') : 'no hole', heard = R.spoke.slice(n0).find(s => /it's open/.test(s.text));
    F.verdict(why === "it's open." && !!heard && D.charges === c0 && C.ops.length === 0, 'on the hole it made: it\'s open', `"${why}" · said by ${heard?.who ?? 'nobody'} · charges ${D.charges}`); }
  return F.done();
}

// ================================================================ trigger
async function probeTrigger(scn: string): Promise<boolean> {
  const F = family(`wallcharge-trigger: F blows the nearer of a wall's and a door's charge, and only it; the menu's row is the same trigger (${scn})`);
  const R = await rig(scn, 11); const { O, D, C, game } = R;
  const P = partitions(R)[0]; if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  R.gather(P.near, 75, P.p); O.give(WALL_ORDER, O.targetAt(P.p), 'all'); const armed = R.until(() => C.ops[0]?.phase === 'armed', 60);
  F.verdict(armed && C.set.length === 1, 'a wall charge set and the squad stood off', `phase ${C.ops[0]?.phase} · set ${C.set.length}`);
  const Wc = C.set[0].wall, cp = chargePt(Wc);
  // a door's charge set too (the record a door order leaves once its man has set it), far from the wall's
  const door = [...game.doors.list].filter((d: any) => !d.def.steel && d.isClosed()).sort((x: any, y: any) => flat(y.frameCentre, cp) - flat(x.frameCentre, cp))[0];
  if (door) { D.set.push({ door, side: 1, t: game.time, by: 'probe' });
    game.teleportPlayer(P.near); R.step(2); const dW = flat(game.player.char.pos, cp), dD = flat(game.player.char.pos, door.frameCentre);
    R.press('KeyF'); R.step(2);
    F.verdict(dW < dD && C.set.length === 0 && D.set.length === 1 && !!C.holeAt(Wc), 'Sam nearer the wall\'s: one F — the wall goes, the door\'s charge is still on its door', `Sam ${f2(dW)} m from the wall's, ${f2(dD)} m from ${door.def.name}'s · wall set ${C.set.length} · door set ${D.set.length} · hole ${C.holeAt(Wc) ? 'open' : 'none'}`);
    D.set.length = 0; }
  else F.note('no shut wooden door on this level to hang the second charge on');
  // the other way round, on a fresh game: the door's is nearer — the wall's waits
  { const R2 = await rig(scn, 11); const P2 = partitions(R2)[0]; R2.gather(P2.near, 75, P2.p); R2.O.give(WALL_ORDER, R2.O.targetAt(P2.p), 'all'); R2.until(() => R2.C.ops[0]?.phase === 'armed', 60);
    const W2 = R2.C.set[0].wall, d2 = [...R2.game.doors.list].filter((d: any) => !d.def.steel && d.isClosed()).sort((x: any, y: any) => flat(y.frameCentre, chargePt(W2)) - flat(x.frameCentre, chargePt(W2)))[0];
    if (d2) { R2.D.set.push({ door: d2, side: 1, t: R2.game.time, by: 'probe' }); const hinge: Vec3 = [d2.frameCentre[0], 0, d2.frameCentre[2]], q = R2.game.col.nav.nearestFreePoint(hinge[0], hinge[2]); R2.game.teleportPlayer([q[0], 0, q[2]]); R2.step(2);
      R2.press('KeyF'); R2.step(2);
      F.verdict(R2.C.set.length === 1 && R2.D.set.length === 0 && !R2.C.holeAt(W2) && R2.C.ops[0]?.phase === 'armed', 'Sam nearer the door\'s: one F — the door\'s goes, the wall\'s waits, its squad still stood off', `wall set ${R2.C.set.length} (${R2.C.ops[0]?.phase}) · door set ${R2.D.set.length}`);
      R2.press('KeyF'); R2.step(2);
      F.verdict(R2.C.set.length === 0 && !!R2.C.holeAt(W2), 'F again: now the wall\'s', `wall set ${R2.C.set.length} · hole ${R2.C.holeAt(W2) ? 'open' : 'none'}`); }
    // the menu's row
    const R3 = await rig(scn, 11); const P3 = partitions(R3)[0]; R3.gather(P3.near, 75, P3.p); R3.O.give(WALL_ORDER, R3.O.targetAt(P3.p), 'all'); R3.until(() => R3.C.ops[0]?.phase === 'armed', 60);
    const m = R3.menuOn(P3.p, true), W3 = R3.C.set[0].wall; R3.O.open(R3.O.targetAt(P3.p)); R3.step(2); R3.press('Digit5'); R3.step(4); R3.press('Digit3'); R3.step(2);   // (the menu opened on the wall by code: a man stood off along it can stand under the cursor's ray)
    F.verdict(/^blow the charge( · too close: .+)?( · behind the wall: .+)?$/.test(m?.page?.rows[0]?.text ?? '') && R3.C.set.length === 0 && !!R3.C.holeAt(W3) && (R3.C.ops[0]?.phase === 'wait' || R3.C.ops[0]?.phase === 'enter'), 'with one set, the wall\'s row reads \'blow the charge\' (naming who is too close, under the safety radius), and 5, 3 on the wall\'s menu is the trigger: the squad goes in behind it', `row "${m?.page?.rows[0]?.text}" · set ${R3.C.set.length} · hole ${R3.C.holeAt(W3) ? 'open' : 'none'} · op ${R3.C.ops[0]?.phase}`); }
  // the setter taken off it before it is set (given another order; the same clause as down): the next man sets it — the order does not die with him
  { const R4 = await rig(scn, 11); const P4 = partitions(R4)[0]; R4.gather(P4.near, 75, P4.p); R4.O.give(WALL_ORDER, R4.O.targetAt(P4.p), 'all'); R4.step(20);
    const op = R4.C.ops[0], first = op?.lead, i = R4.up.indexOf(first), back: Vec3 = [R4.game.player.char.pos[0], 0, R4.game.player.char.pos[2]];
    const why = first && op.phase === 'place' ? R4.O.give('hold', R4.O.targetAt(back), i) : 'no op'; R4.step(3);
    const second = R4.C.ops[0]?.lead, set = R4.until(() => R4.C.set.length === 1, 60), armed = R4.until(() => R4.C.ops[0]?.phase === 'armed', 30);
    F.verdict(!why && !!second && second !== first && set && R4.C.set[0].by === second.callsign && armed && !R4.C.ops[0].men.includes(first) && R4.D.charges === DOORTOOLS.charges - WALLCHARGE.cost,
      'the setter given another order on his way to the wall: the next man sets it, and the rest stand off as before', `first ${first?.callsign} → hold (${why ?? 'given'}) · now ${second?.callsign} · set by ${R4.C.set[0]?.by} · ${R4.C.ops[0]?.phase} · men on it ${R4.C.ops[0]?.men.length}`); }
  return F.done();
}

// ================================================================ reset
async function probeReset(scn: string): Promise<boolean> {
  const F = family(`wallcharge-reset: a restart and a checkpoint's load leave no charge behind (${scn})`);
  { const R = await rig(scn, 13); const { O, D, C, game } = R; const P = partitions(R)[0]; if (!P) { F.verdict(false, 'a partition', 'none found'); return F.done(); }
    R.gather(P.near, 75, P.p); O.give(WALL_ORDER, O.targetAt(P.p), 'all'); R.until(() => C.set.length === 1, 60); const Wc = C.set[0]?.wall, had = { set: C.set.length, ops: C.ops.length, charges: D.charges };
    game.restartEncounter(); R.step(5);
    F.verdict(had.set === 1 && had.ops === 1 && had.charges === DOORTOOLS.charges - WALLCHARGE.cost && C.set.length === 0 && C.ops.length === 0 && D.charges === DOORTOOLS.charges && !C.holeAt(Wc),
      'a restart with one on the wall and its order under way: nothing set, nothing under way, the bag full, the wall whole', `before: set ${had.set} ops ${had.ops} charges ${had.charges} · after: set ${C.set.length} ops ${C.ops.length} charges ${D.charges} · hole ${C.holeAt(Wc) ? 'open' : 'none'}`);
    R.press('KeyF'); R.step(3); F.verdict(!C.holeAt(Wc) && C.stats.blown === 0, 'F after the restart blows nothing', `blown ${C.stats.blown}`); }
  { const R = await rig(scn, 13); const { O, C, game } = R; const P = partitions(R)[0]; R.gather(P.near, 75, P.p); O.give(WALL_ORDER, O.targetAt(P.p), 'all'); R.until(() => C.ops[0]?.phase === 'armed', 60); const Wc = C.set[0].wall; C.blow(); R.step(30);
    const open = !!C.holeAt(Wc); game.restartEncounter(); R.step(5);
    F.verdict(open && !C.holeAt(Wc) && C.set.length === 0 && C.ops.length === 0, 'a restart after the blast, mid-entry: the wall is back (the engine\'s), no order, no charge', `hole before ${open} · after ${C.holeAt(Wc) ? 'open' : 'whole'} · ops ${C.ops.length}`); }
  // Sam alone: checkpoints (a save is refused with a unit on the floor, so these are his own charges)
  { const R = await rig(scn, 13, { squad: false }); const { D, C, game } = R; const P = partitions(R)[0]; const foot = wallPt(P.W, 0, 0.55);
    const setOne = () => { game.teleportPlayer(foot); R.aim(P.top, 150) /* (the camera is a long way behind a teleport across the floor: until it is over Sam the cursor is not on this wall, and there is no row to press) */; game.selectVerb('wall', 'charge'); R.press('Space'); return R.until(() => C.set.length === 1, DOORTOOLS.setSecs + 1); };
    const ok1 = setOne(), Wc = C.set[0]?.wall; let s1: any = null, err = ''; try { s1 = R.W.snapshot('wallcharge', true); } catch (e) { err = String(e); }
    if (!s1) F.note(`a checkpoint was refused here (${err.split('\n')[0]}) — the load half is not checked on this level`);
    else { R.step(30); R.W.restore(s1); R.step(5);
      F.verdict(ok1 && C.set.length === 0 && D.charges === DOORTOOLS.charges && !C.holeAt(Wc), 'a checkpoint taken with a charge on the wall, loaded: no charge on the wall, the bag full, the wall whole (a set charge is not saved)', `set ${C.set.length} · charges ${D.charges} · ${JSON.stringify(s1).includes('wallCharge') ? 'the file names the module' : 'nothing of it in the file'}`);
      R.press('KeyF'); R.step(2); const none = !C.holeAt(Wc);
      const ok2 = setOne(); game.teleportPlayer(wallPt(C.set[0].wall, 3, 0.8)); R.step(2); R.press('KeyF'); R.step(5); const W2 = Wc, open = !!C.holeAt(W2);
      const s2 = R.W.snapshot('wallcharge-2', true); R.step(20); R.W.restore(s2); R.step(5);
      F.verdict(none && ok2 && open && !!C.holeAt(W2) && C.set.length === 0 && C.ops.length === 0, 'F after that load blows nothing; a checkpoint taken after a blast, loaded: the hole is still there (the engine\'s save), no charge anywhere', `F after load: ${none ? 'nothing' : 'A HOLE'} · hole before ${open} → after load ${C.holeAt(W2) ? 'open' : 'whole'} · set ${C.set.length} · charges ${D.charges}`); } }
  return F.done();
}

// ================================================================ off
async function probeOff(scn: string): Promise<boolean> {
  const F = family(`wallcharge-off: the switch off (either one) is the build without the module (${scn})`);
  const P = partitions(await rig(scn, 3))[0]; if (!P) { F.verdict(false, 'a partition', 'none found'); return F.done(); }   // (the place, found with the module live; the level is the same in every rig below)
  for (const [label, o] of [['WALLCHARGE.on false', { wc: false }], ['the destruction\'s switch down', { sw: false }], ['chaos 0', { chaos: 0 }]] as [string, any][]) {
    const R = await rig(scn, 3, o); const { O, D, C, game } = R;
    R.gather(P.near, 75, P.p); const t = O.targetAt(P.p), mW = R.menuOn(P.p, true), mF = (() => { O.open({ kind: 'floor', at: t.at }); R.step(2); const ids = O.menu?.rows.map((r: any) => r.id).join(' '); O.close(); return ids; })();
    const why = O.give(WALL_ORDER, t, 'all'); R.step(3);
    game.teleportPlayer(wallPt(P.W, 0, 0.55)); R.aim(P.top); const row = game.interactables.find((r: any) => r.kind === 'wall');
    C.set.push({ wall: P.W, t: game.time, by: 'probe', paid: 0 }); R.press('KeyF'); R.step(3); const blown = C.stats.blown, hole = (o.sw === false || o.chaos === 0) ? false : !!C.holeAt(P.W);
    F.verdict(!t.wall && mW?.ids === mF && !/wall/i.test(mW?.ids ?? '') && !!why && C.ops.length === 0 && !row && blown === 0 && !hole && D.charges === DOORTOOLS.charges && !O.defs.some((d: any) => d.id === WALL_ORDER),
      `${label}: the wall's target is plain floor, its menu the floor's, the order unknown, no Space row, F does nothing, the rows are not registered`, `target.wall ${!!t.wall} · menu "${mW?.ids}" vs floor "${mF}" · give: ${why} · row ${row ? 'OFFERED' : 'none'} · blown ${blown}`);
  }
  // a played half-minute with the module on and nobody using it digests as with it off
  const run = async (o: any) => { const R = await rig(scn, 21, { still: false, ...o }); const { O, game } = R; let h = '';
    const tick = (n: number) => { for (let i = 0; i < n; i++) { R.step(); if (i % 30 === 0) h = hashDigest(digestGame(game, true)) + h.slice(0, 24); } };
    Math.random = seeded(0x51ed);
    tick(60); O.give('fallIn', O.targetAt(game.player.char.pos), 'all'); tick(240);
    R.W.cursorAt(P.p); tick(60); O.give('move', O.targetAt(P.p), 'all'); tick(600); O.give('hold', O.targetAt(game.player.char.pos), 'all'); tick(600);
    return h; };
  const on = await run({}), off = await run({ wc: false });
  F.verdict(on === off, 'twenty-six played seconds (fall in, a move ordered onto a wall\'s foot, a hold; everyone live) with the module on and unused = with it off, digest for digest', `on ${on.slice(0, 16)} · off ${off.slice(0, 16)}`);
  const dOn = await run({ sw: false }), dOff = await run({ sw: false, wc: false });
  F.verdict(dOn === dOff, 'the same with the destruction\'s switch down', `on ${dOn.slice(0, 16)} · off ${dOff.slice(0, 16)}`);
  return F.done();
}


// ================================================================ hold (the room after the entry; where the order's marks may be)
const segNear = (q: number[], a: number[], b: number[]): number => { const dx = b[0] - a[0], dz = b[2] - a[2], L = dx * dx + dz * dz, k = L > 1e-9 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / L)) : 0; return Math.hypot(q[0] - a[0] - dx * k, q[2] - a[2] - dz * k); };

/** every place on a partition the scripted commander could take (both faces, half a metre apart) with room for four to stand off */
function allSites(R: Rig): { W: any; mid: Vec3; near: Vec3; far: Vec3 }[] {
  const g = R.game, out: { W: any; mid: Vec3; near: Vec3; far: Vec3 }[] = [];
  for (const w of g.destr.walls.all()) { if (w.kind !== 'wall') continue; const b = w.box, alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2], T = alongX ? b.h[2] : b.h[0];
    for (let u = -L + 0.75; u <= L - 0.75 + 1e-6; u += 0.5) for (const side of [1, -1]) {
      const mid: Vec3 = alongX ? [b.c[0] + u, 1.05, b.c[2]] : [b.c[0], 1.05, b.c[2] + u], off = (d: number): Vec3 => { const k = side * Math.sign(d) * (T + Math.abs(d)); return alongX ? [mid[0], 0, mid[2] + k] : [mid[0] + k, 0, mid[2]]; };
      const near = off(0.9), far = off(-0.9); if (!R.free(near) || !R.free(far)) continue;
      const W = wallAt(g, mid, near); if (!W || !W.ok || W.index !== w.id) continue;
      out.push({ W, mid, near, far }); } }
  return out;
}
async function probeHold(scn: string): Promise<boolean> {
  const F = family(`wallcharge-hold: after the entry the room's doors are held, and none of the order's marks is in a doorway or at the foot of a hole (${scn})`);
  let R = await rig(scn, 5); let { C, game } = R;
  // (1) THE MARKS: no stand-off post of any place on any partition is in a door frame — and with the rule off, the count the level had. The rule's own
  //     fallback is held to its word too (wallcharge.ts standoffPosts: 'where that leaves no room for them all, the marks as they would have been'): a place
  //     the rule could not deal four marks for out of doorways is dealt exactly the marks it had without the rule, and such a place is the only one that may
  //     show one. WHAT THIS LINE CANNOT TELL: 'dealt as without the rule' is also what a rule that MISSED that one mark would look like — so no more than one
  //     such place a floor is let through, and the level must show fewer doorway marks with the rule than without
  const inFrame = (p: number[]) => game.doors.list.find((d: any) => flat(p, d.frameCentre) < 0.6);
  const deal = () => allSites(R).map(s => ({ s, posts: C.standoffPosts(s.W, 4) as Vec3[] | null }));   // (the same places in the same order both times)
  const tally = (L: ReturnType<typeof deal>) => { let sites = 0; const bad: string[] = [], at2: number[] = []; L.forEach((x, i) => { if (!x.posts) return; sites++; let any = false; for (const p of x.posts) { const d = inFrame(p); if (d) { bad.push(`${d.def.name} ${at(p)}`); any = true; } } if (any) at2.push(i); }); return { sites, bad, at: at2 }; };
  if (process.env.OFFFRAME_BREAK === '1') WALLCHARGE.offFrame = 0;   // (OFFFRAME_BREAK=1: the rule never on and the same line asked — must fail wherever the level had a doorway mark)
  const onL = deal(); WALLCHARGE.offFrame = 0; const offL = deal(); WALLCHARGE.offFrame = WALLCHARGE_DEFAULTS.offFrame;
  const on = tally(onL), off = tally(offL), fell = on.at.filter(i => JSON.stringify(onL[i].posts) === JSON.stringify(offL[i].posts)), stray = on.at.length - fell.length;
  F.verdict(on.sites > 0 && stray === 0 && fell.length <= 1 && (off.bad.length === 0 || on.bad.length < off.bad.length), 'no stand-off post of any wall place on the level is in a doorway (inside 0.6 m of a door frame\'s centre) — but for at most one place a floor that is dealt exactly the marks it had without the rule (the rule\'s own fallback: no four marks for it out of doorways), and fewer doorway marks than without the rule',
    `${on.sites} places with room for four to stand off · in a doorway: ${on.bad.length}${fell.length ? ` (${fell.map(i => `the place at ${at(onL[i].s.mid)}: dealt as without the rule — ${[...new Set(on.bad)].join(', ')}`).join(' · ')})` : ''}${stray ? ` · ${stray} place(s) with a doorway mark the rule could have kept out` : ''} · with WALLCHARGE.offFrame 0 (as it was): ${off.bad.length} of ${off.sites}${off.bad.length ? ` — ${[...new Set(off.bad)].slice(0, 4).join(', ')}` : ''}`);
  // (2) A HOLE ALREADY IN THE WALL: a second charge further along it stands nobody off at the old hole's foot
  { const P = partitions(R, 12).find(x => { const b = x.W.box, L = x.W.alongX ? b.h[0] : b.h[2]; return L >= 3.6; });
    if (!P) F.note('no partition long enough for two charges: the old-hole rule is not exercised on this level');
    else { const W = P.W, b = W.box, c = W.alongX ? b.c[0] : b.c[2], L = W.alongX ? b.h[0] : b.h[2];
      game.destr.blast(wallPt(W, 0, 0.06, WALLCHARGE.height), { who: 0, chaos: false }); R.step(2); const hole = C.holeAt(W);
      const tries = [2.8, -2.8, 3.2, -3.2, 2.4, -2.4].map(d => ({ ...W, u: W.u + d })).filter(w => w.u > c - L + 0.75 && w.u < c + L - 0.75 && !C.openAt(w));
      const atHole = (w: any, p: number[]) => hole !== null && wallOff(W, p) > 0 && wallOff(W, p) < 1.0 && Math.abs(wallAlong(W, p) - hole.du) < hole.half + 0.1;
      let seen = 0, bad = 0, was = 0; for (const w of tries) { const posts = C.standoffPosts(w, 4); if (posts) { seen++; bad += posts.filter((p: Vec3) => atHole(w, p)).length; } WALLCHARGE.offHoles = false; const old = C.standoffPosts(w, 4); WALLCHARGE.offHoles = true; if (old) was += old.filter((p: Vec3) => atHole(w, p)).length; }
      if (!hole || !seen || !was) F.note(`the old-hole rule is not exercised here (${!hole ? 'the blast left no hole' : !seen ? 'no second place on that wall with room to stand off' : 'no second place whose posts would have stood at the hole\'s foot'})`);
      else F.verdict(bad === 0, 'with a hole already in the wall, a charge further along it stands nobody off at the foot of the old hole', `hole ${f2(hole.half * 2)} m wide · ${tries.length} second places, ${seen} with room to stand off · posts at the hole's foot: ${bad} (with WALLCHARGE.offHoles off: ${was})`); } }
  // (3) THE ROOM'S DOORS: a wall into a room with doors of its own — once they are in, each door a point has a line to has one man's gun on it
  const run = async (doors: boolean) => {
    R = await rig(scn, 5); ({ C, game } = R); const { O } = R; WALLCHARGE.doors = doors; const fight = game.fight, sam = game.player.char.pos;
    const cands = partitions(R, 60).map(x => ({ ...x, mid: x.p })).filter(s => { const r = fight.roomAt(s.far); return !!r && r !== fight.roomAt(s.near) && r.entries.length > 0; });
    const seenW = new Set<number>(); let spare: any = null;
    const dbg = (m: string) => { if (process.env.HOLD_DEBUG) console.log('    [hold] ' + m); }; dbg(`${cands.length} candidate places`);
    for (const S of cands) { if (seenW.has(S.W.index) || seenW.size >= 6) continue; seenW.add(S.W.index);
      if (!R.gather(S.near, 60, S.mid)) { dbg(`gather failed ${at(S.near)}`); continue; }
      for (const h of R.hostiles) if (flat(h.char.pos, S.mid) < DOORTOOLS.stunM + 2) R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
      R.D.charges = DOORTOOLS.charges;   // (a fresh bag for each place tried: a wall takes all of it)
      const why = C.order(S.mid, 'all'); if (why) { dbg(`refused ${why}`); continue; } const op = C.ops[C.ops.length - 1];
      if (!R.until(() => op.phase === 'armed' || !C.ops.includes(op), 45) || op.phase !== 'armed') { dbg(`not armed: ${op.phase} ${op.ended}`); continue; }
      C.blow(C.chargeOn(op.wall)); const men = [...op.men];
      // (the lines are counted on the frame the men are DEALT their points inside — the floor the deal saw, from the points it dealt. By the time the
      //  entry has ended and settled a defender may have opened one of the room's doors, and its leaf standing in a line then is no fault of the
      //  deal: the gun is on a door that now stands open. Who holds what, and where his gun is, is still read once they have settled)
      const dealt = () => op.queue.length + op.pod.size > 0;
      if (!R.until(() => dealt() || !C.ops.includes(op), WALLCHARGE.enterCap + 6) || !dealt()) { dbg(`not in: ${op.phase} ${op.ended}`); continue; }
      const pts: Vec3[] = [...op.queue.map((q: any) => q.pod.pos), ...[...op.pod.values()].map((q: any) => q.pos)];
      const T = 2 * (op.wall.alongX ? op.wall.box.h[2] : op.wall.box.h[0]), room = fight.roomAt(wallPt(op.wall, op.hole.du, -(T + WALLCHARGE.mouthIn)));
      const ins = (room?.entries ?? []).map((e: any) => ({ name: e.door.def.name as string, p: [e.at[0] - e.out[0] * 0.5, 1.2, e.at[2] - e.out[1] * 0.5] as Vec3 })).filter((e: any) => wallOff(op.wall, e.p) < -T);
      const lined = ins.filter((e: any) => pts.some((p: Vec3) => wallOff(op.wall, p) < 0 && flat(p, e.p) >= 0.8 && !game.col.shotBlocked([p[0], 1.2, p[2]], e.p) && !pts.some((o: Vec3) => o !== p && segNear(o, p, e.p) < WALLCHARGE.mateLine)));
      if (!R.until(() => !C.ops.includes(op), WALLCHARGE.enterCap + 6) || op.ended !== 'in') { dbg(`not in: ${op.phase} ${op.ended}`); continue; }
      R.step(90);
      const holders = men.map((m: any) => { const A = O.of(m), w = A?.watch, e = w ? ins.find((x: any) => flat(x.p, w) < 0.05) : null; return { m, A, e, off: w ? Math.abs(Math.atan2(Math.sin(m.char.aimYaw - Math.atan2(w[0] - m.char.pos[0], w[2] - m.char.pos[2])), Math.cos(m.char.aimYaw - Math.atan2(w[0] - m.char.pos[0], w[2] - m.char.pos[2])))) : NaN }; });
      if (!ins.length) { dbg(`no inside door: room ${room ? room.entries.length : 'none'}`); continue; }
      const got = { S, op, men, ins, lined, holders };
      if (doors && !(lined.length && men.filter((m: any) => wallOff(op.wall, m.char.pos) < 0).length >= 2)) { dbg('no door with a line, or one man in: the next place'); spare ??= got; continue; }   // (the claim wants a room where a door CAN be held)
      return got;
    }
    return spare;
  };
  const A = await run(true);
  if (!A) F.note('no wall on this level leads into a room with a door of its own that the squad could take: the doors rule is not exercised here');
  else { const held = A.holders.filter((h: any) => h.e), names = held.map((h: any) => h.e.name);
    const inMen = A.men.filter((m: any) => wallOff(A.op.wall, m.char.pos) < 0), want = Math.min(A.lined.length, inMen.length - 1);
    if (want === 0) F.note('no place on this level where a point inside has a line to a door of the room with two men in: the lines below hold on nothing');
    F.verdict(want === 0 ? held.length === 0 : held.length >= 1 && held.length <= want, 'in through the wall, the room looked over: of the room\'s own doors that a point has a line to, one or more is held, a man each — and one man at least keeps the room',
      `wall at ${at(A.S.mid)} · the room's doors past it: ${A.ins.map((e: any) => e.name).join(', ')} · with a line from a point: ${A.lined.map((e: any) => e.name).join(', ') || 'none'} · held: ${held.map((h: any) => `${h.e.name} by ${h.m.callsign}`).join(', ') || 'none'} · ${A.holders.filter((h: any) => !h.e).length} keep the room`);
    F.verdict(new Set(names).size === names.length && held.every((h: any) => h.off < 0.25 && h.A.order === WALL_ORDER && flat(h.m.char.pos, h.A.post) < 0.5), 'no door has two men; each holder is on his point with his gun ON his door (a man who comes through it comes onto a muzzle already there: no turn to make)',
      held.map((h: any) => `${h.m.callsign} ${f2(h.off * 180 / Math.PI)}° off ${h.e.name}`).join(' · ') || 'nobody holds a door');
    F.verdict(held.every((h: any) => !A.men.some((o: any) => o !== h.m && segNear(o.char.pos, h.m.char.pos, h.A.watch) < 0.45)), 'no holder has a mate down his muzzle: his line to his door passes clear of every other man',
      held.map((h: any) => `${h.m.callsign}: nearest mate ${f2(Math.min(...A.men.filter((o: any) => o !== h.m).map((o: any) => segNear(o.char.pos, h.m.char.pos, h.A.watch))))} m off his line`).join(' · ') || 'nobody holds a door');
    F.verdict(A.men.every((m: any) => !game.doors.list.some((d: any) => flat(m.char.pos, d.frameCentre) < 0.45)), 'nobody ends the entry stood in a doorway', A.men.map((m: any) => at(m.char.pos)).join(' '));
    const B = await run(false);
    F.verdict(!!B && B.holders.every((h: any) => !h.A?.watch || wallOff(B.op.wall, h.m.char.pos) > 0), 'WALLCHARGE.doors off: every gun stays on the room, as it was (nobody is given a door)', B ? `${B.holders.filter((h: any) => h.A?.watch).length} men with a watch point of ${B.men.length}` : 'the entry did not run'); }
  return F.done();
}

// ================================================================ cost: a wall takes the whole bag (or a carried wall charge)
async function probeCost(scn: string): Promise<boolean> {
  const F = family(`wallcharge-cost: one wall or two doors — the bag holds a wall's cost or the row is refused (${scn})`);
  const place = (R: Rig) => partitions(R)[0];
  const label = (R: Rig, P: any): string => (R.C as any).row.label(R.O.targetAt(P.p));
  const door = (R: Rig) => R.game.doors.list.find((d: any) => !d.def.steel && !d.lockBroken && Math.abs(d.angle ?? 0) < 0.02) ?? null;   // (a shut leaf: an open one is refused as open before the bag is looked at)
  // the default: both charges
  { const R = await rig(scn, 21); const { O, D, C } = R; const P = place(R); if (!P) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
    R.gather(P.near, 75, P.p); const words = label(R, P), c0 = D.charges, why = O.give(WALL_ORDER, O.targetAt(P.p), 'all'); R.until(() => C.set.length === 1, 60);
    F.verdict(WALLCHARGE.cost === 2 && c0 === 2 && words === 'breach the wall · uses both charges' && !why && C.set.length === 1 && C.set[0].paid === 2 && D.charges === 0 && C.wallsLeft === 0,
      'a full bag: the row says it uses both charges, the wall is set and the bag is empty', `cost ${WALLCHARGE.cost} · "${words}" · ${why ? `refused "${why}"` : 'given'} · charges ${c0} → ${D.charges} · paid ${C.set[0]?.paid}`);
    const n0 = R.spoke.length, d = door(R), dwhy = d ? O.give('charge', O.targetAt(d.frameCentre), 'all') : null;
    F.verdict(!d || (typeof dwhy === 'string' && /no charges left/.test(dwhy)), 'with the wall set, a door charge is refused in the door tool\'s own words', d ? `"${dwhy}" · said by ${R.spoke.slice(n0).find(s => /no charges left/.test(s.text))?.who ?? 'nobody'}` : 'no door on this level');
    WALLCHARGE.on = false; R.step(3);
    F.verdict(C.set.length === 0 && D.charges === 2 && C.stats.back === 1, 'the charge comes off the wall unblown (the module switched off): both are back in the bag', `set ${C.set.length} · charges ${D.charges} · back ${C.stats.back}`); }
  // one left: no wall, a door still
  { const R = await rig(scn, 21); const { O, D, C } = R; const P = place(R); R.gather(P.near, 75, P.p); D.charges = 1; R.step(2);
    const n0 = R.spoke.length, why = O.give(WALL_ORDER, O.targetAt(P.p), 'all'), heard = R.spoke.slice(n0).find(s => s.text === 'not enough charge for a wall.');
    const d = door(R), dwhy = d ? O.give('charge', O.targetAt(d.frameCentre), 'all') : null;
    F.verdict(why === 'not enough charge for a wall.' && !!heard && D.charges === 1 && C.ops.length === 0 && C.set.length === 0 && C.wallsLeft === 0, 'one charge left: the wall is refused aloud, nothing spent',
      `"${why}" · said by ${heard?.who ?? 'nobody'} · charges ${D.charges} · ops ${C.ops.length}`);
    F.verdict(!d || !(typeof dwhy === 'string' && /no charges left/.test(dwhy)), 'and a door charge is still to be had with that one', d ? (dwhy ? `door order: "${dwhy}"` : 'door order given') : 'no door on this level'); }
  // Sam alone: the same price, the row gone below it
  { const R = await rig(scn, 21, { squad: false }); const { D, C, game } = R; const P = place(R), foot = wallPt(P.W, 0, 0.55);
    const rowNow = () => (game.nearby as any[]).find(i => i.kind === 'wall');
    game.teleportPlayer(foot); R.step(3); R.aim(P.top); const full = rowNow(); D.charges = 1; R.step(2); R.aim(P.top); const one = rowNow(); D.charges = 2; R.step(2);
    F.verdict(!!full && !one, 'Sam alone: the row is there with a full bag and gone with one charge in it', `full bag: ${full ? 'row' : 'no row'} · one charge: ${one ? 'row' : 'no row'}`); }
  // cost 1: the build before the knob
  { const R = await rig(scn, 21); WALLCHARGE.cost = 1; const { O, D, C } = R; const P = place(R); R.gather(P.near, 75, P.p); const words = label(R, P), why = O.give(WALL_ORDER, O.targetAt(P.p), 'all'); R.until(() => C.set.length === 1, 60);
    F.verdict(words === 'breach with a charge · 2 left' && !why && C.set[0]?.paid === 1 && D.charges === 1 && C.wallsLeft === 1, 'cost 1: the old words, one charge spent, one left for a second wall or a door', `"${words}" · charges ${D.charges} · paid ${C.set[0]?.paid}`); }
  // carried wall charges (the kit's hook)
  { const R = await rig(scn, 21); const { O, D, C, game } = R; const P = place(R); R.gather(P.near, 75, P.p);
    // (the squad block says what is carried — read where the HUD reads it: orders.ts hud()'s rows — while the run brought wall charges, and nothing under the cost rule or with none brought)
    const block = () => { const sq = (O.hud().status ?? []).find((b: any) => /^squad/.test(b.label ?? '')); if (!sq) return 'no squad block';
          return (sq.opts ?? []).map((o: any) => o.text as string).filter((t: string) => /^wall charges /.test(t)).join(' / ') || 'no line'; };
    C.setCarried(null); const hud0 = block(); C.setCarried(0); const hudNone = block(); C.setCarried(1); const hud1 = block();
    const words = label(R, P), why = O.give(WALL_ORDER, O.targetAt(P.p), 'all'); R.until(() => C.set.length === 1, 60); const hudSet = block();
    F.verdict(hud0 === 'no line' && hudNone === 'no line' && hud1 === 'wall charges 1' && hudSet === 'wall charges 0', 'the squad block counts the wall charges carried, beside the door tools\' own count: one carried, none left once it is on the wall — and no line under the cost rule or on a run that brought none',
      `cost rule: ${hud0} · none brought: ${hudNone} · one carried: ${hud1} · set: ${hudSet}`);
    F.verdict(words === 'breach with a wall charge · 1 left' && !why && C.set[0]?.paid === 0 && C.carried === 0 && D.charges === 2, 'one wall charge carried: the wall is set out of it and both door charges are still in the bag', `"${words}" · carried ${C.carried} · charges ${D.charges} · paid ${C.set[0]?.paid}`);
    WALLCHARGE.on = false; R.step(3); WALLCHARGE.on = true; R.step(3);
    F.verdict(C.set.length === 0 && C.carried === 1 && D.charges === 2, 'off the wall unblown: it goes back to the carried ones, not into the bag', `carried ${C.carried} · charges ${D.charges}`);
    C.setCarried(1); game.restartEncounter(); R.step(5);
    const kit = R.staged;   // (what the kit's slots rule staged on this stand before the rig put it aside: null where the rule is off)
    F.verdict(kit === null ? C.carried === WALLCHARGE.carried && C.carried === null : C.carried === kit, 'a restart puts the carried count back to the knob (unset): the kit sets it again at each staging', `carried ${C.carried}${kit === null ? '' : ` · the kit stages ${kit}`}`); }
  { const R = await rig(scn, 21); const { O, D, C } = R; const P = place(R); R.gather(P.near, 75, P.p); C.setCarried(0); R.step(2); const n0 = R.spoke.length, why0 = O.give(WALL_ORDER, O.targetAt(P.p), 'all');
    F.verdict((why0 === 'no wall charge carried.' || why0 === 'nobody brought a wall charge.') && R.spoke.slice(n0).some(s => s.text === why0) && D.charges === 2 && C.ops.length === 0, 'none carried: no wall, said aloud, the bag untouched', `"${why0}" · charges ${D.charges}`); }
  // unset = the cost rule, by digest
  { const run = async (unset: boolean) => { const R = await rig(scn, 21); const P = place(R); R.gather(P.near, 75, P.p); if (unset) R.C.setCarried(null); R.O.give(WALL_ORDER, R.O.targetAt(P.p), 'all'); R.until(() => R.C.ops[0]?.phase === 'armed', 60); R.step(30); return hashDigest(digestGame(R.game, true)); };
    const a = await run(false), b = await run(true);
    F.verdict(a === b, 'the hook called with "unset" is the cost rule itself: the same game by digest', `${a} ${a === b ? '=' : '≠'} ${b}`); }
  return F.done();
}


/** the stand-off's own rules (hand-in 2): where the posts may be, how the men wait, the start at the blast, the gun on the way in */
async function probeStandoff(scn: string): Promise<boolean> {
  const F = family(`wallcharge-standoff: no post in the blast's reach, backs to the charge while it waits, a start at the blast, the gun into the hole on the way in (${scn})`);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), yaw = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
  // (1) THE POSTS, over every wall place on the level
  { const R = await rig(scn, 5); const { C, game } = R, sites = allSites(R), lo = WALLS.blast.radius * WALLS.blast.portK + 0.25 + WALLCHARGE.clearM;
    const count = () => { let n = 0, near = 0, seen = 0; for (const s of sites) { const posts = C.standoffPosts(s.W, 4); if (!posts) continue; n++; const T = 2 * (s.W.alongX ? s.W.box.h[2] : s.W.box.h[0]);
        for (const q of posts) { if (Math.abs(wallOff(s.W, q) - WALLCHARGE.postOff) < 0.05 && Math.abs(wallAlong(s.W, q)) < lo - 1e-6) near++;
          if ([1.5, 3.0].some(d => { const r = wallPt(s.W, 0, -(T + d)); return R.free(r) && !game.col.shotBlocked([q[0], 1.2, q[2]], [r[0], 1.2, r[2]]); })) seen++; } } return { n, near, seen }; };
    const on = count(); WALLCHARGE.clearM = 0; const off = count(); restoreKnobs();
    F.verdict(on.n > 0 && on.near === 0, `no post along the wall stands inside what the blast can open (${f2(lo)} m of the charge)`, `${on.n} places with room for four · posts inside it: ${on.near} · with WALLCHARGE.clearM 0 (as it was): ${off.near} of ${off.n} places' posts`);
  }
  // (2) THE WAIT, THE BLAST, THE WAY IN
  const run = async (brace: boolean, watch: number) => { const R = await rig(scn, 5); const { C, game } = R; WALLCHARGE.brace = brace; WALLCHARGE.laneWatch = watch;
    const P = partitions(R)[0]; if (!P) return null; R.gather(P.near, 75, P.p); R.step(2); R.pick(P.p, 5, 3); const op = C.ops[0]; if (!op) return null;
    if (!R.until(() => op.phase === 'armed', 60)) return null; R.step(90);
    const W = op.wall, cp = chargePt(W), T = 2 * (W.alongX ? W.box.h[2] : W.box.h[0]), front = op.men.filter((m: any) => !op.mine.get(m).spare);
    const offCharge = front.map((m: any) => Math.abs(wrap(m.char.aimYaw - yaw(m.char.pos, cp))));   // (0 = his gun on the charge, π = his back to it)
    for (const m of op.men) m.char.anim.hitT = -1;
    const men0 = op.men.length; R.press('KeyF'); const fresh = (t: number | undefined) => t !== undefined && t >= 0 && t < 0.2; const started = op.men.filter((m: any) => fresh(m.char.anim.hitT) || fresh(m.char.anim.mvs?.flT)).length; /* (the old flinch clip's clock, or — the movement pass on, as the page has it — its own duck's) */ R.step(Math.round(60 * (WALLCHARGE.afterBlow - 0.05)));
    const turned = front.map((m: any) => Math.abs(wrap(m.char.aimYaw - yaw(m.char.pos, cp))));
    const watches: { m: any; off: number | null }[] = []; R.until(() => { for (const m of op.men) if (op.stage?.get(m) === 'lane' && !watches.some(w => w.m === m)) { const A = op.mine.get(m); watches.push({ m, off: A?.watch ? wallOff(W, A.watch) + T : null }); } return watches.length >= front.length || !!op.ended; }, 20);
    return { op, front, offCharge, started, turned, watches, men: men0, T, ended: op.ended as string | undefined }; };
  const on = await run(true, WALLCHARGE_DEFAULTS.laneWatch), off = await run(false, 0); restoreKnobs();
  if (!on || !off) { F.verdict(false, 'a wall order set and armed', 'none'); return F.done(); }
  const deg = (r: number[]) => r.map(x => Math.round(x * 180 / Math.PI)).join('°, ') + '°';
  F.verdict(on.front.length > 0 && on.offCharge.every((x: number) => x > Math.PI * 0.75), 'while the charge waits, the men stood off (not the rear men) have their backs to it', `off the charge: ${deg(on.offCharge)} · with WALLCHARGE.brace off (as it was): ${deg(off.offCharge)}`);
  F.verdict(off.front.length > 0 && off.offCharge.every((x: number) => x < 0.5), 'WALLCHARGE.brace off: every gun is on the charge, as it was', deg(off.offCharge));
  F.verdict(on.started === on.men && off.started === 0, 'at the blast every man on the order starts (the animator\'s own flinch); with the knob off nobody does', `started: ${on.started} of ${on.men} · off: ${off.started}`);
  F.verdict(on.turned.every((x: number) => x < 0.6), 'by the time the first man goes they have turned in to the wall', `off the charge ${WALLCHARGE.afterBlow} s after the blast: ${deg(on.turned)}`);
  F.verdict(on.watches.length > 0 && on.watches.every(w => w.off !== null && w.off < -1), 'on his way to the hole each man\'s gun has a point inside the room, through the opening', `${on.watches.map(w => `${w.m.callsign} ${w.off === null ? 'no point' : f2(-w.off) + ' m past the far face'}`).join(' · ')}`);
  { const R2 = await rig(scn, 5); const P2 = partitions(R2)[0]; R2.gather(P2.near, 75, P2.p); R2.step(2); R2.pick(P2.p, 5, 3); const op2 = R2.C.ops[0];
    if (op2 && R2.until(() => op2.phase === 'armed', 60)) { R2.step(90); const cp2 = chargePt(op2.wall), front2 = op2.men.filter((m: any) => !op2.mine.get(m).spare);
      WALLCHARGE.on = false; R2.step(3); WALLCHARGE.on = true; R2.step(60);
      const offs = front2.map((m: any) => Math.abs(wrap(m.char.aimYaw - yaw(m.char.pos, cp2))));
      F.verdict(R2.C.ops.length === 0 && front2.length > 0 && offs.every((x: number) => x < 0.6), 'an order that ends before the blast (the module switched off under it) leaves nobody with his back to the wall', `ops ${R2.C.ops.length} · off the charge a second later: ${deg(offs)}`); }
    else F.verdict(false, 'a second wall order set and armed', 'none'); restoreKnobs(); }
  F.verdict(off.watches.length > 0 && off.watches.every(w => w.off === null), 'WALLCHARGE.laneWatch 0: no point, the gun leads his feet, as it was', `${off.watches.length} men, ${off.watches.filter(w => w.off !== null).length} with a point`);
  return F.done();
}

const FAMILIES: Record<string, (scn: string) => Promise<boolean>> = { menu: probeMenu, squad: probeSquad, sam: probeSam, refusals: probeRefusals, trigger: probeTrigger, reset: probeReset, off: probeOff, hold: probeHold, cost: probeCost, standoff: probeStandoff };
export { rig, partitions, structure, family, chargePt, FAMILIES, SCNS, f2, at, flat, VERBOSE, restoreKnobs };

/** probes.ts's door in (family 'wallcharge'): one family on one map, the switches, the knobs and the dice put back as they were found */
export async function wallchargeFamily(name: string, scn = 'block-squads'): Promise<boolean> {
  const rnd = Math.random, sw = DESTRUCTION.on, wc = WALLCHARGE.on;
  try { return await FAMILIES[name](scn); } finally { restoreKnobs(); Math.random = rnd; DESTRUCTION.on = sw; WALLCHARGE.on = wc; }
}

if (import.meta.main) {
  const which = argv.find(a => !a.startsWith('--') && a !== flag('--scn')) ?? 'all';
  const names = which === 'all' ? Object.keys(FAMILIES) : which.split(',');
  for (const n of names) if (!FAMILIES[n]) { console.error(`unknown family '${n}' — ${Object.keys(FAMILIES).join(', ')}`); process.exit(2); }
  const failed: string[] = [];
  for (const n of names) for (const scn of SCNS) { try { if (!await FAMILIES[n](scn)) failed.push(`${n}:${scn}`); } catch (e) { console.log(`- FAIL — ${n} on ${scn} threw\n    ${e instanceof Error ? e.stack : e}`); FAILS++; failed.push(`${n}:${scn}`); } finally { restoreKnobs(); DESTRUCTION.on = false; } }
  console.log(`\n=== wallcharge-probes ${which}: ${failed.length ? `FAILED — ${failed.join(', ')}` : 'ALL PASS'} · ${CHECKS} checks, ${FAILS} failed ===`);
  process.exit(failed.length ? 1 : 0);
}
