// The room fight (src/game/roomfight.ts): both sides of a room clear fighting on their own read. `bun run tools/qa/probes.ts roomfight` = the family.
//
//   roomfight-entry     the same seed, the same three men in the break room, the noise at a different door: they end up watching — and with their guns on — the
//                       door it came from, not the one a plan names; a door merely TRIED by a teammate is heard and watched; a bang moves the watch; and with the
//                       room lost the survivor leaves by a door the trouble did not come from, so he ends up somewhere else
//   roomfight-flank     one defender who has had a door kicked: a teammate through THAT door meets a man with his gun on it, a teammate through the room's other
//                       door meets his shoulder — sixteen seeds each: the unwatched entry drops him without a round coming back far more often
//   roomfight-nextroom  a defender posted in the corridor outside: with a fight in the break room he can hear (real rounds) he comes; with none he stands; with
//                       gunfire where his side has nobody he stays too
//   roomfight-sight     a teammate fires at a defender he has a lit, smoke-free sight of — and not at one in the dark, nor at a lit one through smoke (the
//                       renderer's answer planted on the pair's key), nor at one behind his back
//   roomfight-eyes      ROOMFIGHT.sights: a teammate with his rifle in the shoulder sees a man along his aim that the eye between chest and head leaves out;
//                       nothing he saw before is lost; the other side's eye and anybody's reading of Sam are as they were (ROOMFIGHT_EYES_BREAK=1 = the red path)
//   roomfight-friends   the night breach at its default over fifteen seeds with Sam idle, and eight with Sam (god mode) walked into the room behind the charge:
//                       no teammate's round passes within a body's breadth of Sam or of the other teammate; and nothing in those runs was staged — the drill
//                       fired no round of its own (BreachDrill.rounds 0, no eyes / shot / guaranteed beat), every defender down was dropped by a round
//   roomfight-duel      the even meeting: one teammate, one defender, both roused, face to face in the same light, twenty-four seeds — the teammate wins
//                       clearly more often than not, and the defender still wins some (lethality is the same both ways)
//   roomfight-off       ROOMFIGHT.on false = the night breach as its branch had it (the staged exchange fires again); with no unit on the floor the module
//                       is not live and ten seeded seconds of the night game digest the same with the switch either way
// Headless there is no renderer: the light on a man is the CPU estimate of the direct light (guards.ts lightEstimateAt), the smoke between two men is clear unless
// a probe plants the segment's answer, and nothing here says anything about what the picture shows.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { ROOMFIGHT, FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { NVG } = await import(`${ROOT}/src/game/nvg.ts`);
const { spawnUnit, engage, canSeeChar } = await import(`${ROOT}/src/game/guards.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
const { fireWeapon, detonateStun, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { HOLDFIRE } = await import(`${ROOT}/src/game/holdfire.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const KNOBS0 = { ...ROOMFIGHT }, SKILL0 = JSON.parse(JSON.stringify(FIGHT_SKILL, (_k, v) => v === Infinity ? '∞' : v), (_k, v) => v === '∞' ? Infinity : v), NB0 = { ...NIGHTBREACH };
const restore = () => { Object.assign(ROOMFIGHT, KNOBS0); for (const k of ['operative', 'hostile'] as const) Object.assign(FIGHT_SKILL[k], JSON.parse(JSON.stringify(SKILL0[k], (_k, v) => v === Infinity ? '∞' : v), (_k, v) => v === '∞' ? Infinity : v)); Object.assign(NIGHTBREACH, NB0); };
/** a probe whose staging has teammates open fire by themselves: floor() puts the unfound squad's hold off AFTER each stand-up (the stand-up writes the switch:
 *  on under shipped, and on the frozen stand with TPS_HOLDFIRE=1 — a pin written before it is written over) */
let noHold = false;
const guarded = (fn: () => Promise<boolean>) => async () => { const hold = HOLDFIRE.on; try { return await fn(); } finally { restore(); HOLDFIRE.on = hold; noHold = false; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
const up = (l: any[]) => l.filter(x => x.state !== 'dead').length;

interface Shot { who: number; team: string; from: number[]; to: number[]; t: number; blind: boolean }
/** what every rig's step keeps: rounds by side (off the 'guardShot' events), each one's flight, and the nearest any OPERATIVE round's flight came to a friend's body */
function tracker(W: any) {
  const g = W.game; const seen = new Set<any>();
  const T = { shots: [] as Shot[], by: {} as Record<string, number>, friendMin: Infinity, friendWho: '', samHit: false, bad: '',
    scan() {
      for (const e of g.events) {
        if (seen.has(e)) continue; seen.add(e);
        if (e.kind !== 'guardShot' || !e.from || !e.to) continue;
        const w = g.guards.find((x: any) => x.char.id === e.who); const team = w ? w.team : '?';
        T.shots.push({ who: e.who, team, from: [...e.from], to: [...e.to], t: e.time, blind: !!e.blind }); T.by[team] = (T.by[team] ?? 0) + 1;
        if (team !== 'operative') continue;
        // a friend's body against the flight, in plan, where the round is between his soles and his crown
        const friends: [string, any][] = [['Sam', g.player.char], ...g.guards.filter((x: any) => x.team === 'operative' && x !== w && x.state !== 'dead').map((x: any) => [x.callsign, x.char] as [string, any])];
        for (const [name, ch] of friends) {
          if (name === 'Sam' && g.player.down) continue;
          const h = ch.bones.hips ?? ch.pos; const dx = e.to[0] - e.from[0], dz = e.to[2] - e.from[2]; const L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
          const t = Math.max(0, Math.min(1, ((h[0] - e.from[0]) * dx + (h[2] - e.from[2]) * dz) / L2));
          const y = e.from[1] + (e.to[1] - e.from[1]) * t; if (y < ch.pos[1] - 0.05 || y > ch.pos[1] + 1.9) continue;
          const d = Math.hypot(e.from[0] + dx * t - h[0], e.from[2] + dz * t - h[2]);
          if (d < T.friendMin) { T.friendMin = d; T.friendWho = `${w?.callsign} past ${name} at ${f2(e.time)} s`; }
        }
      }
      if (g.player.down || g.player.hitFlash > 0) T.samHit = true;
      for (const x of g.guards) if (!T.bad && !x.char.pos.every(Number.isFinite)) T.bad = `${x.callsign} at ${x.char.pos}`;
    } };
  return T;
}

/** A floor of our own: the night game stood up under a seed, the shift benched as the night breach benches it (off the list, torches out of the light set), no
 *  civilians / response team / devices, a fresh encounter — then whoever the probe spawns. Sam is parked dark at his spawn in the cubicles. */
async function floor(seed: number, o: { lit?: boolean; chaos?: number } = {}) {
  Math.random = seeded(seed);
  const W: any = await standUp(); const g = W.game; if (noHold) HOLDFIRE.on = false;
  for (const gd of g.guards) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
  g.guards = []; g.tune.civilians = false; g.tune.qrf = false; g.tune.devices = false; g.tune.chaos = o.chaos ?? 0;
  g.restartEncounter();
  for (const n of ['breakroom_w', 'breakroom_n', 'breakroom_ext', 'fire_exit']) { const d = g.doors.byName(n); if (d) { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; } }   // the room's doors shut (the night floor authors the west one ajar; the night breach shuts it the same way)
  if (o.lit) g.setGroup('breakroom', true);
  const T = tracker(W);
  const R = { W, g, T, vis: 0.05, plant: null as null | (() => void),
    spawn(team: 'operative' | 'hostile', pos: number[], facing: number[], opts: { light?: boolean; name?: string } = {}) { return spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: opts.light ?? false, name: opts.name }); },
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = R.vis; R.plant?.(); W.step(DT); T.scan(); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string) { const d = g.doors.byName(name); if (!d) throw new Error(`no door ${name}`); return d; },
    kick(name: string, who: any) { const d = R.door(name); g.events.push({ kind: 'kick', pos: [d.frameCentre[0], 0, d.frameCentre[2]], time: g.time, loud: true, level: 1.0, who: who.char.id }); },
  };
  return R;
}
/** the night breach's own staging under a seed (its rig, cut down): the tracker on it, F presses, Sam kept dark unless the probe says otherwise */
async function breach(seed: number, knobs: Record<string, unknown> = {}, chaos = 0.5) {
  Object.assign(NIGHTBREACH, NB0, knobs); Math.random = seeded(seed);
  const W: any = await standUp(); const g = W.game; const NB = g.nightBreach; g.tune.chaos = chaos;
  const why = NB.start(); if (why) throw new Error(`night breach refused: ${why}`);
  const T = tracker(W);
  const R = { W, g, NB, T, vis: 0.05, each: null as null | (() => void),
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = R.vis; R.each?.(); W.step(DT); T.scan(); } },
    press(code = 'KeyF') { W.input.pressed.add(code); R.step(); },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    beat(what: string): number { const b = NB.drill?.beats.find((x: any) => x.what === what); return b ? b.t : NaN; } };
  return R;
}
const MARKS = (g: any) => g.level.breach.hostiles as { pos: number[]; aimAt: number[] }[];
const aimOff = (gd: any, at: number[]) => Math.abs(wrap(v3.yawTo(gd.char.pos, [at[0], 0, at[2]]) - gd.char.aimYaw)) * 57.3;
const inBreakRoom = (g: any, p: number[]) => { const B = g.level.breach.bounds; return p[0] > B.x0 && p[0] < B.x1 && p[2] > B.z0 && p[2] < B.z1; };

