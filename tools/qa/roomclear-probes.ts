// The 'roomclear' family (game/roomclear.ts — the ROOM CLEAR behind ?roomclear / --roomclear: the night breach's playtest on a structure of four held rooms), run
// through probes.ts:
//   bun run tools/qa/probes.ts roomclear | roomclear-off | roomclear-data | roomclear-stage | roomclear-rooms | roomclear-ends | roomclear-restart | roomclear-stop
// PASS / FAIL each, all headless (the Game of headless.ts; the scenario started with game.roomClear.start() exactly as main.ts's flag starts it). The harness has no
// light meter: Sam's visibility is planted dark, and what the defenders SEE of anybody is guards.ts's direct-light estimate, not the page's.
// WHAT THIS FAMILY HOLDS is the set-up and the score-keeping this scenario owns — the rooms, who holds them, the cleared state, the two ends, restart and stop. How
// the fight goes is the night breach's (its own family, 'nightbreach', is the gate that this file's seam left it alone) and is only touched here by one real entry.
//   roomclear-off      nothing of it runs until started: inactive, no rooms, the mission's own objective line; and ?nightbreach alone is still the break room's
//                      three off the breach plan with this scenario off
//   roomclear-data     the structure against the level (checkStructure: doors exist, marks stand on floor inside their rooms clear of the furniture with a line
//                      past the walls to the door they watch — asked of the level as authored, so ninety seconds of the shift swinging doors refuses no start),
//                      three or four rooms, one at least with more than one way in, the garrisons inside the character budget; the deal is a pure function of
//                      (seed, attempt), valid on every seed tried, the authored placement on seed 0, and not one placement
//   roomclear-stage    start(): the night breach's floor (shift benched, no civilians, QRF idle, Game.tune untouched), the pair on the approach marks, five
//                      defenders held and pinned on the dealt marks facing the doors they watch, each room given its men, every structure door shut with the
//                      level's own locks, the budgets held, the objective line the rooms'; with no order nobody moves, nobody fires and nothing is called
//   roomclear-rooms    each room flips to cleared when its own men are down and not before (a two-man room after one man: still held), in any order, struck
//                      counting like shot; a living defender standing in a cleared room holds it again until he is down; and one real entry — F, F with the
//                      charge in and blind fire off — takes the break room with real rounds, calls it, and ends nothing while three rooms are held
//   roomclear-ends     'taken' fires once, on the last defender, with every room clear; 'wiped' fires when Sam goes down, and stays (the rooms emptied afterwards
//                      do not turn it into a win, and are not called); the pair down is not an end in play ('pair:down' logged, said once and only by this
//                      scenario, Sam fights on) and IS one under the tally's switch; the stealth mission's stages stand still under it and move again after
//   roomclear-restart  a restart under it (Shift+Enter, a bare restartEncounter) stages the structure again: fresh cast, every room held, no end, doors shut — the
//                      next placement of the seed with re-deal on, the same one with it off; start(seed) deals that seed's placement
//   roomclear-stop     stop() puts the night back (the shift, the civilians, the lights, Game.tune, the mission's objective line) and drops the layout — the night
//                      breach started afterwards is the break room's three; the night breach's own stop under it ends this scenario too; a checkpoint load is
//                      refused while it is up
import { standUp, ROOT } from './headless.ts';
const { ROOMCLEAR, STRUCTURE, placeDefenders, checkStructure, doorPlan } = await import(`${ROOT}/src/game/roomclear.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { killGuard, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { canLoad } = await import(`${ROOT}/src/game/savestate.ts`);
const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const steady = (W: any) => W.engine.lights.lights.filter((l: any) => l.ttl < 0).length;
const up = (l: any[]) => l.filter(x => x.state !== 'dead').length;
const sig = (P: any[]) => P.map(p => `${p.room}#${p.mark}`).join(' ');
const DOORS: string[] = [...new Set<string>(STRUCTURE.rooms.flatMap((r: any) => r.doors.map((d: any) => d.id)))];

/** One game under a seed with the knob tables at their defaults plus `knobs` / `nb`; started unless told not to. step() keeps Sam dark (no meter headless) and
 *  counts rounds by side off the 'guardShot' events. */
async function rig(seed: number, knobs: Record<string, unknown> = {}, start: boolean | number = true, nb: Record<string, unknown> = {}) {
  Object.assign(ROOMCLEAR, RC_DEFAULTS, knobs); Object.assign(NIGHTBREACH, NB_DEFAULTS, nb);
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game; const RC = game.roomClear, NB = game.nightBreach;
  const before = { guards: game.guards.length, civilians: game.civilians.length, steady: steady(W), tune: JSON.stringify(game.tune), objective: game.objectiveText(),
    doors: Object.fromEntries(game.doors.list.map((d: any) => [d.def.name, d.locked])) as Record<string, boolean> };
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }   // (game.messages keeps the last five only)
  const why = start === false ? null : RC.start(typeof start === 'number' ? start : undefined);
  const seen = new Set<any>();
  const R = { W, game, RC, NB, why, before, said, shots: {} as Record<string, number>, bad: '',
    heard(re: RegExp) { return said.filter(t => re.test(t)).length; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05; W.step(DT);
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'guardShot') { const w = game.guards.find((x: any) => x.char.id === e.who); const k = w ? w.team : '?'; R.shots[k] = (R.shots[k] ?? 0) + 1; } }
        for (const x of game.guards) if (!R.bad && !x.char.pos.every(Number.isFinite)) R.bad = `${x.callsign} at ${x.char.pos}`;
      }
    },
    press(code = 'KeyF') { W.input.pressed.add(code); R.step(); },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    room(id: string) { return RC.rooms.find((r: any) => r.def.id === id); },
    /** put a room's men down by hand (a round's kill unless `quiet`: then struck, out cold) — `n` of them, default all */
    drop(id: string, n = Infinity, quiet = false) { let k = 0; for (const h of R.room(id).defenders) if (h.state !== 'dead' && k < n) { killGuard(game, h, [1, 0, 0], quiet, quiet ? 'struck' : 'shot', 'player'); k++; } R.step(2); },
    logged(what: string) { return RC.log.filter((l: any) => l.what === what).length; },
    cleared() { return RC.rooms.filter((r: any) => r.cleared).map((r: any) => r.def.id).join(',') || 'none'; },
  };
  return R;
}
/** every probe leaves both knob tables as it found them, pass, fail or throw (the runner's snapshot does not know these tables) */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); } };

