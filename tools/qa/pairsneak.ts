// THE PAIR'S SNEAK RUN — Sam and ONE teammate, the squad told silent and to fall in, walked through a held floor without a shot, while a watcher says WHO it was
// that a defender noticed. The question it answers (rebuild/pair-stealth/partner-sneaks.md): how often is the partner the one who gets the pair seen — with the
// partner's sneaking (game/sneak.ts SNEAK.on) off, and with it on — against the same scripted player alone.
//   bun run tools/qa/pairsneak.ts trace <route> <dice> [solo|off|on] [--hard] [--set '{…}']    one run with its timeline
//   bun run tools/qa/pairsneak.ts tally [--routes a,b] [--seeds 1-144] [--arms solo,off,on] [--jobs 8] [--hard] [--set '{"SNEAK":{…}}'] [--json out.json]
//   bun run tools/qa/pairsneak.ts routes                                                       the routes, one line each
// THE SCRIPTED PLAYER is ON THE FLOOR (Sam on his own feet and keys: WASD along the nav path, C, Space on a door's rows, the pistol's right button on a
// fixture, X and a digit on the order menu). He is one fixed plan per route — a player who knows the floor and sneaks it well: crouched, along the dark side,
// behind the defenders' backs — and the dice (`dice`: the seed of Math.random) move the defenders' glances. He is MORTAL AND SEEN: his light meter is the CPU's
// estimate of the direct light on him (guards.ts lightEstimateAt, his own lights skipped — what a teammate's meter falls back on headless), through the game's
// own curve. The `solo` arm (nobody with him) is the plan's own failure rate: what the pair's numbers are read against.
// THE WATCHER: every frame, for every living defender, what his eyes take of Sam and of the partner (the game's own canSee / sightGain and canSeeChar /
// sightGainOn), kept as a three-second leaky sum per man. The frame a defender first leaves 'patrol' (awareness 0.3: 'huh?') and the frame he is first NOTICING
// (alert, searching, or awareness at silent.ts's `noticed` 0.5 — the line a silent teammate's hold-fire reads) are filed with whose shape filled his eyes: the
// partner's, Sam's, both (the larger named), or neither (a noise: the last hearing event inside 12 m of him is named). The run ENDS at the first noticing, or
// with Sam through the route and the partner back at his shoulder (within `joinM` inside `joinSecs`: a partner who is never seen because he never came is 'left').
// WHAT IT IS NOT: no GPU (no bounce light, no smoke, no picture); one plan per route; nobody shoots and nobody is taken down (those are the orders' and the
// compromise parts' — this is the walk).
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { standUp, ROOT } from './headless.ts';
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { lightEstimateAt, canSee, canSeeChar, sightGain, sightGainOn } = await import(`${ROOT}/src/game/guards.ts`);
const { SILENT, squadSilent } = await import(`${ROOT}/src/game/silent.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
const { feelTables } = await import(`${ROOT}/src/game/teamfeel.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
// (the partner's sneaking: a build without the file is the base — every arm but 'on' runs there)
const SNEAKM: any = await import(`${ROOT}/src/game/sneak.ts`).catch(() => null);

type Vec3 = [number, number, number];
const DT = 1 / 60;
export function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
async function quiet<T>(on: boolean, fn: () => T | Promise<T>): Promise<T> { if (!on) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }

export type Arm = 'solo' | 'off' | 'on';
class Stop extends Error { constructor(public why: string) { super(why); } }
/** who a defender's eyes were full of when he noticed: the partner · Sam · neither (a noise) */
export type Whom = 'mate' | 'sam' | 'noise';
export interface Notice { t: number; by: string; whom: Whom; what: string; mate: number; sam: number; at: number[]; mateAt: number[] | null; samAt: number[]; mateCrouch: number; mateVis: number; samVis: number; mateSpeed: number }
export interface Out {
  route: string; dice: number; arm: Arm; hard: boolean;
  /** clean: through, nobody noticing, the partner with him · mate / sam / noise: who a defender noticed first · left: through and clean, the partner never came · stall: the plan did not get through (cap, a door row missing) · error */
  end: 'clean' | 'mate' | 'sam' | 'noise' | 'left' | 'stall' | 'error';
  t: number; why: string;
  /** the first 'huh?' (a defender off 'patrol') and the first noticing, each with whose shape it was */
  huh: Notice | null; noticed: Notice | null;
  /** seconds a defender's eyes had the partner / Sam at all (a sight gain over 0.05), summed over defenders */
  mateSeenS: number; samSeenS: number;
  /** the highest awareness any defender reached */
  peak: number;
  /** the partner: metres walked, seconds crouched / upright while moving, the furthest he was from Sam, seconds he took to rejoin at the end, seconds he waited on the sneak's word (SNEAK_STATS) */
  mate: { m: number; crouchS: number; uprightS: number; farM: number; joinS: number; lit: number; stats?: Record<string, number> } | null;
  digest?: string; trace?: string[];
}

/** ONE GAME, Sam's hands, the watcher. */
export class Run {
  W: any; g: any; I: any; cam: any; t = 0; goal: number[] | null = null; trace: string[] = []; verbose = false; cap = 200;
  huh: Notice | null = null; noticed: Notice | null = null; mateSeenS = 0; samSeenS = 0; peak = 0;
  mateM = 0; crouchS = 0; uprightS = 0; farM = 0; litS = 0; movS = 0;
  private eyes = new Map<any, { mate: number; sam: number }>(); private wasState = new Map<any, string>(); private matePrev: number[] | null = null; private msgLast: any = null; private logN = SNEAKM ? SNEAKM.SNEAK_LOG.length : 0; private said = new Map<any, string>();
  digest = 0; private digestT = 0; stopOnNotice = true;
  static async start(query: string, dice: number, opts: { verbose?: boolean; hard?: boolean; sneak?: boolean; set?: Record<string, Record<string, unknown>>; level?: string } = {}): Promise<Run> {
    Math.random = seeded(0x51ea + dice * 7919);
    const R = new Run(); R.verbose = !!opts.verbose;
    const level = opts.level ? loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${opts.level}`, 'utf8'))) : undefined;
    R.W = await quiet(true, () => standUp({ uploadEvery: 2, ...(level ? { level } : {}) })); R.g = R.W.game; R.I = R.W.input; R.cam = R.W.cam;
    SILENT.on = true;   // (the shipped default: the harness stands the game up with the order off the menu)
    setDifficulty(opts.hard ? 'hard' : 'standard', false);
    if (SNEAKM) SNEAKM.SNEAK.on = !!opts.sneak;
    if (opts.set) { const T: any = { ...feelTables(), SILENT, ...(SNEAKM ? { SNEAK: SNEAKM.SNEAK } : {}) }; for (const [n, kv] of Object.entries(opts.set)) { if (!T[n]) throw new Error(`--set: no table '${n}'`); Object.assign(T[n], kv); } }
    const { why } = await quiet(!opts.verbose, () => startFromQuery(R.g, new URLSearchParams(query))); if (why) throw new Error(`start refused — ${why}`);
    R.step(20);
    return R;
  }
  get pos(): number[] { return this.g.player.char.pos; }
  get pl(): any { return this.g.player; }
  get ops(): any[] { return this.g.nightBreach.ops; }
  get mate(): any | null { const m = this.ops[0]; return m && m.state !== 'dead' ? m : null; }
  get hostiles(): any[] { return this.g.nightBreach.hostiles; }
  door(name: string): any { const d = this.g.doors.list.find((d: any) => d.def.name === name); if (!d) throw new Stop(`no door '${name}'`); return d; }
  say(s: string) { const line = `[${clock(this.t)}] ${s}`; this.trace.push(line); if (this.verbose) console.log(line); }
  step(n = 1) {
    const g = this.g, I = this.I;
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      const goal = this.goal;
      if (goal && !g.player.down) { const dx = goal[0] - this.pos[0], dz = goal[2] - this.pos[2], d = Math.hypot(dx, dz);
        if (d > 0.12) { const { fwd, right } = this.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      // Sam's light meter, as the harness can have it: the CPU estimate of the direct light on him (his own lights skipped), through the game's own mapping
      { const c = g.player.char, pc = c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]], ph = c.bones.head ?? [c.pos[0], 1.6, c.pos[2]], own = (o: number) => o === PLAYER_ID;
        g.player.visibility = g.visibilityOf(Math.max(lightEstimateAt(g, pc, own), lightEstimateAt(g, ph, own))); }
      this.W.step(DT); this.t += DT;
      this.watch();
      if (this.t - this.digestT >= 0.5) { this.digestT = this.t; this.digest = (Math.imul(this.digest, 31) + parseInt(hashDigest(digestGame(g, true)), 16)) | 0; }
      if (this.verbose) { const M = g.messages, last = M[M.length - 1]; if (last && last !== this.msgLast) { const i = M.indexOf(this.msgLast); for (const m of M.slice(i + 1)) this.say(`   “${m.text}”`); this.msgLast = last; }
        if (SNEAKM) for (; this.logN < SNEAKM.SNEAK_LOG.length; this.logN++) { const e = SNEAKM.SNEAK_LOG[this.logN]; this.say(`   · ${e.who} ${e.what} at ${at([e.at[0], 0, e.at[1]])}`); }
        for (const o of this.ops) { const b = o.bubble; if (b && this.said.get(o) !== b.text) { this.said.set(o, b.text); this.say(`   ${o.callsign}: “${b.text}”`); } } }
      if (g.player.down) throw new Stop('Sam is down');
      if (this.noticed && this.stopOnNotice) throw new Stop('noticed');
      if (this.t >= this.cap) throw new Stop('time cap');
    }
  }
  /** the watcher (the head comment) */
  private watch() {
    const g = this.g, mate = this.mate, K = Math.exp(-DT / 3);
    if (mate) { const p = mate.char.pos, sp = Math.hypot(mate.char.vel[0], mate.char.vel[2]);
      if (this.matePrev) { const d = flat(p, this.matePrev); if (d < 1) this.mateM += d; } this.matePrev = [p[0], 0, p[2]];
      if (sp > 0.3) { this.movS += DT; if (mate.char.anim.crouch > 0.5) this.crouchS += DT; else this.uprightS += DT; this.litS += mate.visibility * DT; }
      this.farM = Math.max(this.farM, flat(p, this.pos)); }
    for (const h of this.hostiles) {
      if (h.state === 'dead') continue;
      let E = this.eyes.get(h); if (!E) this.eyes.set(h, E = { mate: 0, sam: 0 });
      const vs = canSee(g, h), gs = vs.visible ? sightGain(g, h, vs.dist) : 0;
      const vm = mate ? canSeeChar(g, h, mate.char, false) : null, gm = vm?.visible ? sightGainOn(g, h, mate, vm.dist) : 0;
      E.sam = E.sam * K + gs * DT; E.mate = E.mate * K + gm * DT;
      if (gs > 0.05) this.samSeenS += DT; if (gm > 0.05) this.mateSeenS += DT;
      if (this.verbose && process.env.PS_EYES && gm > 0.05 && Math.round(this.t * 60) % 30 === 0) this.say(`   ~ ${h.callsign} on partner: gain ${gm.toFixed(2)} at ${at(mate!.char.pos)} lit ${mate!.visibility.toFixed(2)} crouch ${mate!.char.anim.crouch.toFixed(1)} d ${vm!.dist.toFixed(1)} · ${SNEAKM?.sneakWord(g, mate) ?? '-'} · sam ${at(this.pos)}`);
      this.peak = Math.max(this.peak, h.awareness);
      const was = this.wasState.get(h) ?? 'patrol'; this.wasState.set(h, h.state);
      const note = (what: string): Notice => {
        let whom: Whom = E!.mate < 0.02 && E!.sam < 0.02 ? 'noise' : E!.mate >= E!.sam ? 'mate' : 'sam', w = what;
        if (whom === 'noise') { const ev = [...g.events].reverse().find((e: any) => g.time - e.time < 2 && flat(e.pos, h.char.pos) < 12 && e.kind !== 'step'), st = ev ?? [...g.events].reverse().find((e: any) => g.time - e.time < 2 && flat(e.pos, h.char.pos) < 9);
          if (st) { w += ` · heard ${st.kind}${st.who !== undefined ? ` of ${st.who === PLAYER_ID ? 'Sam' : g.guards.find((x: any) => x.char.id === st.who)?.callsign ?? st.who}` : ''} at ${at(st.pos)}`; if (st.who !== undefined && mate && st.who === mate.char.id) whom = 'mate'; else if (st.who === undefined || st.who === PLAYER_ID) whom = 'sam'; } }
        return { t: this.t, by: h.callsign, whom, what: w, mate: E!.mate, sam: E!.sam, at: [...h.char.pos], mateAt: mate ? [...mate.char.pos] : null, samAt: [...this.pos], mateCrouch: mate?.char.anim.crouch ?? 0, mateVis: mate?.visibility ?? 0, samVis: g.player.visibility, mateSpeed: mate ? Math.hypot(mate.char.vel[0], mate.char.vel[2]) : 0 }; };
      const words = (N: Notice) => `${N.by} ${N.what} — ${N.whom === 'mate' ? `the PARTNER (at ${N.mateAt ? at(N.mateAt) : '—'}, crouch ${f1(N.mateCrouch)}, lit ${Math.round(N.mateVis * 100)} %, ${f1(N.mateSpeed)} m/s)` : N.whom === 'sam' ? `SAM (at ${at(N.samAt)}, lit ${Math.round(N.samVis * 100)} %)` : 'a noise'} · eyes: partner ${N.mate.toFixed(2)} sam ${N.sam.toFixed(2)}`;
      if (!this.huh && was === 'patrol' && h.state !== 'patrol') { this.huh = note(`${was} → ${h.state} (awareness ${h.awareness.toFixed(2)})`); this.say(`   ? ${words(this.huh)}`); }
      if (!this.noticed && (h.state === 'alert' || h.state === 'search' || h.awareness >= SILENT.noticed)) { this.noticed = note(`NOTICING: ${h.state}, awareness ${h.awareness.toFixed(2)}`); this.say(`   ! ${words(this.noticed)}`); }
    }
  }
  wait(secs: number) { this.step(Math.round(secs * 60)); }
  until(pred: () => boolean, secs: number): boolean { for (let i = 0; i < secs * 60 && !pred(); i++) this.step(); return pred(); }
  press(code: string) { this.I.pressed.add(code); }
  crouch(on: boolean) { if (!!this.pl.crouch !== on) { this.press('KeyC'); this.step(2); } }
  holster(on: boolean) { if (!!this.pl.holstered !== on) { this.press('KeyE'); this.step(20); } }
  slot(d: 1 | 2) { const want = d === 1 ? 'pistol' : 'rifle'; if (this.pl.slot !== want || this.pl.holstered) { this.press(`Digit${d}`); this.step(40); } }
  cursor(p: number[]) { return this.W.cursorAt([p[0], p[1], p[2]]); }
  free(p: number[]): Vec3 { const nav = this.g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; }
  /** walk to `p` along the nav path (a fresh path when shoved off the line, a side-step when wedged) */
  go(p: number[], max = 45, again = 0): boolean {
    const nav = this.g.col.nav; const path: number[][] = nav.findPath(this.pos, p) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    const t0 = this.t; let mark = [...this.pos], markT = this.t, k = 0;
    for (const wp of path) {
      this.goal = [wp[0], 0, wp[2]];
      while (flat(this.pos, wp) > (wp === path[path.length - 1] ? 0.3 : 0.55)) {
        this.cursor([wp[0], 1.1, wp[2]]); this.step(); if (this.t - t0 > max) { this.goal = null; return false; }
        if (++k % 20 === 0 && again < 6 && this.g.col.solidBlocked([this.pos[0], 0.5, this.pos[2]], [wp[0], 0.5, wp[2]])) return this.go(p, max - (this.t - t0), again + 1);
        if (flat(this.pos, mark) > 0.2) { mark = [...this.pos]; markT = this.t; } else if (this.t - markT > 1.5) {
          if (again >= 6) { this.say(`(Sam is stuck at ${at(this.pos)} short of ${at(wp)})`); this.goal = null; return false; }
          const dx = wp[0] - this.pos[0], dz = wp[2] - this.pos[2], L = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1;
          this.goal = [this.pos[0] + dz / L * sd * 0.8, 0, this.pos[2] - dx / L * sd * 0.8]; this.step(25);
          return this.go(p, max - (this.t - t0), again + 1);
        }
      }
    }
    this.goal = null; return true;
  }
  /** a door's row by its verb, tapped: the cursor on the door, the highlight on the row, one press of Space. False: no such row on offer. */
  doorVerb(name: string, verb: string): boolean {
    const d = this.door(name);
    for (let i = 0; i < 30; i++) { this.cursor([d.frameCentre[0], 1.0, d.frameCentre[2]]); this.step();
      if (this.g.nearby.some((r: any) => r.kind === 'door' && r.door === d && r.verb === verb) && this.g.selectVerb('door', verb)) { this.press('Space'); this.step(2); this.say(`door ${name}: ${verb}`); return true; } }
    this.say(`door ${name}: no '${verb}' row (rows: ${this.g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`); return false;
  }
  /** a shut door eased open (the silent row), and the wait for the leaf */
  ease(name: string): boolean { const d = this.door(name); if (!d.isClosed()) return true; const ok = this.doorVerb(name, 'ease'); this.until(() => !this.pl.easing, 5); this.wait(0.2); return ok && !d.isClosed(); }
  /** stand a stride outside a door on Sam's side of it */
  toDoor(name: string, back = 0.95): boolean { const d = this.door(name), c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (this.pos[0] - c[0]) * nx + (this.pos[2] - c[2]) * nz >= 0 ? 1 : -1;
    return this.go(this.free([c[0] + nx * s * back, 0, c[2] + nz * s * back]), 40); }
  /** through a doorway to a point a stride past it */
  through(name: string, past = 1.2): boolean { const d = this.door(name), c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (this.pos[0] - c[0]) * nx + (this.pos[2] - c[2]) * nz >= 0 ? 1 : -1;
    const p: number[] = [c[0] - nx * s * past, 0, c[2] - nz * s * past]; this.goal = p; const ok = this.until(() => flat(this.pos, p) < 0.35, 8); this.goal = null; return ok; }
  /** the order menu by presses: the cursor on the target, X, the row's digit(s). The row is checked by id: a menu whose digit means something else is a failed order. */
  order(target: () => void, digits: string[], id: string): boolean {
    const O = this.g.orders, n0 = O.log.length;
    target(); this.step(); this.press(ORDERS.key); this.step();
    if (!O.menu) { this.say(`order ${id}: the menu did not open`); return false; }
    const M0 = O.menu, seen = `rows ${M0.rows.map((d: any) => `${d.key ?? '·'} ${d.id}`).join(', ')}`;
    for (const d of digits) { target(); this.press(d); this.step(); }
    const L = O.log[O.log.length - 1], ok = O.log.length > n0 && (!id || L.order === id); this.say(`order: X ${digits.map(d => d.replace('Digit', '')).join(' ')} → ${ok ? `${L.order} · ${L.who.join(', ')}` : `NOT GIVEN (${O.log.length > n0 ? `got ${L.order}` : 'nothing'}) — ${seen}`}`);
    if (O.menu) { this.press('Escape'); this.step(); }
    return ok;
  }
  onSelf() { return () => { this.cursor([this.pos[0], 0.9, this.pos[2]]); }; }
  /** the pistol's OCP on a light by name: the cursor on the fixture, the right button once the reticle has snapped to it */
  ocp(name: string): boolean { const g = this.g, t = g.targets.find((x: any) => x.name === name); if (!t) { this.say(`OCP: no fixture '${name}'`); return false; }
    this.slot(1);
    for (let i = 0; i < 90; i++) { this.cursor(t.pos); this.step(); if (g.aimTarget === t && g.player.ocp.ready()) { this.cursor(t.pos); this.I.clicked |= 4; this.step(2); break; } }
    const out = t.disabledUntil > g.time; this.say(`OCP on ${name}: ${out ? `out for ${f1(t.disabledUntil - g.time)} s` : `NOT out (reticle on ${g.aimTarget?.name ?? 'nothing'})`}`); return out; }
  /** the partner at his shoulder: inside `m` of him (or down), within `secs` */
  gather(m = 3.5, secs = 25): boolean { const mate = this.ops[0]; if (!mate) return true; return this.until(() => mate.state === 'dead' || flat(mate.char.pos, this.pos) < m, secs); }
  /** stand still until every defender within `m` is back to nothing */
  calm(m: number, secs: number): boolean { const near = () => this.hostiles.filter((h: any) => h.state !== 'dead' && flat(h.char.pos, this.pos) < m);
    return this.until(() => near().every((h: any) => h.state === 'patrol' && h.awareness < 0.03), secs); }
}

// ───────────────────────────────────────────────────────────── the routes ─────────────────────────────────────────
/** A route: the scenario it is walked on (its query, with `squad=` added per arm), and Sam's plan. `joinAt`: nothing — the run's end is where the plan leaves him. */
export interface Route { id: string; title: string; query: string; level?: string; play: (R: Run) => void }
/** squad up as a player would: fall in (X 3 on himself), then silent (X 5) — and a pair that is not silent is no measurement */
export function squadUp(R: Run) {
  if (!R.ops.length) return;
  if (!R.order(R.onSelf(), ['Digit3'], 'fallIn')) { const why = R.g.orders.give('fallIn', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); if (why) throw new Stop(`fall in refused — ${why}`); }
  R.wait(0.3);
  if (!R.order(R.onSelf(), ['Digit5'], 'silent')) { const why = R.g.orders.give('silent', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); if (why) throw new Stop(`go silent refused — ${why}`); }
  R.wait(0.5);
  if (!squadSilent(R.g)) throw new Stop('the squad is not silent');
}
export const ROUTES: Route[] = [
  // THE OFFICE — the four ways slice's own floor and placement (rebuild/four-ways/slice-build-notes.md: the room clear's five defenders, placement seed 10), and
  // its quiet way out: the corridor, the panel over the break room's north door put out with the pistol's OCP, the leaf eased, in behind the two men's backs
  // along the room's dark east side, out through the fire exit. Nobody is touched.
  ...(['slip', 'lit', 'pause', 'lapse'] as const).map((v): Route => ({ id: `office-${v}`, query: 'roomclear=10',
    title: { slip: 'The office, the ideal line: the corridor panel put out, through the break room behind its two men, out by the dark south door',
      lit: 'The office, no OCP: the same line with the corridor panel left ON — the north doorway is lit and the near man watches it',
      pause: 'The office, no OCP, a stop: the lit doorway crossed, then eight seconds still in the dark a stride inside before going on',
      lapse: 'The office, the OCP lapses: the panel put out, in, then twelve seconds still inside while it comes back on behind him' }[v],
    play: R => {
      squadUp(R); R.slot(1); R.crouch(true);
      R.go(R.free([24.6, 0, 11.2]), 60); R.gather();
      R.toDoor('breakroom_n'); if (v === 'slip' || v === 'lapse') R.ocp('panel_corridor_20'); R.gather();
      R.ease('breakroom_n');
      R.holster(true);
      R.through('breakroom_n', 1.0);
      if (v === 'pause' || v === 'lapse') { R.go(R.free([32.8, 0, 13.5]), 10); R.wait(v === 'pause' ? 8 : 12); }
      for (const p of [[34.3, 0, 13.6], [34.3, 0, 17.0], [34.3, 0, 21.6]]) R.go(R.free(p), 30);
      R.toDoor('breakroom_ext', 0.9); R.ease('breakroom_ext');
      R.through('breakroom_ext', 1.6);
    } })),
];

/** one whole run */
export async function play(route: string, dice: number, arm: Arm, opts: { verbose?: boolean; hard?: boolean; set?: Record<string, Record<string, unknown>>; joinM?: number; joinSecs?: number; cap?: number } = {}): Promise<Out> {
  const Rt = ROUTES.find(r => r.id === route); if (!Rt) throw new Error(`no route '${route}' — ${ROUTES.map(r => r.id).join(', ')}`);
  const out: Out = { route, dice, arm, hard: !!opts.hard, end: 'error', t: 0, why: '', huh: null, noticed: null, mateSeenS: 0, samSeenS: 0, peak: 0, mate: null };
  if (arm === 'on' && !SNEAKM) { out.why = 'this build has no src/game/sneak.ts'; return out; }
  let R: Run | null = null;
  const stats0 = SNEAKM ? { ...SNEAKM.SNEAK_STATS } : null, knobs0 = SNEAKM ? JSON.stringify(SNEAKM.SNEAK) : '', silent0 = JSON.stringify(SILENT);
  try {
    let through = false, joinS = NaN;
    try {
      R = await Run.start(`${Rt.query}&squad=${arm === 'solo' ? 0 : 1}`, dice, { verbose: opts.verbose, hard: opts.hard, sneak: arm === 'on', set: opts.set, level: Rt.level });
      if (opts.cap) R.cap = opts.cap;
      Rt.play(R); through = true;
      // through: the partner back at his shoulder (he is where the plan left him, low and still)
      const t0 = R.t; R.cap = Math.max(R.cap, R.t + (opts.joinSecs ?? 30) + 1);
      if (R.ops.length) { if (R.gather(opts.joinM ?? 4, opts.joinSecs ?? 30)) joinS = R.t - t0; } else joinS = 0;
    } catch (e) { if (e instanceof Stop) out.why = e.why; else { out.why = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 5).join('\n')}` : String(e); if (!R) return out; out.end = 'error'; } }
    if (!R) return out;
    out.t = R.t; out.huh = R.huh; out.noticed = R.noticed; out.mateSeenS = R.mateSeenS; out.samSeenS = R.samSeenS; out.peak = R.peak; out.trace = R.trace; out.digest = (R.digest >>> 0).toString(16);
    if (R.ops.length) { out.mate = { m: R.mateM, crouchS: R.crouchS, uprightS: R.uprightS, farM: R.farM, joinS, lit: R.movS > 0 ? R.litS / R.movS : 0 };
      if (SNEAKM && stats0) { out.mate.stats = {}; for (const k of Object.keys(stats0)) out.mate.stats[k] = SNEAKM.SNEAK_STATS[k] - (stats0 as any)[k]; } }
    if (out.end === 'error' && out.why && !(out.why === 'noticed' || out.why === 'time cap' || out.why === 'Sam is down' || !out.why.includes('\n'))) return out;
    out.end = R.noticed ? R.noticed.whom : !through ? 'stall' : R.ops.length && !Number.isFinite(joinS) ? 'left' : 'clean';
    return out;
  } finally { if (SNEAKM) Object.assign(SNEAKM.SNEAK, JSON.parse(knobs0)); Object.assign(SILENT, JSON.parse(silent0)); setDifficulty('standard', false); }
}
export const words = (o: Out) => `${o.route} · dice ${o.dice} · ${o.arm}${o.hard ? ' · hard' : ''}: ${o.end.toUpperCase()} at ${clock(o.t)}${o.why && o.end !== 'clean' ? ` (${o.why.split('\n')[0]})` : ''} · peak awareness ${o.peak.toFixed(2)} · eyes on partner ${f1(o.mateSeenS)} s, on Sam ${f1(o.samSeenS)} s${o.mate ? ` · partner walked ${f1(o.mate.m)} m (${f1(o.mate.crouchS)} s low, ${f1(o.mate.uprightS)} s upright), furthest ${f1(o.mate.farM)} m, rejoined in ${f1(o.mate.joinS)} s${o.mate.stats ? ` · ${Object.entries(o.mate.stats).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' ')}` : ''}` : ''}`;

// ───────────────────────────────────────────────────────────── the tally ─────────────────────────────────────────
const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [Number(p)]; });
/** Wilson's 95 % interval for k of n, in percent */
export function wilson(k: number, n: number): [number, number] { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [100 * Math.max(0, c - h), 100 * Math.min(1, c + h)]; }
export function table(outs: Out[]): string {
  const L: string[] = [], pct = (k: number, n: number) => { const [a, b] = wilson(k, n); return `${k}/${n} (${n ? Math.round(100 * k / n) : 0} %, ${Math.round(a)}–${Math.round(b)})`; };
  const groups = new Map<string, Out[]>(); for (const o of outs) { const k = `${o.route}${o.hard ? ' · hard' : ''}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(o); }
  for (const [k, G] of groups) {
    L.push(`\n${k}`, '| arm | runs | clean | partner noticed | Sam noticed | a noise | partner left behind | stalled | first “huh?” was the partner | eyes on partner, s (mean) | eyes on Sam, s (mean) | partner low while moving | rejoin s (median) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const arm of ['solo', 'off', 'on'] as Arm[]) { const A = G.filter(o => o.arm === arm); if (!A.length) continue; const n = A.length, c = (e: Out['end']) => A.filter(o => o.end === e).length;
      const mean = (f: (o: Out) => number) => A.reduce((s, o) => s + f(o), 0) / n, js = A.map(o => o.mate?.joinS ?? NaN).filter(Number.isFinite).sort((a, b) => a - b);
      const low = A.reduce((s, o) => s + (o.mate?.crouchS ?? 0), 0), mov = A.reduce((s, o) => s + (o.mate ? o.mate.crouchS + o.mate.uprightS : 0), 0);
      L.push(`| ${arm} | ${n} | ${pct(c('clean'), n)} | ${pct(c('mate'), n)} | ${pct(c('sam'), n)} | ${c('noise')} | ${c('left')} | ${c('stall') + c('error')} | ${pct(A.filter(o => o.huh?.whom === 'mate').length, n)} | ${mean(o => o.mateSeenS).toFixed(2)} | ${mean(o => o.samSeenS).toFixed(2)} | ${mov ? Math.round(100 * low / mov) + ' %' : '—'} | ${js.length ? f1(js[js.length >> 1]) : '—'} |`); }
    // paired: the same dice, off against on — who noticed the partner in one and not the other
    const off = new Map(G.filter(o => o.arm === 'off').map(o => [o.dice, o])), on = new Map(G.filter(o => o.arm === 'on').map(o => [o.dice, o]));
    let both = 0, onlyOff = 0, onlyOn = 0, n = 0; for (const [d, a] of off) { const b = on.get(d); if (!b) continue; n++; const x = a.end === 'mate', y = b.end === 'mate'; if (x && y) both++; else if (x) onlyOff++; else if (y) onlyOn++; }
    if (n) { const dif = (onlyOn - onlyOff) / n, se = Math.sqrt((onlyOff + onlyOn - (onlyOn - onlyOff) ** 2 / n)) / n;
      L.push(`paired on the same dice (${n}): partner noticed in both ${both} · only with the switch off ${onlyOff} · only with it on ${onlyOn} · on − off = ${(100 * dif).toFixed(1)} points (95 %: ${(100 * (dif - 1.96 * se)).toFixed(1)} to ${(100 * (dif + 1.96 * se)).toFixed(1)})`); }
  }
  return L.join('\n');
}

if (import.meta.main) {
  const argv = process.argv.slice(2), cmd = argv[0];
  const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }, has = (n: string) => argv.includes(n);
  const set = flag('--set') ? JSON.parse(flag('--set')!) : undefined, hard = has('--hard');
  if (cmd === 'routes') { for (const r of ROUTES) console.log(`${r.id}: ${r.title} (${r.level ?? 'office'} ?${r.query})`); process.exit(0); }
  if (cmd === 'trace') {
    const o = await play(argv[1], Number(argv[2] ?? 1), (argv[3] && !argv[3].startsWith('--') ? argv[3] : 'off') as Arm, { verbose: true, hard, set });
    console.log(`\n${words(o)}${o.end === 'error' ? `\n${o.why}` : ''}\ndigest ${o.digest}`); process.exit(o.end === 'error' ? 1 : 0);
  }
  if (cmd === 'one') {   // (a tally's worker: one run to a file)
    const [route, dice, arm] = argv[1].split(':'); const o = await quiet(true, () => play(route, Number(dice), arm as Arm, { hard, set })); delete o.trace; writeFileSync(flag('--out')!, JSON.stringify(o)); process.exit(0);
  }
  if (cmd === 'tally') {
    const routes = (flag('--routes') ?? ROUTES.map(r => r.id).join(',')).split(','), seeds = seedsOf(flag('--seeds') ?? '1-12'), arms = (flag('--arms') ?? 'solo,off,on').split(',') as Arm[], jobs = Math.max(1, Number(flag('--jobs') ?? 8));
    for (const r of routes) if (!ROUTES.some(x => x.id === r)) { console.error(`no route '${r}' — ${ROUTES.map(x => x.id).join(', ')}`); process.exit(2); }
    const Q = routes.flatMap(route => seeds.flatMap(dice => arms.map(arm => ({ route, dice, arm })))), outs: Out[] = []; let next = 0, bad = 0;
    const worker = async () => { for (;;) { const j = Q[next++]; if (!j) return; const file = `${tmpdir()}/pairsneak-${process.pid}-${j.route}-${j.dice}-${j.arm}.json`;
        const pr = Bun.spawn(['bun', 'run', import.meta.path, 'one', `${j.route}:${j.dice}:${j.arm}`, '--out', file, ...(hard ? ['--hard'] : []), ...(set ? ['--set', JSON.stringify(set)] : [])], { stdout: 'ignore', stderr: 'pipe' });
        const code = await pr.exited;
        try { outs.push(JSON.parse(readFileSync(file, 'utf8'))); rmSync(file); } catch { bad++; outs.push({ route: j.route, dice: j.dice, arm: j.arm as Arm, hard, end: 'error', t: 0, why: `worker exit ${code}: ${(await new Response(pr.stderr).text()).slice(-400)}`, huh: null, noticed: null, mateSeenS: 0, samSeenS: 0, peak: 0, mate: null }); } } };
    await Promise.all(Array.from({ length: jobs }, worker));
    outs.sort((a, b) => a.route.localeCompare(b.route) || a.dice - b.dice || a.arm.localeCompare(b.arm));
    if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ hard, set: set ?? null, seeds: flag('--seeds') ?? '1-12', outs }, null, 1));
    console.log(table(outs));
    const errs = outs.filter(o => o.end === 'error'); for (const e of errs.slice(0, 5)) console.log(`ERROR ${e.route}:${e.dice}:${e.arm} — ${e.why.split('\n')[0]}`);
    process.exit(errs.length ? 1 : 0);
  }
  console.error('usage: pairsneak.ts trace <route> <dice> [solo|off|on] | tally [--routes] [--seeds 1-144] [--arms solo,off,on] [--jobs 8] [--hard] [--set json] [--json file] | routes'); process.exit(2);
}