// ================================================================ entry: the noise decides what they watch
export const roomfightEntry = guarded(async () => {
  const { verdict, done } = family('roomfight-entry: the same men, the same seed, a different door — a different room to walk into');
  const OUT: Record<string, number[]> = { breakroom_w: [26.4, 0, 15.4], breakroom_n: [28.4, 0, 11.1] };   // outside each door and well to one side of it: behind the wall, out of the leaf's reach (a man stood AT a door has it open)
  const run = async (doorName: string, how: 'kick' | 'try' | 'bang', thenLose = false) => {
    const R = await floor(31); const { g } = R; const F = g.fight;
    const defs = MARKS(g).map((m, i) => R.spawn('hostile', m.pos, m.aimAt, { name: `Tango ${i + 1}` }));
    const op = R.spawn('operative', OUT[doorName], R.door(doorName).frameCentre, { name: 'Blue One' }); order(op, { goal: null, upper: 'none', stance: 'lowReady' });
    R.step(90);   // calm: they stand as they were put
    const calm = defs.map((d: any) => F.watchOf(d)?.door ?? 'front');
    if (how === 'kick') R.kick(doorName, op);
    else if (how === 'try') { const d = R.door(doorName); g.events.push({ kind: 'door', pos: [d.frameCentre[0], 0, d.frameCentre[2]], time: g.time, loud: false, level: 0.3, who: op.char.id }); }   // the handle tried from outside: doors.ts's own 'rattle' event, blamed on him
    else { const d = R.door(doorName); const it = g.items.spawn('flash', [d.frameCentre[0], 0.25, d.frameCentre[2] + (doorName === 'breakroom_n' ? 0.9 : 0)], [0, 0, 0], { fuse: 9, heading: 0 }); it.fired = true; F.blindFire = false; FIGHT_SKILL.hostile.bangBreak = 0; detonateStun(g, it); }
    if (how === 'bang') { R.step(60); for (let i = 0; i < 60 * 14 && defs.some((d: any) => g.time < d.dazzledUntil + 2); i++) R.step(); }   // (until every man has had his sight back two seconds: the canister's blindness is combat.ts FLASH's now — up to seven seconds — where a fixed seven-second wait caught the nearest man still blind)
    else R.step(60 * 3);
    const out = { R, g, defs, op, calm, watch: defs.map((d: any) => F.watchOf(d)?.settled ?? 'front'), glancing: defs.filter((d: any) => F.watchOf(d)?.glancing).length, yaw: defs.map((d: any) => d.char.aimYaw as number), off: defs.map((d: any) => aimOff(d, R.door(doorName).frameCentre)), state: defs.map((d: any) => d.state as string), shut: Math.abs(R.door(doorName).angle) < 0.05, lost: null as any };
    if (thenLose) out.lost = lose(out, doorName);
    return out;
  };
  // ---- the room lost: two of the three down in the third's sight, rounds coming at the kicked door — he leaves by another, so where he ends up depends on the entry
  const lose = (r: any, doorName: string) => {
    const { R, g, defs, op } = r; const d = R.door(doorName);
    killGuard(g, defs[1], [1, 0, 0], false, 'shot', 'guard', 'hostile down'); killGuard(g, defs[2], [1, 0, 0], false, 'shot', 'guard', 'hostile down');
    for (let i = 0; i < 60 * 9; i++) { if (i < 90 && i % 9 === 0 && op.weapon.fire()) fireWeapon(g, op.char, [d.frameCentre[0], 1.0, d.frameCentre[2]], false, { steady: true, spread: 0.02 }); R.step(); }
    const s = defs[0]; const log = g.fight.log.filter((n: any) => n.who === s.callsign).map((n: any) => n.what);
    return { pos: [...s.char.pos] as number[], state: s.state as string, out: !inBreakRoom(g, s.char.pos), by: log.find((x: string) => x.startsWith('falls back'))?.replace('falls back through ', '').replace(/ to -?[\d.]+,-?[\d.]+$/, '') ?? (log.some((x: string) => x === 'takes cover') ? 'cover' : '-'), watch: g.fight.watchOf(s)?.door ?? 'front', hold: s.hold && s.pinned };
  };
  const W = await run('breakroom_w', 'kick', true), N = await run('breakroom_n', 'kick', true);
  const turned = W.yaw.map((y: number, i: number) => Math.abs(wrap(y - N.yaw[i])) * 57.3);
  verdict(W.calm.every((c: string) => c === 'front') && N.calm.every((c: string) => c === 'front'), 'calm, nobody watches a door: each stands the way he was put', `west run ${W.calm.join(' ')} · north run ${N.calm.join(' ')}`);
  verdict(W.watch.every((w: string) => w === 'breakroom_w') && N.watch.every((w: string) => w === 'breakroom_n'), 'a boot on a door: every man watches THAT door (his own ears put it there)', `kick west → ${W.watch.join(' ')} · kick north → ${N.watch.join(' ')} · states ${W.state.join('/')} · ${N.state.join('/')}`);
  verdict(W.off.every((o: number) => o < 25) && N.off.every((o: number) => o < 25) && turned.filter((t: number) => t > 40).length >= 2, 'and their guns are on it: the same seed, the two doors — at least two men end up facing more than 40° apart',
    `aim off the kicked door: west ${W.off.map((o: number) => o.toFixed(0) + '°').join(' ')} · north ${N.off.map((o: number) => o.toFixed(0) + '°').join(' ')} · between the runs ${turned.map((t: number) => t.toFixed(0) + '°').join(' ')}`);
  const T = await run('breakroom_n', 'try');
  verdict(T.watch.filter((w: string) => w === 'breakroom_n').length >= 2 && T.state.every((s: string) => s !== 'dead'), 'a door only TRIED by a teammate (the handle, no boot) is heard: they come round to it', `watch ${T.watch.join(' ')} · states ${T.state.join('/')} · aim off it ${T.off.map((o: number) => o.toFixed(0) + '°').join(' ')}`);
  const B = await run('breakroom_n', 'bang');
  // (it was all three: the canister's blindness is combat.ts FLASH's now, up to seven seconds, and the man blind longest comes back to a noise that old with two
  //  mates already on that door — ROOMFIGHT.crowd leaves him free for another. With crowd 0 all three settle on it. Nobody settles on a DIFFERENT door)
  verdict(B.watch.filter((w: string) => w === 'breakroom_n').length >= 2 && B.watch.every((w: string) => w === 'breakroom_n' || w === 'front'), 'a bang at the north door (no blind fire, nobody through it): once they can see again they are watching it — at least two of the three, the third on it or left free by the two (never settled on another door)', `the entry each fears ${B.watch.join(' ')} · eyes wandering off it at this moment: ${B.glancing} of 3 (FIGHT_SKILL.hostile.hold / glance) · aim off it ${B.off.map((o: number) => o.toFixed(0) + '°').join(' ')}`);
  const LW = W.lost, LN = N.lost;
  verdict(LW.state !== 'dead' && LN.state !== 'dead' && LW.out && LN.out && LW.by !== 'breakroom_w' && LN.by !== 'breakroom_n' && LW.by !== '-' && LN.by !== '-' && flat(LW.pos, LN.pos) > 3 && LW.hold && LN.hold,
    'the room lost (two down in his sight, rounds through the door): the last man gets out by a door the trouble did NOT come from and holds beyond it — a different place for a different entry',
    `kick west: out ${LW.out} by ${LW.by} → ${LW.pos.map(f2)} watching ${LW.watch} · kick north: out ${LN.out} by ${LN.by} → ${LN.pos.map(f2)} watching ${LN.watch} · ${f2(flat(LW.pos, LN.pos))} m apart`);
  return done();
});