export const roomclearOff = guarded(async () => {
  const { verdict, done } = family('roomclear-off: nothing of it runs until it is started');
  const R = await rig(5, {}, false); const { game: g, RC, NB } = R;
  R.step(300);
  verdict(!RC.active && RC.state === 'off' && RC.rooms.length === 0 && RC.end === null && RC.log.length === 0 && (RC.objective()?.text ?? null) === null && NB.layout === null && !NB.active,
    'inert after five seconds of night floor: inactive, no rooms, no end, an empty log, no layout on the night breach', `${RC.summary()} · rooms ${RC.rooms.length} · log ${RC.log.length} · layout ${NB.layout}`);
  verdict(g.objectiveText() === R.before.objective && /server room/.test(g.objectiveText()) && g.guards.length === R.before.guards && !g.guards.some((x: any) => x.unit),
    'the floor is the night game\'s: the shift, no unit, the mission\'s own objective line', `objective '${g.objectiveText()}' · guards ${g.guards.length}`);
  const why = NB.start(); R.step(30); const P = g.level.breach;
  verdict(why === null && NB.active && !RC.active && RC.state === 'off' && (RC.objective()?.text ?? null) === null && NB.hostiles.length === 3 && NB.drill.hostiles.length === 3 && NB.hostiles.every((h: any, i: number) => dist(h.char.pos, P.hostiles[i].pos) < 0.3) && RC.rooms.length === 0,
    '?nightbreach alone is the break room\'s three on the breach plan\'s marks, all three the drill\'s — and this scenario stays off under it', `${NB.summary()} · drill hostiles ${NB.drill.hostiles.length} · ${RC.summary()}`);
  verdict(RC.start() !== null && !RC.active && NB.layout === null, 'started over a standing night breach it is refused, and leaves that one alone', `refusal: ${RC.canStart()} · layout ${NB.layout}`);
  return done();
});

export const roomclearData = guarded(async () => {
  const { verdict, done } = family('roomclear-data: the structure is sound against the level and the deal is a pure function of its seed');
  const R = await rig(5, {}, false); const { game: g } = R;
  const bad = checkStructure(g); const rooms = STRUCTURE.rooms;
  verdict(bad.length === 0, 'checkStructure finds nothing: every door in the level, every mark on standable floor inside its room, watching a door of its room with a line to the point it covers',
    bad.length ? bad.join(' | ') : `${rooms.length} rooms · ${rooms.reduce((n: number, r: any) => n + r.marks.length, 0)} marks · ${DOORS.length} doors (${DOORS.join(', ')})`);
  const total = rooms.reduce((n: number, r: any) => n + r.garrison, 0), multi = rooms.filter((r: any) => r.doors.length > 1);
  verdict(rooms.length >= 3 && rooms.length <= 4 && multi.length >= 1 && rooms.every((r: any) => r.garrison >= 1) && 1 + 2 + total <= 8,
    'three or four rooms, each held, at least one with more than one way in, and the garrisons fit the character budget beside Sam and the pair',
    rooms.map((r: any) => `${r.name}: ${r.garrison} of ${r.marks.length} marks, ${r.doors.length} door${r.doors.length > 1 ? 's' : ''} (${r.doors.map((d: any) => `${d.id} from the ${d.from}`).join(', ')})`).join(' · ') + ` · ${1 + 2 + total} characters of 8`);
  // connected: every room's doors lead to the corridor, the cubicles, outside or another room of the structure, and every room can be walked to from Sam's mark
  const reach = rooms.map((r: any) => r.marks.every((m: any) => !!g.col.nav.findPath(NIGHTBREACH.samAt, m.pos)));
  verdict(reach.every(Boolean), 'connected: the nav grid has a path from Sam\'s mark to every mark of every room (doors are not walls to it)', rooms.map((r: any, i: number) => `${r.name} ${reach[i] ? 'reached' : 'CUT OFF'}`).join(' · '));
  const plans = DOORS.map(d => `${d}:${doorPlan(g, d) ? 'plan' : 'none'}`);
  verdict(!!doorPlan(g, 'breakroom_w') && !!doorPlan(g, 'storage') && doorPlan(g, 'nope') === null, 'doorPlan finds the level\'s stack-and-enter plan for a door where it has one', plans.join(' · '));
  let invalid = '', same = true; const seenSigs = new Set<string>();
  for (let s = 0; s < 50; s++) for (let a = 1; a <= 3; a++) {
    const P = placeDefenders(s, a), Q = placeDefenders(s, a); if (JSON.stringify(P) !== JSON.stringify(Q)) same = false; seenSigs.add(sig(P));
    for (const r of rooms) { const mine = P.filter((p: any) => p.room === r.id); if (mine.length !== r.garrison || new Set(mine.map((p: any) => p.mark)).size !== mine.length || mine.some((p: any) => !r.marks[p.mark] || dist(p.pos, r.marks[p.mark].pos) > 1e-9)) invalid ||= `seed ${s}/${a} ${r.id}`; }
    if (P.length !== total || P.some((p: any, i: number) => p.name !== `Tango ${i + 1}`)) invalid ||= `seed ${s}/${a} count/names`;
  }
  const authored = placeDefenders(0, 1); const first = rooms.flatMap((r: any) => r.marks.slice(0, r.garrison).map((_: any, k: number) => `${r.id}#${k}`)).join(' ');
  Math.random = () => { throw new Error('placeDefenders drew from Math.random'); }; let pure = true; try { placeDefenders(7, 2); } catch { pure = false; } Math.random = seeded(1);
  verdict(same && !invalid && pure && sig(authored) === first && seenSigs.size >= 20, 'the deal: the same (seed, attempt) deals the same men, every deal fills each room\'s garrison from its own marks, seed 0 first is the authored placement, Math.random is never drawn, and 150 deals are not one placement',
    `repeatable ${same} · invalid ${invalid || 'none'} · pure ${pure} · authored '${sig(authored)}' · ${seenSigs.size} distinct placements in 150`);
  { // the furniture check has teeth: a mark inside the stacked cartons at the back of storage is refused in words
    const st = rooms.find((r: any) => r.id === 'storage'); const inCarton = checkStructure(g, { rooms: [{ ...st, marks: [{ ...st.marks[0], pos: [33.0, 0, 5.3] }] }] });
    verdict(inCarton.some((b: string) => /cardboard/.test(b)), 'a mark standing in a carton is a problem checkStructure names (the nav grid alone does not know the furniture)', inCarton.join(' | ') || 'NOTHING FOUND'); }
  { // … and the answer is the level's, not this frame's: ninety seconds of the night shift walking its routes through these doors refuses no start
    const marks = rooms.flatMap((r: any) => r.marks); let samples = 0, refused = 0, why = '', leafAcross = 0;
    for (let i = 0; i < 60 * 90; i++) { R.step(); if (i % 10) continue; samples++; const w = R.RC.canStart(); if (w) { refused++; why ||= w; } if (marks.some((m: any) => g.col.segmentBlockedDynamic([m.pos[0], 1.6, m.pos[2]], m.aimAt))) leafAcross++; }
    verdict(refused === 0 && leafAcross > 0 && checkStructure(g).length === 0, 'on a living floor it can always start: no refusal in ninety seconds of patrols, though a door leaf stood across some mark\'s line for part of it',
      `${samples} samples · refused ${refused}${why ? ` (${why})` : ''} · a leaf across a mark's line in ${leafAcross}`);
    const whyLate = R.RC.start(); R.step(2);
    verdict(whyLate === null && R.RC.active && R.NB.hostiles.length === total, 'and started there, mid-shift, it stages', `${whyLate ?? R.RC.summary()}`); }
  return done();
});