// ================================================================ flank: the door he is not watching
export const roomfightFlank = guarded(async () => {
  const { verdict, done } = family('roomfight-flank: a defender watching one door is caught out through the other');
  const SEEDS = Array.from({ length: 16 }, (_, i) => 41 + i);
  const one = async (seed: number, via: 'breakroom_w' | 'breakroom_n') => {
    const R = await floor(seed); const { g } = R; const m = MARKS(g)[0];
    const def = R.spawn('hostile', m.pos, m.aimAt, { name: 'Tango 1' });
    const from = via === 'breakroom_w' ? [24.4, 0, 17.6] : [26.6, 0, 11.1], goal = via === 'breakroom_w' ? [29.6, 0, 17.6] : [30.6, 0, 14.2];   // each starts some five metres of walking from his door, out of sight of the room
    const op = R.spawn('operative', from, R.door(via).frameCentre, { name: 'Blue One', light: true });
    order(op, { goal: null, upper: 'none', stance: 'lowReady' }); R.step(60);
    R.kick('breakroom_w', op); R.step(30); R.kick('breakroom_w', op); R.step(120);   // the west door booted twice and holding: that is the door he fears
    const watch = g.fight.watchOf(def)?.door;
    order(op, { goal: [goal[0], 0, goal[2]], speed: 2.6, upper: 'aim', stance: 'none', aimAt: [32.0, 1.2, 18.0], light: true, hot: true });   // through his door at a walk, his muzzle (and his light) on the middle of the room as the drill's centre check has it — the same order either way
    const t0 = g.time; R.until(() => def.state === 'dead' || op.state === 'dead', 14); R.step(30);
    const back = R.T.shots.filter(s => s.team === 'hostile' && s.t >= t0).length;
    return { watch, defDown: def.state === 'dead', opDown: op.state === 'dead', back, surprised: g.fight.stats.surprised, bad: R.T.bad };
  };
  const tally = async (via: 'breakroom_w' | 'breakroom_n') => {
    let defDown = 0, opDown = 0, clean = 0, back = 0, surprised = 0, watched = 0, bad = ''; const rows: string[] = [];
    for (const seed of SEEDS) { const o = await one(seed, via); if (o.defDown) defDown++; if (o.opDown) opDown++; if (o.defDown && !o.opDown && o.back === 0) clean++; back += o.back; surprised += o.surprised; if (o.watch === 'breakroom_w') watched++; if (o.bad) bad = o.bad;
      rows.push(`${seed}:${o.defDown ? 'D' : '-'}${o.opDown ? 'O' : '-'}${o.back}`); }
    return { defDown, opDown, clean, back, surprised, watched, bad, rows };
  };
  const Wt = await tally('breakroom_w'), Nt = await tally('breakroom_n'); const n = SEEDS.length;
  verdict(Wt.watched === n && Nt.watched === n && !Wt.bad && !Nt.bad, 'in every run he is watching the west door when the teammate comes (two boots on it)', `watching west: ${Wt.watched} + ${Nt.watched} of ${2 * n}`);
  verdict(Nt.clean > Wt.clean && Nt.clean >= n * 0.75 && Nt.opDown < Wt.opDown + 1 && Nt.back < Wt.back, 'through the door he is NOT watching he is dropped without a round coming back far more often than through the one he is',
    `north (unwatched): defender down ${Nt.defDown}/${n}, clean (no round back) ${Nt.clean}, teammate lost ${Nt.opDown}, his rounds ${Nt.back}, caught looking away ${Nt.surprised}\n    west (watched):    defender down ${Wt.defDown}/${n}, clean ${Wt.clean}, teammate lost ${Wt.opDown}, his rounds ${Wt.back}, caught looking away ${Wt.surprised}\n    per seed (D defender down · O teammate down · rounds back) north ${Nt.rows.join(' ')}\n    west  ${Wt.rows.join(' ')}`);
  verdict(Wt.back > 0, 'and the watched door is no walkover: the man with his gun on it gets rounds off at the teammate in it', `rounds back through the watched door over ${n} runs: ${Wt.back} · teammates lost ${Wt.opDown}`);
  return done();
});

// ================================================================ next room: the men next door hear it
export const roomfightNextRoom = guarded(async () => {
  const { verdict, done } = family('roomfight-nextroom: a defender next door comes to a fight he can hear, and only to one');
  const SEEDS = [51, 52, 53, 54, 55, 56, 57, 58];
  const post = [33.6, 0, 11.1];
  const run = async (seed: number, mode: 'fight' | 'quiet' | 'elsewhere') => {
    const R = await floor(seed); const { g } = R; const M = MARKS(g);
    const a1 = R.spawn('hostile', M[0].pos, M[0].aimAt, { name: 'Tango 1' }), a2 = R.spawn('hostile', M[1].pos, M[1].aimAt, { name: 'Tango 2' });
    const b = R.spawn('hostile', post, [26, 0, 11.1], { name: 'Tango 3' });
    const op = R.spawn('operative', mode === 'elsewhere' ? [12, 0, 20.5] : [25.2, 0, 17.6], mode === 'elsewhere' ? [12, 0, 17] : R.door('breakroom_w').frameCentre, { name: 'Blue One' });
    order(op, { goal: null, upper: 'none', stance: 'lowReady' }); R.step(90);
    const room = g.fight.defs.find((d: any) => d.gd === b)?.room, roomA = g.fight.defs.find((d: any) => d.gd === a1)?.room;
    let moved = 0, heard = 0;
    for (let i = 0; i < 60 * 14; i++) {
      // real rounds: the teammate outside the west door putting a few through it (heard by everybody in earshot through the propagation); 'elsewhere' = the same rounds at a wall in the cubicles
      if (mode !== 'quiet' && i < 150 && i % 10 === 0 && op.weapon.fire()) fireWeapon(g, op.char, mode === 'elsewhere' ? [12, 1.0, 16] : [28.1, 1.0, 17.6], false, { steady: true, spread: 0.02 });
      R.step(); moved = Math.max(moved, flat(b.char.pos, post)); heard = b.witness.heard.shots;
    }
    return { moved, heard, rallied: g.fight.stats.rallied, sameRoom: room === roomA, toward: flat(b.char.pos, op.char.pos) < flat(post, op.char.pos) - 3, state: b.state as string, a: [a1.state, a2.state].join('/') };
  };
  let went = 0, stayedQuiet = 0, stayedElse = 0, heardElse = 0; const rows: string[] = []; let sameRoom = false;
  for (const seed of SEEDS) {
    const F = await run(seed, 'fight'), Q = await run(seed, 'quiet'), E = await run(seed, 'elsewhere');
    if (F.rallied > 0 && F.moved > 3 && F.toward) went++; if (Q.moved < 0.5 && Q.rallied === 0) stayedQuiet++; if (E.moved < 0.5 && E.rallied === 0) stayedElse++; if (E.heard > 0) heardElse++; sameRoom ||= F.sameRoom;
    rows.push(`seed ${seed}: fight → heard ${F.heard} shots, rallied ${F.rallied}, moved ${f2(F.moved)} m (${F.state}) · quiet → moved ${f2(Q.moved)} m · rounds in the cubicles → heard ${E.heard}, moved ${f2(E.moved)} m`);
  }
  verdict(!sameRoom, 'the corridor post is another room than the break room (the nav flood stops at the doorways)', `same room: ${sameRoom}`);
  verdict(went >= 5, `gunfire he can hear at his side's post next door: he leaves his own and goes toward it in most runs (≥ 5 of ${SEEDS.length}; rallyChance ${FIGHT_SKILL.hostile.rallyChance})`, `went ${went} of ${SEEDS.length}\n    ${rows.join('\n    ')}`);
  verdict(stayedQuiet === SEEDS.length, 'no fight: he stands his post in every run', `stayed ${stayedQuiet} of ${SEEDS.length}`);
  verdict(stayedElse === SEEDS.length && heardElse >= 6, 'the same rounds where his side has nobody (the cubicles): he hears them and stays', `stayed ${stayedElse} of ${SEEDS.length} · heard them in ${heardElse}`);
  return done();
});