export const roomclearStage = guarded(async () => {
  const { verdict, done } = family('roomclear-stage: start() stages the structure, the pair and five defenders inside the budgets');
  const R = await rig(11); const { game: g, RC, NB, W } = R; const P = g.level.breach;
  verdict(R.why === null && RC.active && RC.state === 'live' && NB.active && NB.state === 'staged' && NB.staged === 1 && R.logged('staged:0/1') === 1, 'start() is accepted: the room clear is up, and it is the night breach, staged', `refusal ${R.why} · ${RC.summary()} · ${NB.summary()}`);
  const staff = g.guards.filter((x: any) => !x.unit);
  verdict(staff.length === 0 && g.civilians.length === 0 && g.qrf.state === 'idle' && JSON.stringify(g.tune) === R.before.tune, 'nobody else on the floor: the shift benched, no civilians, the response team idle — and no Game.tune switch written',
    `staff ${staff.length} (was ${R.before.guards}) · civilians ${g.civilians.length} (was ${R.before.civilians}) · qrf ${g.qrf.state} · tune ${JSON.stringify(g.tune) === R.before.tune ? 'untouched' : 'CHANGED'}`);
  const want = placeDefenders(0, 1);
  const opsOk = NB.ops.length === 2 && NB.ops.every((o: any, i: number) => o.team === 'operative' && o.unit && dist(o.char.pos, P.from[i]) < 0.3);
  const hosOk = NB.hostiles.length === want.length && JSON.stringify(RC.placement) === JSON.stringify(want) && NB.hostiles.every((h: any, i: number) => h.team === 'hostile' && h.unit && h.hold && h.pinned && !h.script && dist(h.char.pos, want[i].pos) < 0.3 && h.callsign === want[i].name);
  verdict(opsOk && hosOk, 'the cast: two operatives on the approach marks, five hostiles held and pinned on the dealt marks, left to the fight AI (no script)',
    `ops ${NB.ops.map((o: any) => `${o.callsign}@${o.char.pos.map(f2)}`).join(' ')} · hostiles ${NB.hostiles.map((h: any) => `${h.callsign}@${f2(h.char.pos[0])},${f2(h.char.pos[2])}`).join(' ')}`);
  const roomsOk = RC.rooms.length === STRUCTURE.rooms.length && RC.rooms.every((r: any) => r.defenders.length === r.def.garrison && !r.cleared && isNaN(r.clearedAt) && r.defenders.every((h: any) => RC.roomAt(h.char.pos) === r.def.id));
  const drillOk = NB.drill.hostiles.length === 2 && NB.drill.hostiles.every((h: any) => R.room('breakroom').defenders.includes(h));
  verdict(roomsOk && drillOk, 'each room is given its own men, standing inside it, none clear; the drill behind F is handed the break room\'s two and nobody else', `${RC.rooms.map((r: any) => `${r.def.name}: ${r.defenders.map((h: any) => h.callsign).join('+')}`).join(' · ')} · drill: ${NB.drill.hostiles.map((h: any) => h.callsign).join('+')}`);
  R.step(30);
  const facing = NB.hostiles.map((h: any, i: number) => { const yaw = Math.atan2(want[i].aimAt[0] - h.char.pos[0], want[i].aimAt[2] - h.char.pos[2]); let d = Math.abs(h.char.bodyYaw - yaw) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d * 57.3; });
  verdict(facing.every((d: number) => d < 12), 'every defender squared to the door his mark watches', NB.hostiles.map((h: any, i: number) => `${h.callsign}→${want[i].watch} ${f2(facing[i])}°`).join(' · '));
  const doors = DOORS.map(id => g.doors.byName(id));
  verdict(doors.every((d: any) => d && Math.abs(d.angle) < 0.02 && d.latched && d.locked === R.before.doors[d.def.name] && !d.lockBroken), 'every way into the structure is shut and latched, with the level\'s own locks', doors.map((d: any) => `${d.def.name} ${f2(d.angle)}${d.locked ? ' locked' : ''}`).join(' · '));
  verdict(1 + g.guards.length === 8 && steady(W) <= MAX_LIGHTS, 'inside the budgets: eight characters all told, the steady lights under the buffer', `characters ${1 + g.guards.length}/8 · steady lights ${steady(W)}/${MAX_LIGHTS} (night ${R.before.steady})`);
  const pl = g.player;
  verdict(dist(pl.char.pos, NIGHTBREACH.samAt) < 0.3 && pl.slot === 'rifle' && !pl.holstered && !pl.down, 'Sam beside the pair with the rifle up', `Sam @${pl.char.pos.map(f2)} ${pl.slot}`);
  const op = g.objectivePos(), br = STRUCTURE.rooms[0].bounds;
  verdict(g.objectiveText() === (RC.objective()?.text ?? null) && /clear the structure/.test(g.objectiveText()) && STRUCTURE.rooms.every((r: any) => g.objectiveText().includes(r.name)) && !g.objectiveText().includes('✓') && !!op && dist(op, [(br.x0 + br.x1) / 2, 0, (br.z0 + br.z1) / 2]) < 0.01 && RC.objective() === RC.objective(),
    'the HUD\'s objective is the structure\'s: every room named, none ticked, the marker on the first room still held (not the mission\'s server door) — worded once, not every frame', `'${g.objectiveText()}' · marker ${op?.map(f2)}`);
  R.step(60 * 6);
  const still = NB.hostiles.every((h: any, i: number) => dist(h.char.pos, want[i].pos) < 0.05) && NB.ops.every((o: any, i: number) => dist(o.char.pos, P.from[i]) < 0.3);
  const shoved = g.props.props.filter((p: any) => STRUCTURE.rooms.some((r: any) => p.home[0] > r.bounds.x0 && p.home[0] < r.bounds.x1 && p.home[1] > r.bounds.z0 && p.home[1] < r.bounds.z1) && Math.hypot(p.x - p.home[0], p.z - p.home[1]) > 0.02);
  verdict(shoved.length === 0, 'no defender stands in the furniture: nothing in the four rooms has been shoved off its place', shoved.length ? shoved.map((p: any) => `${p.def.name} moved ${f2(Math.hypot(p.x - p.home[0], p.z - p.home[1]))} m`).join(' · ') : `defenders within ${f2(Math.max(...NB.hostiles.map((h: any, i: number) => dist(h.char.pos, want[i].pos))))} m of their marks`);
  verdict(still && Object.keys(R.shots).length === 0 && R.cleared() === 'none' && RC.end === null && RC.log.length === 1 && !R.bad && NB.state === 'staged', 'with no order given: six seconds on nobody has left his mark, nobody has fired, nothing is called',
    `on marks ${still} · rounds ${JSON.stringify(R.shots)} · cleared ${R.cleared()} · end ${RC.end} · log ${RC.log.map((l: any) => l.what).join(',')}`);
  return done();
});