// ================================================================ sight: light and smoke gate a teammate's trigger
export const roomfightSight = guarded(async () => {
  const { verdict, done } = family('roomfight-sight: a teammate shoots at what he can see — lit, in his view, no smoke between');
  noHold = true;   // (every run stages a lone teammate who opens fire by himself on a man who has not noticed him, no shot or order of Sam's: the unfound squad's hold, holdfire.ts, which the shipped stand raises, would hold every round — this probe asks what light and smoke do to his trigger; who fires first is holdfire-check's question)
  const A = [29.6, 0, 20.6], B = [34.4, 0, 20.6];
  const run = async (o: { lit: boolean; smoke?: number; back?: boolean; secs?: number }) => {
    const R = await floor(61, { lit: o.lit }); const { g } = R; g.fight.blindFire = false; FIGHT_SKILL.hostile.bangBreak = 0;
    const h = R.spawn('hostile', B, A, { name: 'Tango 1' }); const op = R.spawn('operative', A, o.back ? [A[0] - 4, 0, A[2]] : B, { name: 'Blue One' });
    order(op, { goal: null, upper: 'aim', stance: 'none', aimAt: o.back ? [A[0] - 4, 1.2, A[2]] : [B[0], 1.2, B[2]] });
    const key = `fightS${Math.min(op.char.id, h.char.id)}_${Math.max(op.char.id, h.char.id)}`;
    let light = 0, meter = 0;
    R.plant = () => { h.dazzledUntil = g.time + 5; if (o.smoke !== undefined) g.probe.results.set(key, [o.smoke, 0, 0]); };   // the defender harmless (eyes full of magnesium, no blind burst): this is about the teammate's trigger
    R.until(() => { light = Math.max(light, h.visibility); meter = Math.max(meter, g.fight.opOf(op)?.meters.get(h)?.m ?? 0); return h.state === 'dead'; }, o.secs ?? 5);
    const los = !g.col.segmentBlocked([A[0], 1.6, A[2]], [B[0], 1.1, B[2]]);
    return { R, g, op, h, key, rounds: R.T.by.operative ?? 0, dead: h.state === 'dead', killer: h.killerId === op.char.id, light, meter, los, trans: g.fight.trans.get(key) };
  };
  // the dark run is the BARE-EYES rule (light gates the trigger): with the team's goggles on, a man with no light burning has his tubes down and
  // does see the defender in the dark — that half is nvg-probes.ts nvg-sight's claim, so the goggles come off for this one run
  const bare = async () => { const was = NVG.on; NVG.on = false; try { return await run({ lit: false }); } finally { NVG.on = was; } };
  const lit = await run({ lit: true }), dark = await bare(), smoke = await run({ lit: true, smoke: 0.12 }), thin = await run({ lit: true, smoke: 0.9 }), back = await run({ lit: true, back: true });
  verdict(lit.los && dark.los, 'the two stand five metres apart in the break room with nothing between them', `line clear: ${lit.los}`);
  verdict(lit.dead && lit.killer && lit.rounds > 0 && lit.rounds <= 6, 'lit (the room\'s tubes on), in his view, clear air: he fires and the man goes down to his rounds', `light on the defender ${f2(lit.light)} · meter ${f2(lit.meter)} · rounds ${lit.rounds} · down ${lit.dead} by him ${lit.killer}`);
  verdict(!dark.dead && dark.rounds === 0 && dark.light < lit.light, 'the same pair with the room dark and no weapon light: five seconds, not a round', `light on the defender ${f2(dark.light)} · meter ${f2(dark.meter)} · rounds ${dark.rounds}`);
  verdict(!smoke.dead && smoke.rounds === 0 && smoke.trans !== undefined && smoke.trans < 0.3, 'lit, but smoke between them (the renderer\'s answer for the pair\'s segment planted at 0.12): not a round', `transmittance read ${f2(smoke.trans ?? NaN)} on ${smoke.key} · meter ${f2(smoke.meter)} · rounds ${smoke.rounds}`);
  verdict(thin.dead && thin.rounds > 0, 'thin smoke (0.9) only slows the sight of him: he still fires', `meter ${f2(thin.meter)} · rounds ${thin.rounds} · down ${thin.dead}`);
  verdict(!back.dead && back.rounds === 0, 'lit, clear air, but behind his back (out of his cone): not a round', `meter ${f2(back.meter)} · rounds ${back.rounds}`);
  // the smoke clears mid-run: the same man is then shot — it is the smoke that held the trigger
  { const R = await floor(61, { lit: true }); const { g } = R; g.fight.blindFire = false; FIGHT_SKILL.hostile.bangBreak = 0;
    const h = R.spawn('hostile', B, A, { name: 'Tango 1' }); const op = R.spawn('operative', A, B, { name: 'Blue One' }); order(op, { goal: null, upper: 'aim', stance: 'none', aimAt: [B[0], 1.2, B[2]] });
    const key = `fightS${Math.min(op.char.id, h.char.id)}_${Math.max(op.char.id, h.char.id)}`; let v = 0.1;
    R.plant = () => { h.dazzledUntil = g.time + 5; g.probe.results.set(key, [v, 0, 0]); };
    R.step(60 * 3); const during = R.T.by.operative ?? 0; v = 1; R.until(() => h.state === 'dead', 4);
    verdict(during === 0 && h.state === 'dead', 'and when the smoke clears he is shot: three seconds of nothing, then the pair', `rounds in the smoke ${during} · after it cleared ${(R.T.by.operative ?? 0) - during} · down ${h.state === 'dead'}`); }
  return done();
});

// ================================================================ eyes on the sights (ROOMFIGHT.sights / sightsFoe)
export const roomfightEyes = guarded(async () => {
  const { verdict, done } = family('roomfight-eyes: a rifle in the shoulder — its owner also sees along his aim');
  noHold = true;   // (the staging has the teammate drop the blinded man behind his shoulder by himself and come back to his ordered aim, which the fans are measured about: under the unfound squad's hold, holdfire.ts, his gun stays on that man — the same sight of him, another aim — and the fans read a wall)
  const A = [29.6, 0, 20.6], B = [34.4, 0, 20.6], RING = 3.8, STEP = 10;   // (3.8 m: past the 3.5 m near field, inside the break room)
  const R = await floor(61, { lit: true }); const { g } = R; g.fight.blindFire = false;
  const op = R.spawn('operative', A, B, { name: 'Blue One' }), h = R.spawn('hostile', [A[0] - 0.4, 0, A[2] + 2.6], B, { name: 'Tango 1' });
  R.plant = () => { h.dazzledUntil = g.time + 5; op.dazzledUntil = 0; };   // (the defender stands behind the teammate's shoulder with his eyes full: nobody fires in this probe)
  order(op, { goal: null, upper: 'aim', stance: 'none', aimAt: [B[0], 1.2, B[2]] });
  R.step(150);
  const c = op.char, eye = c.bones.head ?? [c.pos[0], 1.65, c.pos[2]], aim = c.aimYaw, look = v3.normalize(v3.lerp(c.chestDir, c.headDir(), 0.5));
  const lookOff = Math.abs(wrap(Math.atan2(look[0], look[2]) - aim)) * 57.3, boreOff = Math.abs(wrap(Math.atan2(c.gunDir[0], c.gunDir[2]) - aim)) * 57.3;
  verdict(c.anim.longShown === 'shoulder' && boreOff < 30 && lookOff > 25, 'the staging: his rifle is in the shoulder, level along his aim, and the eye between chest and head points well off it', `carriage ${c.anim.longShown} · bore ${boreOff.toFixed(0)}° off the aim · chest-and-head look ${lookOff.toFixed(0)}° off the aim (the cone is 58° either side of THAT)`);
  /** which bearings off his aim (°, a man stood RING m out with a clear line) this eye sees */
  const fan = (viewer: any, isPlayer = false) => { const out = new Map<number, boolean>(); const e = viewer.char.bones.head ?? [viewer.char.pos[0], 1.65, viewer.char.pos[2]], a0 = viewer === op ? aim : viewer.char.aimYaw;
    for (let d = -170; d <= 180; d += STEP) { const y = a0 + d / 57.2958, p = [e[0] + Math.sin(y) * RING, 0, e[2] + Math.cos(y) * RING];
      if (g.col.segmentBlocked(e, [p[0], 1.1, p[2]]) && g.col.segmentBlocked(e, [p[0], 1.6, p[2]])) continue;
      const stub: any = isPlayer ? Object.assign(Object.create(g.player.char), { pos: p, bones: {} }) : { pos: p, bones: {}, alive: true, id: 999 };
      out.set(d, canSeeChar(g, viewer, stub, isPlayer).visible); }
    return out; };
  const seen = (m: Map<number, boolean>) => [...m].filter(([, v]) => v).map(([d]) => d), show = (m: Map<number, boolean>) => { const s = seen(m); return s.length ? `${s[0]}° to ${s[s.length - 1]}° (${s.length} of ${m.size} bearings with a line)` : 'nothing'; };
  const BREAK = !!process.env.ROOMFIGHT_EYES_BREAK;
  ROOMFIGHT.sights = false; ROOMFIGHT.sightsFoe = false; const off = fan(op);
  ROOMFIGHT.sights = !BREAK; const on = fan(op);
  const CONE = ROOMFIGHT.sightsDeg, near = (m: Map<number, boolean>) => [...m].filter(([d]) => Math.abs(d) <= CONE);
  verdict(near(off).length >= 6 && near(off).some(([, v]) => !v), `switch off (as before): within ${CONE}° of his own aim there is a bearing with a clear line that he does not see`, `sees ${show(off)} · unseen within ${CONE}° of the aim: ${near(off).filter(([, v]) => !v).map(([d]) => d + '°').join(' ') || 'none'}`);
  verdict(near(on).every(([, v]) => v), `switch on: every bearing within the sights' cone (${CONE}° of his aim) with a clear line is seen`, `sees ${show(on)}`);
  verdict(CONE <= FIGHT_SKILL.operative.sectorDeg, 'the sights\' cone sits inside the sector his gun watches (a man seen along his sights is never a surprise to him)', `cone ${CONE}° · sector ${FIGHT_SKILL.operative.sectorDeg}°`);
  verdict([...off].every(([d, v]) => !v || on.get(d) === true), 'and nothing he saw before is lost (the old eye is still his)', `${seen(off).length} bearings before, ${seen(on).length} now`);
  // the entry dip (character.ts MOVES.entry, shipped off): dipped past a friend, the bore fails the sights test and he is back to the old eye; MOVES.entryEyes
  // (shipped off) has canSeeChar read his gun line with the dip's own pitch put back. Asked of canSeeChar itself, on the man staged above.
  { const CH = await import(`${ROOT}/src/game/character.ts`), keep = { ...CH.MOVES }, deg = (r: number) => (r * 57.2958).toFixed(0) + '°';
    try { ROOMFIGHT.sights = true; CH.MOVES.on = 1; CH.MOVES.entry = 1; CH.MOVES.entryEyes = 0; c.anim.dip = 1; for (let i = 0; i < 60; i++) c.update(1 / 60);
      const pitch = Math.asin(c.gunDir[1]), lift0 = c.anim.sightsLift, d0 = fan(op);
      CH.MOVES.entryEyes = BREAK ? 0 : 1; for (let i = 0; i < 2; i++) c.update(1 / 60); const lift1 = c.anim.sightsLift, d1 = fan(op);
      verdict(c.anim.longShown === 'shoulder' && pitch < -0.45 && lift0 === 0 && near(d0).some(([, v]) => !v), 'the entry dip, as built: his muzzle down past a friend, he is back to the old eye (a bearing inside the sights\' cone goes unseen again)', `bore ${deg(pitch)} · carriage ${c.anim.longShown} · sees ${show(d0)} · unseen within ${CONE}° of the aim: ${near(d0).filter(([, v]) => !v).map(([d]) => d + '°').join(' ') || 'none'}`);
      verdict(lift1 > 0.4 && near(d1).every(([, v]) => v) && [...d0].every(([d, v]) => !v || d1.get(d) === true), 'the entry dip with eyes up (MOVES.entryEyes): canSeeChar reads his gun line with the dip put back — every bearing inside the sights\' cone is seen, nothing lost', `lift ${deg(lift1)} · sees ${show(d1)}`);
    } finally { Object.assign(CH.MOVES, keep); c.anim.dip = 0; for (let i = 0; i < 60; i++) c.update(1 / 60); } }
  // Sam is read through the old eye whatever the switch says (the stealth game's sighting as it was)
  { const was = g.playerInvisible; g.playerInvisible = false; ROOMFIGHT.sights = false; const p0 = fan(op, true); ROOMFIGHT.sights = true; const p1 = fan(op, true); g.playerInvisible = was;
    verdict(seen(p0).length > 0 && JSON.stringify([...p0]) === JSON.stringify([...p1]), 'his reading of Sam is the same with the switch on and off', `Sam seen at ${show(p0)} either way`); }
  // the other side: a defender with his long gun in the shoulder — `sights` does not touch him, `sightsFoe` does
  { h.dazzledUntil = 0; R.plant = () => { op.dazzledUntil = g.time + 5; h.dazzledUntil = 0; };
    const hc = h.char, shouldered = () => hc.anim.longShown === 'shoulder' && hc.gunDir[0] * Math.sin(hc.aimYaw) + hc.gunDir[2] * Math.cos(hc.aimYaw) > 0.866;
    g.events.push({ kind: 'shot', pos: [B[0], 0, B[2]], time: g.time, loud: true, level: 1.0, who: op.char.id }); R.until(shouldered, 6);
    ROOMFIGHT.sights = false; ROOMFIGHT.sightsFoe = false; const f0 = fan(h); ROOMFIGHT.sights = true; const f1 = fan(h); ROOMFIGHT.sightsFoe = true; const f2 = fan(h);
    if (!shouldered()) verdict(true, 'the other side (not staged: the defender never brought his gun to the shoulder here — nothing asked of him)', `carriage ${hc.anim.longShown}`);
    else { verdict(JSON.stringify([...f0]) === JSON.stringify([...f1]), 'a defender with his gun in the shoulder sees the same with the teammates\' switch on and off', `sees ${show(f0)}`);
      verdict(seen(f2).length >= seen(f0).length && [...f0].every(([d, v]) => !v || f2.get(d) === true), 'and his own switch (sightsFoe, shipped off) only ever adds to what he sees', `off ${seen(f0).length} bearings · on ${seen(f2).length}`); } }
  return done();
});

// ================================================================ friends: no round past Sam or a teammate; nothing staged
export const roomfightFriends = guarded(async () => {
  const { verdict, done } = family('roomfight-friends: no teammate\'s round at Sam or at the other teammate, and nothing in the fight is staged');
  const BODY = 0.3;
  let nearest = Infinity, nearestWho = '', opRounds = 0, held = 0, runs = 0, drillRounds = 0, stagedBeats = 0, downs = 0, byRound = 0, samRuns = 0, bad = ''; const rows: string[] = [];
  const play = async (seed: number, sam: boolean) => {
    const R = await breach(seed); const { g, NB } = R;
    if (sam) g.godMode = true;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.step(120); R.press();
    if (sam) {   // Sam goes in behind the charge and stands about in the room: in the doorway, then across the middle, lit by whatever is lit — the worst place for a friend to be
      R.until(() => !isNaN(R.beat('bang')), 20); R.vis = 0.6;
      const path = [[28.6, 0, 17.6], [30.2, 0, 17.3], [31.4, 0, 19.2], [30.4, 0, 15.6], [32.0, 0, 17.6]]; let k = 0, next = g.time;
      R.each = () => { if (g.time >= next && k < path.length) { g.teleportPlayer(path[k++]); next = g.time + 1.1; } };
    }
    R.until(() => NB.drill.phase === 'done', 45); R.step(90);
    const beats: string[] = NB.drill.beats.map((b: any) => b.what); const opIds = new Set(NB.ops.map((o: any) => o.char.id));
    runs++; if (sam) samRuns++; opRounds += R.T.by.operative ?? 0; held += g.fight.stats.heldForFriend; drillRounds += NB.drill.rounds[0] + NB.drill.rounds[1];
    stagedBeats += beats.filter(b => /^(eyes|shot|guaranteed)/.test(b)).length;
    for (const h of NB.hostiles) if (h.state === 'dead') { downs++; if (opIds.has(h.killerId) || h.killerId === g.player.char.id) byRound++; }
    if (R.T.friendMin < nearest) { nearest = R.T.friendMin; nearestWho = `seed ${seed}${sam ? ' (Sam inside)' : ''}: ${R.T.friendWho}`; } if (R.T.bad) bad = R.T.bad;
    rows.push(`seed ${seed}${sam ? ' Sam in' : ''}: ${NB.state} · team ${up(NB.ops)}/2 · defenders ${up(NB.hostiles)}/3 · team rounds ${R.T.by.operative ?? 0} · held for a friend ${g.fight.stats.heldForFriend} frames · nearest pass ${f2(R.T.friendMin)} m`);
    NB.stop();
  };
  for (let s = 11; s <= 25; s++) await play(s, false);
  for (let s = 71; s <= 78; s++) await play(s, true);
  verdict(opRounds > 40 && nearest > BODY && !bad, `over ${runs} runs (${samRuns} with Sam stood at five places in the room in turn) no teammate's round passes within ${BODY} m of Sam or of the other teammate`, `team rounds ${opRounds} · nearest pass to a friend ${f2(nearest)} m (${nearestWho || 'none in the flight\'s height'})\n    ${rows.join('\n    ')}`);
  verdict(held > 0, 'and the rule that keeps it so acts: a teammate with a friend in his line holds the round', `frames a round was held for a friend in the line: ${held}`);
  verdict(drillRounds === 0 && stagedBeats === 0, 'nothing staged: the drill fires no round of its own and logs no eyes / shot / guaranteed beat', `BreachDrill.rounds total ${drillRounds} · staged beats ${stagedBeats}`);
  verdict(downs > 10 && byRound === downs, 'every defender down in those runs was dropped by a round with a teammate\'s (or Sam\'s) name on it — nobody put down by hand', `defenders down ${downs} · by a round ${byRound}`);
  return done();
});