export const roomclearRooms = guarded(async () => {
  const { verdict, done } = family('roomclear-rooms: a room flips to cleared when its own men are down, and not before');
  { const R = await rig(11); const { game: g, RC } = R; R.step(30);
    R.drop('breakroom', 1);
    verdict(!R.room('breakroom').cleared && R.cleared() === 'none', 'one of the break room\'s two down: the room is still held', `${RC.summary()}`);
    R.drop('storage', 1, true);
    verdict(R.room('storage').cleared && R.cleared() === 'storage' && R.logged('cleared:storage') === 1 && Number.isFinite(R.room('storage').clearedAt) && RC.end === null, 'storage\'s one man struck, out cold: storage is clear (down is down), and it is the only one', `cleared ${R.cleared()} · at ${f2(R.room('storage').clearedAt)} · ${RC.summary()}`);
    if (WORDS.on) R.step(45);   // (the dialogue pass: rooms that come clear together are called in ONE line, 0.6 s after the first — and a room nobody of the team stood in is 'nobody left in', not 'clear')
    verdict(g.objectiveText().includes('✓ storage') && !g.objectiveText().includes('✓ break room') && g.messages.some((m: any) => /(?:storage clear|nobody left in storage) — 3 rooms to go/.test(m.text)), 'it is called on the HUD and ticked on the objective line', `'${g.objectiveText()}' · said: ${g.messages.map((m: any) => m.text).filter((t: string) => /clear/.test(t)).join(' | ')}`);
    // a living defender of another room standing in a cleared one holds it again (nobody walks today — they are pinned — so he is carried)
    const man = R.room('manager').defenders[0]; const home = [...man.char.pos]; man.char.pos = [33.0, 0, 7.0];
    man.held = { by: 'player', since: g.time, variant: 'arm', phase: 'hold', reverse: false }; RC.tick(DT);   // (in Sam's arm he holds no room: the scenario's own tick alone — nothing else is told he is held)
    const hostage = R.room('storage').cleared && R.logged('lost:storage') === 0 && !R.room('manager').cleared; man.held = null;
    verdict(hostage, 'a defender walked through cleared storage in Sam\'s arm does not take it back (and his own room is still held: he is up)', `storage ${R.room('storage').cleared ? 'clear' : 'HELD'} · lost logged ${R.logged('lost:storage')} · manager ${R.room('manager').cleared ? 'CLEAR' : 'held'}`);
    R.step(2);
    const lost = !R.room('storage').cleared && R.logged('lost:storage') === 1 && !R.room('manager').cleared;
    killGuard(g, man, [1, 0, 0], false, 'shot', 'player'); R.step(2);
    verdict(lost && R.room('storage').cleared && R.room('manager').cleared && R.logged('cleared:storage') === 2 && R.logged('cleared:manager') === 1, 'a living defender carried into cleared storage holds it again (and his own room is not clear while he lives); down, both rooms are clear',
      `lost while he stood there ${lost} (he came from ${home.map(f2)}) · cleared ${R.cleared()} · log ${RC.log.map((l: any) => l.what).join(',')}`);
    R.drop('breakroom');
    verdict(R.room('breakroom').cleared && !R.room('server').cleared && RC.end === null && RC.state === 'live', 'the break room\'s second man down: it is clear; the server room is still held and nothing has ended', `cleared ${R.cleared()} · ${RC.summary()}`);
    R.drop('server');
    const order = RC.log.filter((l: any) => /^cleared:/.test(l.what)).map((l: any) => l.what.slice(8));
    verdict(RC.rooms.every((r: any) => r.cleared) && order.join(',') === 'storage,storage,manager,breakroom,server', 'the last room goes, and the log has the rooms in the order they were cleared', `order ${order.join(' → ')}`);
  }
  { // one real entry: F, F on the break room's west door with the charge in and blind fire off (the night breach's walkover setting) — real rounds take the room
    const R = await rig(12, {}, true, { blindFire: false }); const { game: g, RC, NB } = R; g.tune.chaos = 0;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.press();
    const called = R.until(() => R.room('breakroom').cleared, 30); R.until(() => NB.drill.phase === 'done', 10);
    const beats = NB.drill.beats.map((b: any) => b.what);
    verdict(called && NB.state === 'clear' && beats.includes('bang') && beats.includes('clear') && (R.shots.operative ?? 0) >= 2 && up(R.room('breakroom').defenders) === 0, 'a real entry on F, F takes the break room: kick, charge, the pair\'s own rounds, both its men down, the drill calls it and the room flips',
      `${RC.summary()} · drill ${NB.state} · rounds ${JSON.stringify(R.shots)} · beats ${beats.filter((b: string) => /kick|bang|enter1|clear|down/.test(b)).join(' ')}`);
    R.step(60 * 5);
    const others = ['storage', 'manager', 'server'].map(id => R.room(id));
    // (since the room fight — roomfight.ts — a man next door comes to the gunfire: storage's man may walk into the break room's fight and fall there, and his
    // room is then honestly clear. What must hold is the rule, not who stayed put: a room is cleared exactly when none of its own men is standing, and nothing ends.)
    // (…and the break room itself by the rule proven above — a living defender standing in a cleared room holds it again: the man who comes to the gunfire
    // may still be standing in its doorway, out of both men's sight, when this looks. Whether the pair has dropped him inside five seconds is the fight's
    // outcome under this seed — it moved with a 10 cm difference in where a man stood once the team had goggles, nvg.ts — not the rule.)
    const inBr = RC.rooms.flatMap((r: any) => r.defenders).filter((h: any) => up([h]) > 0 && RC.roomAt(h.char.pos) === 'breakroom');
    verdict(R.room('breakroom').cleared === (inBr.length === 0) && RC.end === null && others.every((r: any) => r.cleared === (up(r.defenders) === 0)) && others.some((r: any) => !r.cleared) && !R.bad,
      'and nothing it did not earn: every other room is cleared exactly when none of its own men is standing (a man next door may come to the gunfire), no end', `cleared ${R.cleared()} · end ${RC.end} · break room ${inBr.length ? `held again by ${inBr.map((h: any) => h.callsign).join(', ')}, standing in it` : 'clear, nobody standing in it'} · ${others.map((r: any) => `${r.def.name} ${up(r.defenders)}/${r.defenders.length} ${r.defenders.map((h: any) => h.state).join('')}${r.defenders.map((h: any) => RC.roomAt(h.char.pos) === r.def.id ? '' : ' (out of it)').join('')}`).join(' · ')}`);
  }
  return done();
});