// ================================================================ duel: the even meeting
export const roomfightDuel = guarded(async () => {
  const { verdict, done } = family('roomfight-duel: one teammate, one defender, both roused, the same light — the trained man wins most, not all');
  const A = [29.6, 0, 20.6], B = [34.4, 0, 20.6]; const SEEDS = Array.from({ length: 24 }, (_, i) => 81 + i);
  let opWins = 0, defWins = 0, both = 0, none = 0; const firstOp: number[] = [], firstDef: number[] = []; let lo = '', bad = '';
  for (const seed of SEEDS) {
    const R = await floor(seed, { lit: true }); const { g } = R; g.fight.blindFire = false;
    const h = R.spawn('hostile', B, A, { name: 'Tango 1' }); const op = R.spawn('operative', A, B, { name: 'Blue One' });
    order(op, { goal: null, upper: 'aim', stance: 'none', aimAt: [B[0], 1.2, B[2]] });
    h.state = 'alert'; h.awareness = 1; h.lastKnown = [A[0], 0, A[2]]; g.fight.hotT = 0.5;   // both roused (the defender alert; the floor 'hot' for the teammate, as after any shot) and looking down the same line at each other…
    R.plant = () => { if (g.time < 0.5) { h.dazzledUntil = g.time + 0.02; op.dazzledUntil = g.time + 0.02; } };   // …and neither sees the other for the first half second, so both start on the same frame
    FIGHT_SKILL.hostile.bangBreak = 0; FIGHT_SKILL.hostile.daze = [0, 0];   // (the half second above is this probe's blindfold, not a flash: no daze behind it — a bang's daze is the door tools' business, doortools-firstman)
    R.until(() => h.state === 'dead' || op.state === 'dead', 12); R.step(20);
    const o = op.state === 'dead', d = h.state === 'dead'; if (d && !o) opWins++; else if (o && !d) defWins++; else if (o && d) both++; else none++;
    const fo = R.T.shots.find(s => s.team === 'operative'), fd = R.T.shots.find(s => s.team === 'hostile'); if (fo) firstOp.push(fo.t - 0.5); if (fd) firstDef.push(fd.t - 0.5);
    lo = `light on the teammate ${f2(op.visibility)} · on the defender ${f2(h.visibility)}`; if (R.T.bad) bad = R.T.bad;
  }
  const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const n = SEEDS.length;
  verdict(opWins >= n * 0.65 && !bad, `the teammate wins clearly more often than not (≥ 65 % of ${n})`, `teammate ${opWins} · defender ${defWins} · both down ${both} · neither ${none} · ${lo}`);
  verdict(defWins + both >= 1 && none === 0, 'and it is still a fight with live rounds both ways: the defender takes him in some runs, and every run ends with a man down', `defender won or traded in ${defWins + both} of ${n} · undecided ${none}`);
  verdict(firstOp.length > firstDef.length && mean(firstOp) < 0.8, 'the gap is in the skill table: the teammate gets the first round off in most runs, inside a second', `a first round after they can see — teammate: ${firstOp.length} runs, mean ${f2(mean(firstOp))} s · defender: ${firstDef.length} runs, mean ${f2(mean(firstDef))} s (whoever is hit first fires none) · FIGHT_SKILL operative react ${FIGHT_SKILL.operative.react} settleK ${FIGHT_SKILL.operative.settleK} spreadK ${FIGHT_SKILL.operative.spreadK} · hostile react ${FIGHT_SKILL.hostile.react} settleK ${FIGHT_SKILL.hostile.settleK} spreadK ${FIGHT_SKILL.hostile.spreadK}`);
  return done();
});