export const roomclearEnds = guarded(async () => {
  const { verdict, done } = family('roomclear-ends: structure taken, team wiped');
  { const R = await rig(11); const { game: g, RC, NB } = R; R.step(30);
    for (const id of ['server', 'manager', 'storage']) R.drop(id);
    const before = RC.end; R.drop('breakroom', 1); const mid = RC.end; R.drop('breakroom');
    verdict(before === null && mid === null && RC.end === 'taken' && RC.state === 'taken' && R.logged('end:taken') === 1 && RC.rooms.every((r: any) => r.cleared) && Number.isFinite(RC.endAt) && up(NB.hostiles) === 0,
      '\'taken\' fires on the last defender and not one man sooner, with every room clear', `end ${before} → ${mid} → ${RC.end} at ${f2(RC.endAt)} (${RC.endWhy}) · ${RC.summary()}`);
    R.step(120);
    verdict(R.logged('end:taken') === 1 && R.heard(/structure taken/) === 1 && /structure taken/.test(g.objectiveText()) && g.objectivePos() === null, 'once: the end is not announced again, the HUD says so and points nowhere', `'${g.objectiveText()}' · ends logged ${R.logged('end:taken')} · said ${R.heard(/structure taken/)}×`);
    // the stealth mission underneath stands still: Sam in the server room pulls no objective, and out past the fire exit completes nothing
    const M = g.level.mission, stage0 = g.mission.stage;
    g.teleportPlayer([(M.serverRoom.x0 + M.serverRoom.x1) / 2, 0, (M.serverRoom.z0 + M.serverRoom.z1) / 2]); R.step(30); const inServer = g.mission.stage;
    g.mission.stage = 'exfil'; g.teleportPlayer([M.exfilX + 0.6, 0, M.exfilZ]); R.step(30); const outside = g.mission.stage; g.mission.stage = stage0;
    verdict(stage0 === 'infiltrate' && inServer === 'infiltrate' && outside === 'exfil' && !g.mission.debrief && R.heard(/reached the server room|exfiltrated/) === 0 && /structure taken/.test(g.objectiveText()),
      'the stealth mission stands still under it: Sam in the server room starts no drive objective, and past the fire exit nothing is completed', `stage ${stage0} → in the server room ${inServer} · forced to exfil and stood outside: ${outside} · debrief ${g.mission.debrief}`);
  }
  { const R = await rig(11); const { game: g, RC, NB } = R; R.step(30);
    R.drop('storage');
    if (WORDS.on) R.step(45);   // (the dialogue pass says a room clear a beat after it empties, so rooms that empty together are one line: let that beat pass before he falls)
    for (let i = 0; i < 4 && !g.player.down; i++) hitPlayer(g, [1, 0, 0]);
    R.step(2);
    verdict(g.player.down && RC.end === 'wiped' && RC.endWhy === 'player down' && R.logged('end:wiped') === 1 && up(NB.ops) === 2, '\'wiped\' fires when Sam goes down (the pair still up: the player\'s run is over)', `Sam down ${g.player.down} · end ${RC.end} (${RC.endWhy}) · pair ${up(NB.ops)}/2`);
    for (const id of ['server', 'manager', 'breakroom']) R.drop(id);
    R.step(30);
    verdict(RC.end === 'wiped' && R.logged('end:taken') === 0 && RC.rooms.every((r: any) => r.cleared) && R.heard(/to go$/) === 1 && R.heard(/press Enter to restart$/) === 1 && /(team wiped|player down) — press enter to restart/.test(g.objectiveText()),
      'and stays: the rooms emptied afterwards are counted clear but do not turn it into a win, and nothing more is called after the end', `end ${RC.end} · cleared ${R.cleared()} · room calls ${R.heard(/to go$/)} (storage, before he fell) · '${g.objectiveText()}'`);
  }
  { const R = await rig(11); const { game: g, RC, NB } = R; R.step(30);
    for (const o of NB.ops) killGuard(g, o, [1, 0, 0], false, 'shot', 'guard'); R.step(5);
    R.step(60);
    verdict(RC.end === null && RC.state === 'live' && R.logged('pair:down') === 1 && RC.team.ops === 0 && RC.team.sam && R.heard(/the rest is up to you/) === 1 && R.heard(/have to take the/) === 0, 'in play the pair down is not an end: it is logged, said once — by this scenario alone, not the night breach\'s line as well — and Sam fights on', `end ${RC.end} · team ${JSON.stringify(RC.team)} · log ${RC.log.map((l: any) => l.what).join(',')} · said: ${R.said.slice(1).join(' | ')}`);
    for (const id of ['server', 'manager', 'storage', 'breakroom']) R.drop(id);
    verdict(RC.end === 'taken' && /0 of 2 teammates/.test(RC.endWhy), 'and Sam alone can still take it', `end ${RC.end} (${RC.endWhy})`);
  }
  { // Sam and the last defender down inside one frame: that is no win
    const R = await rig(11); const { game: g, RC } = R; R.step(30);
    for (const id of ['server', 'manager', 'storage']) R.drop(id);
    for (const h of R.room('breakroom').defenders) killGuard(g, h, [1, 0, 0], false, 'shot', 'player');
    for (let i = 0; i < 4 && !g.player.down; i++) hitPlayer(g, [1, 0, 0]);
    R.step(2);
    verdict(g.player.down && RC.end === 'wiped' && R.logged('end:taken') === 0 && RC.rooms.every((r: any) => r.cleared) && /(team wiped|player down) — press enter/.test(g.objectiveText()), 'the last defender and Sam down inside one frame is \'wiped\', not a win', `end ${RC.end} (${RC.endWhy}) · cleared ${R.cleared()} · '${g.objectiveText()}'`);
  }
  { const R = await rig(11, { pairOnly: true }); const { game: g, RC, NB } = R; R.step(30);
    killGuard(g, NB.ops[0], [1, 0, 0], false, 'shot', 'guard'); R.step(5); const one = RC.end;
    killGuard(g, NB.ops[1], [1, 0, 0], false, 'shot', 'guard'); R.step(5);
    verdict(one === null && RC.end === 'wiped' && RC.endWhy === 'the pair down' && !g.player.down && /shift\+enter/.test(g.objectiveText()) && R.heard(/team wiped — the pair down\. press Shift\+Enter to restart/) === 1 && R.heard(/the rest is up to you/) === 0,
      'under the tally\'s switch (the team is the pair alone) both teammates down IS \'wiped\', with Sam standing — and the HUD names the key that works for a standing man', `after one ${one} · after both ${RC.end} (${RC.endWhy}) · '${g.objectiveText()}'`);
  }
  { // the point man dropped on the stack with his number two still up: the drill's entry is off — said once, by this scenario
    const R = await rig(11); const { game: g, RC, NB } = R; R.step(60); R.press(); R.until(() => NB.state === 'set', 30);
    killGuard(g, NB.ops[0], [1, 0, 0], false, 'shot', 'hostile'); R.until(() => NB.state === 'failed', 10); R.step(60);
    verdict(NB.state === 'failed' && RC.end === null && up(NB.ops) === 1 && R.heard(/your point man is down at the door, so you'll have to take the break room yourself/) === 1 && R.heard(/or press Shift\+Enter to restart/) === 0 && R.logged('pair:down') === 0,
      'the point man down on the stack: the entry is off, said once in this scenario\'s words; no end, his number two still up', `${NB.summary()} · ${RC.summary()} · said: ${R.said.slice(1).join(' | ')}`);
  }
  { // WHAT THE LOG CALLS IT (words.ts, on in the page; from a tape of the compound: 'guard: man down.' over a teammate, 'guard down — dead' beside 'Tango 4 down — Red
    // One's round', 'team wiped — Sam down' with three of four standing): a defender the PLAYER drops is a Tango by name, a unit's cut-off line goes under his own
    // callsign, Sam down with a man still up is 'Sam down' — and 'team wiped' once nobody is. Switch off = every one of them as it read before.
    const was = WORDS.on;
    try {
      for (const on of [true, false]) {
        const R = await rig(11); const { game: g, RC, NB } = R; WORDS.on = on; R.step(30);   // (after the stand-up: the frozen stand pins the switch off as it stands a game)
        const h = R.room('storage').defenders[0]; const n0 = R.said.length; killGuard(g, h, [1, 0, 0], false, 'shot', 'player'); const mine = R.said.slice(n0);   // (his line alone: the teammate's own way down below logs the old words too)
        const op = NB.ops[0]; op.bubble = { text: 'man down.', t: g.time, dur: 2, radio: false }; killGuard(g, op, [1, 0, 0], false, 'shot', 'hostile'); R.step(2);
        for (let i = 0; i < 4 && !g.player.down; i++) hitPlayer(g, [1, 0, 0]);
        R.step(2);
        const kill = on ? `${h.callsign} down` : 'guard down — dead', cut = `${on ? op.callsign : 'guard'}: man down.`;
        const end = on ? /^the mission is over\. press Enter to restart$/ : /^team wiped — player down\. press Enter to restart$/, obj = on ? /^player down — press enter to restart/ : /^team wiped — press enter to restart/;
        verdict(mine.includes(kill) && R.said.includes(cut) && R.heard(end) === 1 && obj.test(g.objectiveText()) && up(NB.ops) === 1 && RC.end === 'wiped' && RC.endWhy === 'player down',
          `words ${on ? 'on' : 'off'}: the player's kill, a teammate's cut-off line and Sam down with a man still up read ${on ? 'by name, and as what happened' : 'as they did'}`,
          `want '${kill}' · '${cut}' · ${end} · row ${obj} — said: ${R.said.slice(1).join(' | ')} · row '${g.objectiveText()}' · pair ${up(NB.ops)}/2`);
      }
      const R = await rig(11); const { game: g, RC, NB } = R; WORDS.on = true; R.step(30);
      for (const op of NB.ops) killGuard(g, op, [1, 0, 0], false, 'shot', 'hostile');
      R.step(5);
      for (let i = 0; i < 4 && !g.player.down; i++) hitPlayer(g, [1, 0, 0]);
      R.step(2);
      verdict(RC.end === 'wiped' && up(NB.ops) === 0 && R.heard(/^team wiped — player down\. press Enter to restart$/) === 1 && /^team wiped — press enter to restart/.test(g.objectiveText()),
        'words on, every teammate down and then Sam: that IS the team wiped, and it is called so', `end ${RC.end} (${RC.endWhy}) · pair ${up(NB.ops)}/2 · row '${g.objectiveText()}' · said: ${R.said.slice(-3).join(' | ')}`);
    } finally { WORDS.on = was; }
  }
  return done();
});

export const roomclearRestart = guarded(async () => {
  const { verdict, done } = family('roomclear-restart: a restart under it puts the structure back');
  const R = await rig(11); const { game: g, RC, NB, W } = R; const P = g.level.breach;
  SAMESTART.on = false;   // (this probe holds the re-deal on a restart — ROOMCLEAR.reroll, the deal behind 'every mission starts the same', which the shipped stand has on; the runner puts the table back)
  R.step(30); R.drop('storage'); R.drop('server');
  { const d = g.doors.byName('storage'); g.doors.kickIn(d, [32.6, 0, 10.8], g.player.char.id); R.step(40); }
  const kicked = g.doors.byName('storage'); const wasOpen = Math.abs(kicked.angle) > 0.2 && kicked.lockBroken;
  for (let i = 0; i < 4 && !g.player.down; i++) hitPlayer(g, [1, 0, 0]); R.step(2);
  const old = [...NB.ops, ...NB.hostiles]; const endWas = RC.end, clearedWas = R.cleared();
  const check = (label: string, n: number, want: any[]) => {
    const pl = g.player;
    const fresh = NB.ops.length === 2 && NB.hostiles.length === 5 && [...NB.ops, ...NB.hostiles].every((x: any) => !old.includes(x) && g.guards.includes(x) && x.state !== 'dead');
    const marks = JSON.stringify(RC.placement) === JSON.stringify(want) && NB.hostiles.every((h: any, i: number) => dist(h.char.pos, want[i].pos) < 0.4) && NB.ops.every((o: any, i: number) => dist(o.char.pos, P.from[i]) < 0.4);
    const rooms = RC.rooms.length === 4 && RC.rooms.every((r: any) => !r.cleared && r.defenders.length === r.def.garrison && r.defenders.every((h: any) => NB.hostiles.includes(h) && RC.roomAt(h.char.pos) === r.def.id));
    const doors = DOORS.every(id => { const d = g.doors.byName(id); return Math.abs(d.angle) < 0.02 && d.latched && !d.lockBroken && d.locked === R.before.doors[id]; });
    verdict(RC.active && RC.state === 'live' && RC.end === null && NB.staged === n && RC.attempt === (ROOMCLEAR.reroll ? n : 1) && fresh && marks && rooms && doors && g.guards.length === 7 && !pl.down && dist(pl.char.pos, NIGHTBREACH.samAt) < 0.4 && NB.state === 'staged',
      label, `${RC.summary()} · fresh cast ${fresh} · on the dealt marks ${marks} ('${sig(RC.placement)}') · rooms held ${rooms} · doors shut ${doors} · guards ${g.guards.length} · Sam ${pl.down ? 'DOWN' : 'up'} @${pl.char.pos.map(f2)}`);
  };
  W.input.keys.add('ShiftLeft'); W.input.pressed.add('Enter'); R.step(); W.input.keys.delete('ShiftLeft'); R.step(2);
  check(`Shift+Enter after two rooms cleared (${clearedWas}), a door kicked in (${wasOpen}) and Sam down (end '${endWas}') → the structure staged again: fresh cast, every room held, no end, doors shut, locks back — the seed's next placement`, 2, placeDefenders(0, 2));
  const differs = sig(placeDefenders(0, 2)) !== sig(placeDefenders(0, 1));
  verdict(wasOpen && endWas === 'wiped' && clearedWas === 'storage,server' && differs && R.logged('staged:0/2') === 1, 'and that was a real change: two rooms had been cleared, the door stood kicked in, the run had ended wiped, and attempt 2 is not attempt 1\'s placement', `'${sig(placeDefenders(0, 1))}' → '${sig(placeDefenders(0, 2))}'`);
  old.splice(0, old.length, ...NB.ops, ...NB.hostiles); R.drop('manager');
  g.restartEncounter(); R.step(2);
  check('a bare restartEncounter() (the down card, the menus) → staged again, attempt 3', 3, placeDefenders(0, 3));
  ROOMCLEAR.reroll = false; old.splice(0, old.length, ...NB.ops, ...NB.hostiles);
  RC.restage(); R.step(2);
  check('with re-deal off, restage() deals attempt 1 again: the authored placement', 4, placeDefenders(0, 1));
  ROOMCLEAR.reroll = true; ROOMCLEAR.seed = 9; RC.restage(); R.step(2);
  const knob = RC.seed === 9 && RC.attempt === 1 && JSON.stringify(RC.placement) === JSON.stringify(placeDefenders(9, 1)); const n0 = NB.staged;
  const again = RC.start(4); R.step(2); const byStart = again === null && RC.seed === 4 && RC.attempt === 1 && NB.staged === n0 + 1 && JSON.stringify(RC.placement) === JSON.stringify(placeDefenders(4, 1));
  RC.start(4); R.step(2); RC.restage(); R.step(2);
  { const n1 = NB.staged; ROOMCLEAR.seed = 6; RC.start(6); R.step(2);   // the slider moved first, then start(6): compared with the seed on the floor, so it stages
    verdict(NB.staged === n1 + 1 && RC.seed === 6 && RC.attempt === 1 && JSON.stringify(RC.placement) === JSON.stringify(placeDefenders(6, 1)), 'start(seed) with the knob already moved to that seed still stages it: it is the seed on the floor that counts', `stagings ${NB.staged - n1} · seed ${RC.seed}/${RC.attempt}`);
    ROOMCLEAR.seed = 4; RC.start(4); R.step(2); RC.restage(); R.step(2); }
  verdict(knob && byStart && NB.staged === n0 + 5 && RC.attempt === 2 && NB.hostiles.every((h: any, i: number) => dist(h.char.pos, placeDefenders(4, 2)[i].pos) < 0.4) && R.logged('staged:9/1') === 1 && R.logged('staged:4/1') === 2 && R.logged('staged:4/2') === 2,
    'a seed changed while it is up deals THAT seed\'s first placement (the knob, or start(seed) — which stages it again once, and not when the seed is already the one up); its next restart is attempt 2',
    `knob → ${knob} · start(4) → ${byStart} · stagings ${NB.staged - n0} · now seed ${RC.seed}/${RC.attempt} · log ${RC.log.filter((l: any) => /^staged/.test(l.what)).map((l: any) => l.what.slice(7)).join(' ')}`);
  R.step(60); R.press(); const stacking = R.until(() => NB.state === 'stacking' || NB.state === 'set', 5);
  verdict(stacking, 'and the orders work again on the fresh pair', NB.summary());
  { const S = await rig(11, {}, 7); S.step(2);
    verdict(S.why === null && ROOMCLEAR.seed === 7 && S.RC.seed === 7 && JSON.stringify(S.RC.placement) === JSON.stringify(placeDefenders(7, 1)) && S.NB.hostiles.every((h: any, i: number) => dist(h.char.pos, placeDefenders(7, 1)[i].pos) < 0.3),
      'start(7) (the page\'s ?roomclear=7) deals seed 7\'s first placement, men on those marks', `'${sig(S.RC.placement)}' · ${S.RC.summary()}`); }
  return done();
});

export const roomclearStop = guarded(async () => {
  const { verdict, done } = family('roomclear-stop: stop() puts the night back');
  const R = await rig(11); const { game: g, RC, NB, W } = R;
  R.step(60);
  R.drop('storage'); R.press(); R.step(120);
  RC.stop(); R.step(2);
  const staff = g.guards.filter((x: any) => !x.unit);
  verdict(!RC.active && RC.state === 'off' && RC.rooms.length === 0 && RC.end === null && !NB.active && NB.layout === null && g.guards.length === R.before.guards && staff.length === R.before.guards && staff.every((x: any) => x.state === 'patrol' && g.engine.lights.lights.includes(x.flashlight)),
    'the cast is gone, the scenario and its layout are off, and the shift is back on the list, on patrol, torches in the light set', `${RC.summary()} · ${NB.summary()} · layout ${NB.layout} · guards ${g.guards.map((x: any) => `${x.callsign}:${x.state}`).join(' ')}`);
  verdict(g.civilians.length === R.before.civilians && JSON.stringify(g.tune) === R.before.tune && steady(W) === R.before.steady && g.objectiveText() === R.before.objective,
    'the civilians, Game.tune, the steady light count and the mission\'s objective line are as before', `civilians ${g.civilians.length}/${R.before.civilians} · tune ${JSON.stringify(g.tune) === R.before.tune ? 'untouched' : 'CHANGED'} · steady ${steady(W)}/${R.before.steady} · '${g.objectiveText()}'`);
  const authoredDoors = g.doors.list.every((d: any) => d.locked === R.before.doors[d.def.name] && Math.abs(d.angle - d.sided(d.def.angle ?? 0)) < 0.02);
  let threw = ''; try { R.step(60 * 10); } catch (e) { threw = String(e); }
  verdict(authoredDoors && !threw && !R.bad && !g.player.down, 'the doors stand as the level has them, and the night floor runs on for ten seconds', `doors authored ${authoredDoors} · ${threw || 'no throw'}`);
  const why = NB.start(); R.step(2);
  verdict(why === null && NB.active && !RC.active && NB.hostiles.length === 3 && NB.drill.hostiles.length === 3 && g.guards.length === 5, 'the night breach started afterwards is the break room\'s three: the layout did not outlive the run', `${NB.summary()} · ${RC.summary()}`);
  NB.stop(); R.step(2);
  verdict(RC.start() === null && RC.active && NB.hostiles.length === 5, 'and the room clear starts a second time', RC.summary());
  NB.stop(); R.step(2);
  verdict(!RC.active && RC.state === 'off' && RC.rooms.length === 0 && NB.layout === null && g.guards.length === R.before.guards && g.objectiveText() === R.before.objective && R.heard(/^room clear off — /) === 2,
    'the night breach\'s own stop under it ends this scenario too (and says which one went off)', `${RC.summary()} · guards ${g.guards.length} · said: ${R.said.filter((t: string) => / off — /.test(t)).join(' | ')}`);
  { const snap = W.snapshot('probe', true);
    RC.start(); const whyUp = canLoad(g, snap); RC.stop(); const whyOff = canLoad(g, snap);
    verdict(!!whyUp && /night breach/.test(whyUp) && whyOff === null, 'a checkpoint of the night floor is refused while it is up (it is the night breach: that gate holds here) and loads again after stop()', `up: ${whyUp} · stopped: ${whyOff ?? 'allowed'}`); }
  { const M = g.level.mission; const door = g.doors.byName(M.entryDoor)?.frameCentre, pos0 = g.objectivePos();
    g.teleportPlayer([(M.serverRoom.x0 + M.serverRoom.x1) / 2, 0, (M.serverRoom.z0 + M.serverRoom.z1) / 2]); R.step(3);
    verdict(!!door && !!pos0 && dist(pos0, door) < 0.01 && g.mission.stage === 'drive', 'and off, the stealth mission is its own again: the marker on the server door, and Sam in the server room is given the drive', `marker ${pos0?.map(f2)} · stage ${g.mission.stage}`); }
  return done();
});