// ================================================================ orders: what the module borrows it gives back, and whom it leaves alone
export const roomfightOrders = guarded(async () => {
  const { verdict, done } = family('roomfight-orders: an order under an engagement is never written over; a blinded teammate has nobody; a man let off his post is left alone; a restart forgets');
  noHold = true;   // (each rig stages a lone teammate who opens fire by himself on men who have not noticed him — their blindness and his are planted, no can is heard — with no shot or order of Sam's: the unfound squad's hold, holdfire.ts, which the shipped stand raises, would hold every round; who fires first is holdfire-check's question)
  const A = [29.6, 0, 20.6], B = [34.4, 0, 20.6], B2 = [33.5, 0, 22.5];
  { // the order's own aim / carriage / facing while his muzzle is his own — and a re-order under it is what he goes back to
    const R = await floor(91, { lit: true }); const { g } = R; g.fight.blindFire = false; FIGHT_SKILL.hostile.bangBreak = 0;
    const h = R.spawn('hostile', B, A, { name: 'Tango 1' }); const op = R.spawn('operative', A, [A[0], 0, A[2] - 4], { name: 'Blue One' });
    const X = [A[0], 1.2, A[2] - 4], Y = [A[0] - 3, 1.2, A[2]];
    order(op, { goal: null, upper: 'none', stance: 'lowReady', aimAt: X, face: Math.PI });   // gun down, looking away from the man (he is 90° off: inside the cone's near reach? no — five metres: outside it)
    R.plant = () => { h.dazzledUntil = g.time + 5; }; R.step(30);
    const quiet = (R.T.by.operative ?? 0) === 0 && !op.script.over;
    order(op, { aimAt: [B[0], 1.2, B[2]] }); let during: any = null;   // the order turns his eyes to the man: he sees him and his muzzle becomes his own
    R.until(() => { if (op.script?.over && !during) during = { upper: op.script.upper, stance: op.script.stance, face: op.script.face, anim: op.char.anim.upper, drawn: op.drawn }; if (during && h.state !== 'dead' && op.script.aimAt !== Y) order(op, { upper: 'aim', stance: 'none', aimAt: Y }); return h.state === 'dead'; }, 6);
    R.step(90);
    verdict(quiet && !!during && during.upper === 'none' && during.stance === 'lowReady' && during.face === Math.PI && during.anim === 'aim' && during.drawn,
      'while he engages, the order on his script is exactly as ordered (the gun comes up through the overlay, not by rewriting it)', `before he saw him: no round, no overlay ${quiet} · during: script upper ${during?.upper} stance ${during?.stance} face ${f2(during?.face)} · shown upper ${during?.anim} drawn ${during?.drawn}`);
    verdict(h.state === 'dead' && !op.script.over && op.script.upper === 'aim' && op.script.stance === 'none' && op.script.aimAt === Y,
      'a re-order given while he was engaging is what he goes back to when the man is down', `down ${h.state === 'dead'} · overlay ${op.script.over ? 'still on' : 'off'} · upper ${op.script.upper} stance ${op.script.stance} aimAt ${op.script.aimAt === Y ? 'the new point' : 'NOT the new point'}`);
  }
  { // two men in his view: the first goes down, a charge takes his eyes — not a round at the second on memory; when he can see again, he is shot
    const R = await floor(92, { lit: true }); const { g } = R; g.fight.blindFire = false; FIGHT_SKILL.hostile.bangBreak = 0;
    const h1 = R.spawn('hostile', B, A, { name: 'Tango 1' }), h2 = R.spawn('hostile', B2, A, { name: 'Tango 2' }); const op = R.spawn('operative', A, [34.4, 0, 18.3], { name: 'Blue One' });
    order(op, { goal: null, upper: 'aim', stance: 'none', aimAt: [34.4, 1.2, 18.3] });   // (both men inside his cone: a rifleman's chest is bladed, so the game's eye cone sits to the left of his muzzle)
    R.plant = () => { h1.dazzledUntil = g.time + 5; h2.dazzledUntil = g.time + 5; };
    R.until(() => h1.state === 'dead' || h2.state === 'dead', 6); const first = R.T.by.operative ?? 0; const oneDown = up([h1, h2]) === 1;
    op.dazzledUntil = g.time + 2.5; R.step(60 * 2.4); const blindRounds = (R.T.by.operative ?? 0) - first; const stillUp = up([h1, h2]);
    R.until(() => up([h1, h2]) === 0, 5);
    verdict(oneDown && blindRounds === 0 && stillUp === 1 && up([h1, h2]) === 0, 'dazzled with a second man in front of him: no round for the length of it, and the man is shot once he can see', `first man down ${oneDown} · rounds while dazzled ${blindRounds} · still up at the end of it ${stillUp} · after: ${up([h1, h2])} up`);
  }
  { // guards.ts engage() lets a held defender off his post: this module does not put him back on it
    const R = await floor(93, { lit: true }); const { g } = R; g.fight.blindFire = false;
    const h = R.spawn('hostile', B, A, { name: 'Tango 1' }); const op = R.spawn('operative', [29.0, 0, 13.4], [29.0, 0, 9], { name: 'Blue One' });
    order(op, { goal: null, upper: 'none', stance: 'lowReady' });
    R.step(30); const adopted = !!g.fight.watchOf(h) && h.hold && h.pinned;
    engage(g, [op], [h]); R.step(3);
    verdict(adopted && !h.hold && !h.pinned && !g.fight.watchOf(h) && h.skill === null, 'a defender let off his post by engage() stays off it (not held and pinned again the next frame) and is off the roster', `adopted first ${adopted} · after engage(): hold ${h.hold} pinned ${h.pinned} · on the roster ${!!g.fight.watchOf(h)} · skill ${h.skill === null ? 'none' : 'still set'}`);
  }
  { // a restart: nothing of the last fight is remembered, and the blind-fire knob is back at its default
    const R = await floor(94, { lit: true }); const { g } = R; g.fight.blindFire = false; FIGHT_SKILL.hostile.bangBreak = 0;
    const h = R.spawn('hostile', B, A, { name: 'Tango 1' }); const op = R.spawn('operative', A, B, { name: 'Blue One' });
    order(op, { goal: null, upper: 'aim', stance: 'none', aimAt: [B[0], 1.2, B[2]] }); R.plant = () => { h.dazzledUntil = g.time + 5; };
    R.until(() => h.state === 'dead', 6); const fought = g.fight.stats.opRounds > 0 && g.fight.log.length > 0;
    R.plant = null; g.restartEncounter(); const st = g.fight.stats;
    verdict(fought && !g.fight.live && g.fight.blindFire === true && st.opRounds === 0 && g.fight.log.length === 0 && g.fight.trans.size === 0, 'restartEncounter drops the module\'s memory (stats, log, smoke answers, roster) and puts blind fire back to its default', `fought ${fought} · after: live ${g.fight.live} · blindFire ${g.fight.blindFire} · rounds ${st.opRounds} · log ${g.fight.log.length} · smoke keys ${g.fight.trans.size}`);
  }
  return done();
});

// ================================================================ off: the switch, and nothing without units
export const roomfightOff = guarded(async () => {
  const { verdict, done } = family('roomfight-off: the switch puts the staged night breach back; with no unit on the floor the module is not there');
  { ROOMFIGHT.on = false; const R = await breach(12, { blindFire: false }); const { NB, g } = R;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.step(120); R.press(); R.until(() => NB.drill.phase === 'done', 45);
    const beats: string[] = NB.drill.beats.map((b: any) => b.what);
    verdict(!g.fight.live && NB.drill.rounds[0] + NB.drill.rounds[1] > 0 && beats.some(b => b.startsWith('shot')) && g.fight.stats.opRounds === 0, 'ROOMFIGHT.on false: the branch\'s staged exchange runs (the drill\'s own rounds and beats) and the module does nothing',
      `live ${g.fight.live} · drill rounds ${NB.drill.rounds.join('+')} · module rounds ${g.fight.stats.opRounds} · ${NB.summary()}`);
    NB.stop(); ROOMFIGHT.on = true; }
  { const run = async (on: boolean) => { ROOMFIGHT.on = on; Math.random = seeded(5); const W: any = await standUp(); Math.random = seeded(77); let live = false; for (let i = 0; i < 600; i++) { W.step(DT); live ||= W.game.fight.live; } return { d: JSON.stringify(digestGame(W.game, true)), live }; };
    const a = await run(true), b = await run(false); ROOMFIGHT.on = true;
    verdict(a.d === b.d && !a.live && !b.live, 'the night game with no unit on the floor: never live, and ten seeded seconds digest the same with the switch on or off', `digest ${a.d.length} chars · ${a.d === b.d ? 'equal' : 'DIFFERENT'} · live ${a.live}/${b.live}`); }
  return done();
});
