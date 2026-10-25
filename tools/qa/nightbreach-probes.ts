// The 'nightbreach' family (game/nightbreach.ts — the night TEAM breach playtest behind ?nightbreach / --nightbreach), run through probes.ts:
//   bun run tools/qa/probes.ts nightbreach | nightbreach-off | nightbreach-stage | nightbreach-orders | nightbreach-fight | nightbreach-contested | nightbreach-restart | nightbreach-stop   [--verbose]
// PASS / FAIL each, all headless (the Game of headless.ts; the scenario started with game.nightBreach.start() exactly as main.ts's flag starts it, Sam's orders given
// as one-frame F presses through the harness Input). The harness has no light meter: Sam's visibility is planted dark (he stands in the unlit aisle) and the AI men
// judge each other by guards.ts's direct-light estimate, so what the defenders SEE in this room at night is the harness's reading, not the page's.
// NOT held here (by reading and by the gate, not by these probes): that the flag-off game equals main — nightbreach-off only shows the scenario inert and F a dead
// key; the comparison with main is the identity families run on both trees (breach / director / day / night / teams / tactics / civilians / qrf / checkpoints /
// journal). Nor the response team's and the devices' gates on nightBreach.active (with the shift benched nobody is left to call either in).
//   nightbreach-off      the flag off: nothing of it runs — inactive, no drill, no unit, the shift and the civilians as ever, and an F press changes nothing (ten
//                        seeded seconds digest the same with and without it)
//   nightbreach-stage    start(): the shift benched, nobody else on the floor, two operatives on the approach marks, three hostiles held + pinned on theirs with
//                        their guns on the door, both doors shut, Sam beside the pair with the rifle up, the budgets (≤ 8 characters, ≤ MAX_LIGHTS steady lights)
//                        held, the response team idle; and with no order given nobody moves and nobody fires
//   nightbreach-orders   order one stacks and HOLDS (no kick while only one order stands); order two runs kick → door → charge → bang → enter in order; with the
//                        stun and blind fire OFF (the walkover setting) the room clears with the team whole, the defenders dazzled and silent, real rounds
//                        fired by the team, Sam untouched
//   nightbreach-fight    the stun off (boot and go), three seeds: the defenders return fire, a teammate is hit, and a man down never strands the drill — it runs on
//                        to 'clear' (the survivor's) or to both men down, never an abort once the door is in
//   nightbreach-contested  the DEFAULT (stun on, dazzled defenders fire blind): the tally over fifteen seeds with Sam idle at the page's chaos 0.5 — the defenders
//                        fire in ≥ 12 runs, the team takes the room in 6‥11, the losses are not one number — and the rule itself: no round before the flash, at
//                        most BLIND.rounds a man a charge, every blind round down the door he was covering (in three dimensions), a blind round's report
//                        moves no colleague's fix onto Sam, none from the man Sam's rifle has pinned (real rounds past him), none from a man in Sam's arm;
//                        a real charge on men who heard the boot = one burst each, a flinch late and staggered; a second charge a second burst; a restage
//                        mid-burst silences it; Sam dark in the aisle never hit; and the walkover setting (blind fire off) over three seeds: no round
//   nightbreach-restart  a restart under it (Shift+Enter mid-entry, then a bare restartEncounter) stages it again on the next frame: a fresh cast on the marks, the
//                        door shut, orders back to none, Sam back beside the pair with the rifle up — and the orders work again
//   nightbreach-drilled  hard's drilled defenders (roomfight.ts DRILLED): blind as long, doubled over half as long, more of the burst fired, said once; row off = standard
//   nightbreach-stop     stop(): the cast gone, the shift's three men back on the list on their routes with their torches in the light set, the civilians back,
//                        Game.tune untouched, the room's lights and the steady light count as before, and the floor runs on
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH, BLIND } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { NVG } = await import(`${ROOT}/src/game/nvg.ts`);
const { SUPPRESSION } = await import(`${ROOT}/src/game/suppression.ts`);
const { FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);
const { fireWeapon, detonateStun, FLASH } = await import(`${ROOT}/src/game/combat.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { canSave, canLoad } = await import(`${ROOT}/src/game/savestate.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DEFAULTS = { ...NIGHTBREACH };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const steady = (W: any) => W.engine.lights.lights.filter((l: any) => l.ttl < 0 && !l.transient).length;   // (not the storm's stroke: a flagged transient with no ttl — lights.ts — alive for a moment whenever the count happens to fall on a flash)

/** One staged scenario under a seed, with a step() that keeps Sam dark (no meter headless), counts rounds by side off the 'guardShot' events, and notes a hit on Sam.
 *  A hostile's round fired while he is dazzled is a BLIND round (the fight AI cannot fire dazzled — aim.ts): counted per man, with how far off the door point he
 *  was told to cover it left the muzzle. `chaos` = Game.tune.chaos for the run (the harness stands the game up at 0; the page plays at 0.5). */
async function rig(seed: number, knobs: Record<string, unknown> = {}, start = true, chaos = 0) {
  Object.assign(NIGHTBREACH, DEFAULTS, knobs);
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game; const NB = game.nightBreach;
  const lit = () => game.targets.filter((t: any) => t.group === 'breakroom').map((t: any) => `${t.name ?? '?'}:${t.on ? 1 : 0}`).join(' ');
  game.tune.chaos = chaos;   // (BEFORE `before` is taken: the shipped stand stands the game up at chaos 0.5, and this write of the rig's own read as the staging's — 'tune CHANGED' on -stage and -stop)
  const before = { guards: game.guards.length, civilians: game.civilians.length, steady: steady(W), room: lit(), tune: JSON.stringify(game.tune) };
  const why = start ? NB.start() : null;
  const R = { W, game, NB, why, before, lit, vis: 0.05, shots: {} as Record<string, number>, samHit: false, bad: '', dazzle: [] as number[],
    blind: [0, 0, 0], sighted: 0, offDoor: 0, firstBlind: [NaN, NaN, NaN], supMax: [0, 0, 0], leak: Infinity,
    /** Sam's covering fire: while set, a rifle round every 0.1 s (up to `left`) from where he stands at this point — real rounds through fireWeapon */
    cover: null as null | { at: number[]; left: number; next: number },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        const C = R.cover; if (C && C.left > 0 && game.time >= C.next) { fireWeapon(game, game.player.char, C.at, true, {}); C.left--; C.next = game.time + 0.1; }
        game.player.visibility = R.vis; W.step(DT);
        NB.hostiles.forEach((h: any, k: number) => { R.supMax[k] = Math.max(R.supMax[k], h.sup.v);
          if (h.state !== 'dead' && h.lastKnown) R.leak = Math.min(R.leak, Math.hypot(h.lastKnown[0] - game.player.char.pos[0], h.lastKnown[2] - game.player.char.pos[2])); });
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e);
          if (e.kind === 'guardShot') { const w = game.guards.find((x: any) => x.char.id === e.who); const k = w ? w.team : '?'; R.shots[k] = (R.shots[k] ?? 0) + 1;
            const hi = NB.hostiles.indexOf(w);
            if (hi >= 0 && e.time < w.dazzledUntil) { R.blind[hi]++; if (isNaN(R.firstBlind[hi])) R.firstBlind[hi] = e.time;
              const A = game.level.breach.hostiles[hi].aimAt; const a = [A[0] - e.from[0], A[1] - e.from[1], A[2] - e.from[2]], b = [e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]];   // the round's flight against the line to the door point he covers, in three dimensions
              const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]) || 1); R.offDoor = Math.max(R.offDoor, Math.acos(Math.max(-1, Math.min(1, cos))) * 57.3); }
            else if (hi >= 0) R.sighted++; }
          if (e.kind === 'bang') R.dazzle = NB.hostiles.map((h: any) => Math.max(0, h.dazzledUntil - game.time)); }
        if (game.player.down || game.player.hitFlash > 0) R.samHit = true;
        for (const x of game.guards) if (!R.bad && !x.char.pos.every(Number.isFinite)) R.bad = `${x.callsign} at ${x.char.pos}`;
      }
    },
    press(code = 'KeyF') { W.input.pressed.add(code); R.step(); },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    beat(what: string): number { const b = NB.drill?.beats.find((x: any) => x.what === what); return b ? b.t : NaN; },
  };
  const seen = new Set<any>();
  return R;
}
const up = (l: any[]) => l.filter(x => x.state !== 'dead').length;
const itemsOf = (g: any): any[] => g.items.items ?? g.items.list ?? [];
/** every probe leaves the knob table as it found it, pass, fail or throw (the runner's snapshot does not know this table) */
const BANG_BREAK = FIGHT_SKILL.hostile.bangBreak;
const FLASH_ON = FLASH.on;
const NVG_ON = NVG.on;
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(NIGHTBREACH, DEFAULTS); FIGHT_SKILL.hostile.bangBreak = BANG_BREAK; FLASH.on = FLASH_ON; NVG.on = NVG_ON; } };
/** THE CANISTER AS IT WAS (combat.ts FLASH.on false: the dazzle alone, nobody folded). The blind burst's own rules — who owes one, when, how many, what silences
 *  it — are measured with it: a man doubled over by the flash (the canister's rule since 10-05) loses the turns those rules are about. */
const canAsItWas = () => { FLASH.on = false; };
/** The burst's MECHANICS (one burst a dazzle, its clock, its count, who loses his turns) are checked with every dazzled man firing: roomfight.ts now rolls
 *  FIGHT_SKILL.hostile.bangBreak per dazzle for a man who ducks instead (the untrained side breaking under a bang), which would make 'twelve each' a dice
 *  roll. The tallies above these checks keep the roll. `guarded` puts the number back. */
const everyManFires = () => { FIGHT_SKILL.hostile.bangBreak = 0; };
/** living defenders still INSIDE the break room: with roomfight.ts a beaten man may leave by another door, and the drill calls the room taken once nobody
 *  hostile is left in it — so 'clear' is judged on the room, not on the cast */
const inRoom = (NB: any, g: any) => { const B = g.level.breach.bounds; return NB.hostiles.filter((h: any) => h.state !== 'dead' && h.char.pos[0] > B.x0 && h.char.pos[0] < B.x1 && h.char.pos[2] > B.z0 && h.char.pos[2] < B.z1).length; };

export const nightbreachOff = guarded(async () => {
  const { verdict, done } = family('nightbreach-off: with the flag off nothing of it runs');
  const run = async (pressF: boolean) => { const R = await rig(5, {}, false); Math.random = seeded(77); for (let i = 0; i < 600; i++) { if (pressF && i === 120) R.W.input.pressed.add('KeyF'); R.step(); } return R; };
  const A = await run(false), B = await run(true);
  const g = B.game, NB = B.NB;
  verdict(!NB.active && NB.drill === null && NB.state === 'off' && NB.log.length === 0 && NB.ops.length === 0 && NB.hostiles.length === 0, 'inert: inactive, no drill, no cast, an empty log after ten seconds and an F press',
    `active ${NB.active} · state ${NB.state} · drill ${NB.drill} · log ${NB.log.length} · ${NB.summary()}`);
  verdict(g.guards.length === B.before.guards && !g.guards.some((x: any) => x.unit) && g.civilians.length === B.before.civilians && NB.order() === null, 'the floor is the night game\'s: the shift, the civilians, no unit; order() does nothing',
    `guards ${g.guards.length} (${g.guards.map((x: any) => x.callsign).join(', ')}) · units ${g.guards.filter((x: any) => x.unit).length} · civilians ${g.civilians.length}`);
  const da = JSON.stringify(digestGame(A.game, true)), db = JSON.stringify(digestGame(B.game, true));
  verdict(da === db, 'ten seeded seconds digest the same with and without the F press', `digest ${da.length} chars · ${da === db ? 'equal' : 'DIFFERENT'}`);
  return done();
});

export const nightbreachStage = guarded(async () => {
  const { verdict, done } = family('nightbreach-stage: start() stages the room, the team and the defenders inside the budgets');
  const R = await rig(11); const { game: g, NB, W } = R; const P = g.level.breach;
  verdict(R.why === null && NB.active && NB.state === 'staged' && NB.staged === 1, 'start() is accepted and the scenario stands staged', `refusal ${R.why} · ${NB.summary()}`);
  const staff = g.guards.filter((x: any) => !x.unit);
  verdict(staff.length === 0 && g.civilians.length === 0 && g.qrf.state === 'idle' && JSON.stringify(g.tune) === R.before.tune, 'nobody else on the floor: the shift benched, no civilians, the response team idle — and no Game.tune switch written',
    `staff on the list ${staff.length} (was ${R.before.guards}) · civilians ${g.civilians.length} (was ${R.before.civilians}) · qrf ${g.qrf.state} · tune ${JSON.stringify(g.tune) === R.before.tune ? 'untouched' : 'CHANGED'}`);
  verdict(R.lit() === R.before.room && /:1/.test(R.lit()), 'the room is lit as the night has it (its vending machines on, its tubes off) with the room-lights knob off', `breakroom group: ${R.lit()} (authored: ${R.before.room})`);
  const opsOk = NB.ops.length === 2 && NB.ops.every((o: any, i: number) => o.team === 'operative' && o.unit && dist(o.char.pos, P.from[i]) < 0.3);
  const hosOk = NB.hostiles.length === 3 && NB.hostiles.every((h: any, i: number) => h.team === 'hostile' && h.unit && h.hold && h.pinned && !h.script && dist(h.char.pos, P.hostiles[i].pos) < 0.3);
  verdict(opsOk && hosOk, 'the cast: two operatives on the approach marks, three hostiles held and pinned on theirs, left to the fight AI (no script)',
    `ops ${NB.ops.map((o: any) => `${o.callsign}/${o.team}@${o.char.pos.map(f2)}`).join(' ')} · hostiles ${NB.hostiles.map((h: any) => `${h.callsign}/${h.team} hold ${h.hold} pinned ${h.pinned} script ${!!h.script}`).join(' ')}`);
  const pl = g.player; const door = g.doors.byName(P.door), next = P.next ? g.doors.byName(P.next.door) : null;
  verdict(dist(pl.char.pos, NIGHTBREACH.samAt) < 0.3 && pl.slot === 'rifle' && !pl.holstered && !pl.down && !g.col.nav.isBlocked(pl.char.pos[0], pl.char.pos[2]), 'Sam beside the pair on open floor, the rifle in his hands',
    `Sam @${pl.char.pos.map(f2)} · slot ${pl.slot} holstered ${pl.holstered} · ${f2(dist(pl.char.pos, NB.ops[0].char.pos))} m from Blue One`);
  verdict(Math.abs(door.angle) < 0.02 && (!next || Math.abs(next.angle) < 0.02), 'the breach door and the room\'s other door are shut', `${P.door} ${f2(door.angle)} · ${P.next?.door} ${next ? f2(next.angle) : '—'}`);
  W.engine.lights.upload(g.time);
  verdict(1 + g.guards.length <= 8 && steady(W) <= MAX_LIGHTS, 'budgets: characters ≤ 8, steady lights ≤ MAX_LIGHTS', `characters ${1 + g.guards.length} · steady lights ${steady(W)} of ${MAX_LIGHTS} (night floor before: ${R.before.steady})`);
  verdict(canSave(g, false) !== null, 'checkpoints refuse while it stands', `save: ${canSave(g, false)}`);
  const at0 = [...NB.ops, ...NB.hostiles].map((x: any) => [...x.char.pos]);
  R.step(60 * 5);
  const moved = [...NB.ops, ...NB.hostiles].map((x: any, i: number) => dist(x.char.pos, at0[i]));
  const aim = NB.hostiles.map((h: any, i: number) => { const m = P.hostiles[i]; const want = Math.atan2(m.aimAt[0] - h.char.pos[0], m.aimAt[2] - h.char.pos[2]); const d = h.char.aimYaw - want; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 57.3; });
  const fired = Object.values(R.shots).reduce((a, b) => a + b, 0);
  verdict(NB.state === 'staged' && Math.max(...moved) < 0.3 && fired === 0 && up(NB.ops) === 2 && up(NB.hostiles) === 3 && !R.samHit && !R.bad, 'five seconds with no order: nobody moves, nobody fires, the pair waits',
    `state ${NB.state} · furthest moved ${f2(Math.max(...moved))} m · rounds ${fired} · Sam hit ${R.samHit}${R.bad ? ' · NaN ' + R.bad : ''}`);
  verdict(Math.max(...aim) < 20 && NB.hostiles.every((h: any) => h.drawn !== false), 'the defenders\' guns are on the door while they are calm', `aim off the plan's door point: ${aim.map((a: number) => a.toFixed(0) + '°').join(' ')}`);
  { // Sam close behind a teammate: his own side offers no grab row and no takedown click, and he does not creep round him
    const b = NB.ops[1], f = b.char.forward(); g.teleportPlayer([b.char.pos[0] - f[0] * 0.8, 0, b.char.pos[2] - f[2] * 0.8]); R.step(3);
    const rows = [...g.nearby, ...(g.interactables ?? [])].filter((it: any) => it.kind === 'guard');
    verdict(rows.length === 0 && g.threatProximity === 0, 'a teammate is nobody Sam grabs: no guard row 0.8 m behind Blue Two, no creeping round him', `guard rows ${rows.length} · threat proximity ${f2(g.threatProximity)}`); }
  NB.stop();
  { // a checkpoint of the night floor is refused while the scenario stands, and loads again once it is stopped
    const snap = W.snapshot('probe', true);
    NB.start(); const whyUp = canLoad(g, snap); NB.stop(); const whyOff = canLoad(g, snap);
    verdict(!!whyUp && /night breach/.test(whyUp) && whyOff === null, 'a checkpoint load is refused while it stands (the benched shift is no roster to pour one over), and allowed again after stop()', `up: ${whyUp} · stopped: ${whyOff ?? 'allowed'}`); }
  { // a staging that throws (here: three more defenders than the character budget holds) ends the scenario cleanly
    const P2 = g.level.breach; const keep = P2.hostiles; P2.hostiles = [...keep, ...keep]; const err = console.error; console.error = () => { };
    let why: string | null = null, threw = '';
    try { why = NB.start(); R.step(30); } catch (e) { threw = String(e); } finally { P2.hostiles = keep; console.error = err; }
    verdict(!threw && !!why && !NB.active && g.guards.length === R.before.guards && !g.guards.some((x: any) => x.unit) && g.civilians.length === R.before.civilians,
      'a staging that fails is refused with its reason and everything is put back (no half-up scenario throwing every frame)', `${threw || 'no throw'} · reason: ${why} · active ${NB.active} · guards ${g.guards.map((x: any) => x.callsign).join(', ')} · civilians ${g.civilians.length}`); }
  return done();
});

export const nightbreachOrders = guarded(async () => {
  const { verdict, done } = family('nightbreach-orders: order one stacks and holds, order two runs kick, bang, enter; with the stun and no blind fire the room clears');
  const R = await rig(11, { blindFire: false }); const { NB } = R;
  R.step(60);
  R.press();
  const set = R.until(() => NB.state === 'set', 30);
  verdict(NB.log.some((l: any) => l.what === 'order:stack') && set && !isNaN(R.beat('stacked')), 'order one: the pair runs in and stacks on the door', `state ${NB.state} · stacked @${f2(R.beat('stacked'))} s of drill clock · ${NB.summary()}`);
  R.step(60 * 6);
  verdict(NB.state === 'set' && isNaN(R.beat('kick')) && isNaN(R.beat('squeeze')) && up(NB.hostiles) === 3, 'the stack HOLDS on one order: six seconds on, no squeeze, no kick, nobody hurt', `state ${NB.state} · kick ${f2(R.beat('kick'))} · defenders up ${up(NB.hostiles)}`);
  R.press();
  const ended = R.until(() => NB.drill.phase === 'done', 45);
  R.step(60);
  const order = ['squeeze', 'kick', 'door-flung', 'toss', 'bang', 'enter1', 'enter2', 'clear', 'done']; const ts = order.map(w => R.beat(w));
  const inOrder = ts.every((t, i) => !isNaN(t) && (i === 0 || t >= ts[i - 1]));
  verdict(ended && inOrder, 'order two: squeeze → kick → door → charge → bang → enter1 → enter2 → clear, in that order', order.map((w, i) => `${w}@${f2(ts[i])}`).join(' '));
  verdict(NB.state === 'clear' && up(NB.ops) === 2 && up(NB.hostiles) === 0, 'the walkover setting (stun on, blind fire off): the room clears and the team is whole', NB.summary());
  verdict(R.dazzle.length === 3 && R.dazzle.every(d => d > 1) && (R.shots.operative ?? 0) >= 3 && !(R.shots.hostile ?? 0) && NB.blindRounds === 0 && !R.samHit && !R.bad, 'the charge dazzled every defender and none of them fired, the team\'s rounds were real, Sam was not hit',
    `dazzle ${R.dazzle.map(f2).join('/')} s · rounds ${JSON.stringify(R.shots)} (drill ${NB.drill.rounds.join('+')}) · Sam hit ${R.samHit}${R.bad ? ' · NaN ' + R.bad : ''}`);
  if (VERBOSE) console.log('    beats ' + NB.drill.beats.map((b: any) => `${b.what}@${f2(b.t)}`).join(' '));
  NB.stop();
  return done();
});

export const nightbreachFight = guarded(async () => {
  const { verdict, done } = family('nightbreach-fight: without the stun the defenders shoot back, a teammate is hit, and a man down never strands the drill');
  const rows: string[] = []; let hostileRounds = 0, opsLost = 0, stranded = 0, aborted = 0, samHit = 0, bad = '';
  for (const seed of [11, 12, 13]) {
    const R = await rig(seed, { stun: false }); const { NB } = R;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.step(120); R.press();
    const ended = R.until(() => NB.drill.phase === 'done', 45); R.step(60);
    const lost = 2 - up(NB.ops); opsLost += lost; hostileRounds += R.shots.hostile ?? 0; if (R.samHit) samHit++; if (R.bad) bad = R.bad;
    const beats = NB.drill.beats.map((b: any) => b.what);
    if (!ended) stranded++;
    if (beats.includes('abort')) aborted++;   // (an abort is only legal before the door is in; the boot always lands here)
    if (lost === 1 && NB.state !== 'clear') stranded++;   // one man left standing must have finished the room
    if (lost === 2 && !beats.includes('wiped')) stranded++;
    rows.push(`seed ${seed}: ${NB.state} · team ${up(NB.ops)}/2 · defenders ${up(NB.hostiles)}/3 · rounds ${JSON.stringify(R.shots)} · ${beats.filter((b: string) => /opdown|nobang|clear|wiped|abort/.test(b)).join(' ')}`);
    NB.stop();
  }
  verdict(hostileRounds > 0, 'the defenders return fire', `${hostileRounds} rounds from the hostiles over three seeds\n    ${rows.join('\n    ')}`);
  verdict(opsLost > 0, 'a teammate is hit', `${opsLost} operatives down over three seeds`);
  verdict(stranded === 0 && aborted === 0 && !bad, 'a man down never strands the drill: every run ends, on \'clear\' with a survivor or on both men down — no abort once the door is in', `stranded ${stranded} · aborts ${aborted}${bad ? ' · NaN ' + bad : ''}`);
  verdict(samHit === 0, 'Sam, dark in the aisle and out of the door\'s line, is not hit', `runs with Sam hit: ${samHit}`);
  { // the stun ON, but #2 dead on the stack before the word: no corpse chops or throws — #1 boots and goes without it
    const R = await rig(11); const { NB, game: g } = R;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30);
    killGuard(g, NB.ops[1], [1, 0, 0], false, 'shot', 'guard', 'operative down'); R.step(30); R.press();
    const ended = R.until(() => NB.drill.phase === 'done', 45); const beats: string[] = NB.drill.beats.map((b: any) => b.what);
    verdict(ended && beats.includes('opdown:2') && beats.includes('nobang') && !beats.includes('toss') && !beats.includes('bang') && beats.includes('enter1') && !g.items.items?.some((it: any) => it.kind === 'flash' && it.fuse > 50),
      '#2 dead on the stack: nobody throws his charge — the point man boots and goes without it', `${NB.summary()} · ${beats.filter(b => /opdown|toss|bang|enter|clear|wiped|abort/.test(b)).join(' ')}`);
    NB.stop(); }
  { // the point man dead on the stack before the word: nobody is left to boot the door — 'abort', and #2 is handed to the fight AI where he stands, not left a statue
    const R = await rig(11); const { NB, game: g } = R;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30);
    killGuard(g, NB.ops[0], [1, 0, 0], false, 'shot', 'guard', 'operative down'); R.step(30);
    const b = NB.ops[1]; const beats: string[] = NB.drill.beats.map((x: any) => x.what);
    verdict(NB.state === 'failed' && beats.includes('abort') && !beats.includes('kick') && b.state !== 'dead' && !b.script && b.hold && b.pinned, '#1 dead on the stack: the breach is off (abort) and the survivor is the fight AI\'s, holding where he stands',
      `${NB.summary()} · ${beats.filter(x => /opdown|abort|kick/.test(x)).join(' ')} · Blue Two ${b.state} script ${!!b.script} hold ${b.hold} pinned ${b.pinned}`);
    NB.stop(); }
  { // Sam LIT and standing in the door's line with no stun: the defenders take him too (he is no spectator behind glass)
    let downs = 0; const rows: string[] = [];
    for (const seed of [11, 12]) {
      const R = await rig(seed, { stun: false }); const { NB, game: g } = R;
      R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.vis = 1; g.teleportPlayer([25.6, 0, 17.7]); R.step(30); R.press();
      R.until(() => NB.drill.phase === 'done' || g.player.down, 45); R.step(120);
      if (g.player.down) downs++; rows.push(`seed ${seed}: Sam ${g.player.down ? 'DOWN' : 'up'} · ${NB.summary()} · rounds ${JSON.stringify(R.shots)}`); NB.stop();
    }
    verdict(downs > 0, 'a lit Sam in the door\'s line is shot by the defenders', rows.join('\n    ')); }
  Object.assign(NIGHTBREACH, DEFAULTS);
  return done();
});

export const nightbreachContested = guarded(async () => {
  const { verdict, done } = family('nightbreach-contested: behind the bang the room is the team\'s to take — it was a fight that went either way, and is again with the canister as it was');
  const SEEDS = Array.from({ length: 15 }, (_, i) => 11 + i);
  // The tally compares the stun charge against the canister it replaced, on margins of one room in fifteen: it is measured with BARE EYES, as it was tuned.
  // With the team's goggles on (nvg.ts) the same fifteen go 14 rooms / 4 men lost against the canister's 14 / 10 — the charge still far cheaper in men, the
  // 'more rooms' margin a tie — which is a seed's worth of difference in a fight the goggles are not the subject of (guarded() puts the switch back).
  NVG.on = false;
  /** one whole run with Sam idle in the aisle: a second in, 'stack up', set, two seconds, 'go', to the end (or 45 s) */
  const play = async (seed: number, knobs: Record<string, unknown>, chaos: number) => {
    const R = await rig(seed, knobs, true, chaos); const { NB } = R;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.step(120); R.press();
    let early = 0; const ended = R.until(() => { if (isNaN(R.beat('bang'))) early = R.shots.hostile ?? 0; return NB.drill.phase === 'done'; }, 45); R.step(60);
    const out = { R, ended, early, state: NB.state as string, lost: 2 - up(NB.ops), defUp: up(NB.hostiles), defIn: inRoom(NB, R.game), hostile: R.shots.hostile ?? 0, blind: [...R.blind], sighted: R.sighted, offDoor: R.offDoor, samHit: R.samHit, bad: R.bad, counted: NB.blindRounds as number };
    NB.stop(); return out;
  };
  // ---- the canister as it was, first: the same fifteen runs with nobody folded by the flash — the fight the breach used to be (how many fire, how many rooms)
  let firedWas = 0, clearedWas = 0, lostWas = 0;
  { canAsItWas(); for (const seed of SEEDS) { const o = await play(seed, {}, 0.5); if (o.hostile > 0) firedWas++; if (o.state === 'clear') clearedWas++; lostWas += o.lost; } FLASH.on = FLASH_ON; }
  // ---- the tally: the default knobs, the page's chaos, fifteen seeds
  const rows: string[] = []; let fired = 0, cleared = 0, wiped = 0, samHit = 0, stranded = 0, early = 0, over = 0, miscount = 0, off = 0, bad = ''; const losses: number[] = [];
  for (const seed of SEEDS) {
    const o = await play(seed, {}, 0.5);
    if (o.hostile > 0) fired++; if (o.state === 'clear') cleared++; if (o.lost === 2) wiped++; if (o.samHit) samHit++; if (o.bad) bad = o.bad; losses.push(o.lost);
    if (!o.ended || (o.state !== 'clear' && o.state !== 'failed') || (o.state === 'clear' && (o.lost === 2 || o.defIn > 0)) || (o.state === 'failed' && o.lost < 2)) stranded++;
    early += o.early; if (o.blind.some(n => n > BLIND.rounds)) over++; if (o.blind.reduce((a, b) => a + b, 0) !== o.counted) miscount++; off = Math.max(off, o.offDoor);
    rows.push(`seed ${seed}: ${o.state} · team ${2 - o.lost}/2 · defenders ${o.defUp}/3 up, ${o.defIn} in the room · their rounds ${o.hostile} (blind ${o.blind.join('+')}, sighted ${o.sighted})`);
  }
  const kinds = new Set(losses).size;
  const lostNow = losses.reduce((a, b) => a + b, 0);
  verdict(firedWas >= 12 && fired < firedWas, 'the flash folds the room: the defenders get rounds off in fewer runs than with the canister as it was (which had them firing in most, ≥ 12 of 15)', `defenders fired in ${fired} of ${SEEDS.length} · as it was ${firedWas}\n    ${rows.join('\n    ')}`);
  verdict(cleared >= 11 && cleared > clearedWas && lostNow < lostWas, 'the team takes the room in most runs (≥ 11 of 15), more often and for fewer men than with the canister as it was', `room taken ${cleared} · team wiped ${wiped} of ${SEEDS.length} · men lost ${lostNow} of ${2 * SEEDS.length} — as it was: taken ${clearedWas}, lost ${lostWas}`);
  verdict(kinds >= 2 && wiped < SEEDS.length, 'it is not free: the losses still vary by seed', `men lost per seed ${losses.join('')} · unhurt ${losses.filter(l => l === 0).length} · one down ${losses.filter(l => l === 1).length} · both ${wiped}`);
  verdict(stranded === 0 && !bad, 'every run ends on the room taken (a man up, nobody inside) or on both men down', `stranded ${stranded}${bad ? ' · NaN ' + bad : ''}`);
  verdict(samHit === 0, 'Sam, dark in the aisle and out of the door\'s line, is never hit by it', `runs with Sam hit: ${samHit}`);
  verdict(early === 0 && over === 0 && miscount === 0, 'the rule: no round from inside before the flash, at most BLIND.rounds blind from a man, and the scenario\'s own count agrees', `rounds before the bang ${early} · runs with a man over ${BLIND.rounds} blind: ${over} · runs where blindRounds disagrees: ${miscount}`);
  verdict(off > 0 && off < 30, 'every blind round leaves down the door he was covering (inside 30° of the door point in three dimensions, the cone included)', `furthest off the door point: ${off.toFixed(0)}°`);
  { // SAM'S COVERING FIRE, real rounds: from the door's own line, thirty rifle rounds 0.8 m past the man facing the door from the moment the leaf flies open —
    // that man's head goes down (the game's own suppression: over the pinned line, crouched, gun lowered — the rule's suppression test and its gun-down test both
    // say no, and this check does not tell them apart) and his turns are lost; the two off the door's line are out of the rifle's reach and still fire
    everyManFires(); canAsItWas();   // (from here to the end of this family: the blind burst's own rules, with the canister that does not fold the men who owe one)
    const R = await rig(11, {}, true, 0.5); const { NB, game: g } = R;
    R.step(60); R.press(); R.until(() => NB.state === 'set', 30); g.teleportPlayer([24.5, 0, 17.75]); R.step(120); R.press();
    R.until(() => !isNaN(R.beat('door-flung')), 20); const T = NB.hostiles[0].char.pos; R.cover = { at: [T[0], 1.2, T[2] + 0.8], left: 30, next: 0 };
    R.until(() => NB.drill.phase === 'done', 45); R.step(60);
    verdict(R.supMax[0] >= SUPPRESSION.pinned && R.blind[0] === 0 && R.blind[1] === BLIND.rounds && R.blind[2] === BLIND.rounds && R.supMax[1] < SUPPRESSION.flinch && R.supMax[2] < SUPPRESSION.flinch && !R.bad,
      'the man Sam\'s rifle pins fires no blind round; the two it cannot reach fire theirs', `suppression peak ${R.supMax.map(f2).join(' / ')} (pinned at ${SUPPRESSION.pinned}) · blind rounds ${R.blind.join('+')} · ${NB.summary()}`);
    NB.stop(); }
  { // A REAL CHARGE on men who have heard the boot (the kick's own event, no team through the door): one burst each, a flinch late and staggered man by man; a
    // second charge on men still dazzled is a second burst; a restage in the middle of a burst silences it
    everyManFires();
    const R = await rig(11, {}, true, 0.5); const { NB, game: g } = R; const P = g.level.breach; R.step(60);
    const bang = () => { const it = g.items.spawn('flash', [P.toss.land[0], 0.25, P.toss.land[2]], [0, 0, 0], { fuse: 9, heading: 0 }); it.fired = true; detonateStun(g, it); return g.time; };
    g.events.push({ kind: 'kick', pos: [28, 0, 17.6], time: g.time, loud: true, level: 1.0, who: NB.ops[0].char.id }); R.step(90);
    const alert = NB.hostiles.every((h: any) => h.state === 'alert');
    const t0 = bang(); R.step(60 * 2.2); const one = [...R.blind], first = R.firstBlind.map((t: number) => t - t0);
    const order = first[0] >= BLIND.after - 0.02 && first[1] > first[0] && first[2] > first[1] && first[2] < BLIND.after + 2 * BLIND.stagger + 0.1;
    const stillDazzled = NB.hostiles.filter((h: any) => g.time < h.dazzledUntil).length;
    bang(); R.step(60 * 2.2); const two = R.blind.map((n: number, k: number) => n - one[k]);
    verdict(alert && one.every(n => n === BLIND.rounds) && order && stillDazzled >= 2 && two.every(n => n === BLIND.rounds) && R.sighted === 0 && NB.state === 'staged',
      'a real charge on men who heard the boot: one burst each, a flinch after the flash and one after another; a second charge, a second burst', `alert ${alert} · first charge ${one.join('+')} · first rounds ${first.map(f2).join(' / ')} s after the flash (after ${BLIND.after}, stagger ${BLIND.stagger}) · still dazzled at the second ${stillDazzled}/3 · second charge ${two.join('+')}`);
    bang(); R.until(() => NB.blindRounds >= BLIND.rounds * 6 + 6, 3); const mid = NB.blindRounds - BLIND.rounds * 6; const before = R.shots.hostile ?? 0;
    NB.restage(); R.step(60 * 3);
    verdict(mid >= 6 && mid < BLIND.rounds * 3 && NB.blindRounds === 0 && (R.shots.hostile ?? 0) === before && NB.state === 'staged', 'a restage in the middle of a burst silences it and zeroes the count', `rounds into the third burst at the restage ${mid} · after it: blindRounds ${NB.blindRounds}, rounds fired since ${(R.shots.hostile ?? 0) - before} · ${NB.state}`);
    NB.stop(); }
  { // A BLIND ROUND TELLS NOBODY WHERE SAM IS. One man dazzled alone (planted: no charge blinds one of three), his colleagues with their eyes and ears: a
    // colleague's sighted round says where the enemy is (guards.ts hearingCheck), a blind one only where it went — their fix goes to the door, not to Sam
    everyManFires();
    const R = await rig(11, {}, true, 0.5); const { NB, game: g } = R; R.step(60);
    g.events.push({ kind: 'kick', pos: [28, 0, 17.6], time: g.time, loud: true, level: 1.0, who: NB.ops[0].char.id }); R.step(90);
    g.teleportPlayer([31.8, 0, 9.3]); R.step(30); R.leak = Infinity;   // Sam unseen behind the room's south wall, eight metres from the men
    NB.hostiles[0].dazzledUntil = g.time + 3; R.step(60 * 2);
    const A = g.level.breach.hostiles[0].aimAt; const toDoor = [1, 2].map(k => { const L = NB.hostiles[k].lastKnown; return L ? Math.hypot(L[0] - A[0], L[2] - A[2]) : Infinity; });
    verdict(R.blind[0] === BLIND.rounds && R.leak > 5 && toDoor.every(d => d < 4), 'a blind round tells his colleagues where it went, never where Sam is', `blind rounds ${R.blind.join('+')} · nearest any defender's fix came to Sam ${R.leak.toFixed(1)} m · the two colleagues' fixes ${toDoor.map(f2).join(' / ')} m from the door point`);
    NB.stop(); }
  { // a man in Sam's arm when the charge goes off fires nothing, held or after (his turns are lost while he is held); the other two fire theirs
    everyManFires();
    const R = await rig(11, {}, true, 0.5); const { NB, game: g } = R; const P = g.level.breach; R.step(60);
    g.events.push({ kind: 'kick', pos: [28, 0, 17.6], time: g.time, loud: true, level: 1.0, who: NB.ops[0].char.id }); R.step(90);
    const h = NB.hostiles[1]; h.held = { by: 'player', since: g.time, variant: 'arm', phase: 'held', reverse: false };
    const it = g.items.spawn('flash', [P.toss.land[0], 0.25, P.toss.land[2]], [0, 0, 0], { fuse: 9, heading: 0 }); it.fired = true; detonateStun(g, it);
    const due = BLIND.after + BLIND.stagger + BLIND.rounds * BLIND.every + 0.3;   // every one of his turns has come and gone by then
    for (let i = 0; i < due * 60; i++) { h.dazzledUntil = Math.max(h.dazzledUntil, g.time + 2); R.step(); }
    const whileHeld = R.blind[1]; h.held = null; const left = h.dazzledUntil - g.time; R.step(90);   // let go of, still dazzled: the burst is not kept for him
    verdict(whileHeld === 0 && R.blind[1] === 0 && left > 1.4 && R.blind[0] === BLIND.rounds && R.blind[2] === BLIND.rounds, 'a dazzled man in Sam\'s arm fires no blind round, and none once let go: the turns are lost, not kept', `blind rounds ${R.blind.join('+')} (the held man is the second: ${whileHeld} while held, ${R.blind[1] - whileHeld} in the 1.5 s after, ${f2(left)} s of dazzle left at the release)`);
    NB.stop(); }
  { // the walkover setting stays a knob position: blind fire off, three seeds — not a round from inside, the team whole
    let rounds = 0, lost = 0, clear = 0;
    for (const seed of [11, 12, 13]) { const o = await play(seed, { blindFire: false }, 0.5); rounds += o.hostile; lost += o.lost; if (o.state === 'clear') clear++; }
    verdict(rounds === 0 && lost === 0 && clear === 3, 'blind fire off (the charge as the night game has it) is still the walkover: three seeds, no round from inside, nobody lost', `rounds from the defenders ${rounds} · men lost ${lost} · room taken ${clear} of 3`); }
  return done();
});

/** HARD'S DRILLED DEFENDERS (roomfight.ts DRILLED, difficulty.ts HARD.drilled): the same canister on the same seed at standard, at hard, and at hard with the
 *  row off. A drilled man is blind exactly as long, doubled over DRILLED.shaken as long, puts more of his blind burst down the door, and the first to fire says
 *  so, once; with the row off hard's three take the canister as standard's do. (Every dazzled man fires: the break roll is not what is under test.) */
export const nightbreachDrilled = guarded(async () => {
  const { verdict, done } = family('nightbreach-drilled: hard\'s three are half as shaken by a canister — blind as long, more of the burst fired, said once; the row off is standard');
  const { setDifficulty, HARD } = await import(`${ROOT}/src/game/difficulty.ts`), { DRILLED } = await import(`${ROOT}/src/game/roomfight.ts`);
  const was = HARD.drilled, f2 = (x: number) => x.toFixed(2);
  const run = async (level: 'standard' | 'hard', row: boolean) => {
    HARD.drilled = row; setDifficulty(level, false); everyManFires();
    const R = await rig(11, {}, true, 0.5); const { NB, game: g } = R; const P = g.level.breach; R.step(60);
    let said = 0; const say0 = g.say.bind(g); g.say = (gd: any, text: string, radio?: boolean) => { if (text.startsWith('can\'t see')) said++; return say0(gd, text, radio); };
    g.events.push({ kind: 'kick', pos: [28, 0, 17.6], time: g.time, loud: true, level: 1.0, who: NB.ops[0].char.id }); R.step(90);
    const it = g.items.spawn('flash', [P.toss.land[0], 0.25, P.toss.land[2]], [0, 0, 0], { fuse: 9, heading: 0 }); it.fired = true; detonateStun(g, it);
    const stag: number[] = NB.hostiles.map((h: any) => h.staggerUntil - g.time), daz: number[] = NB.hostiles.map((h: any) => h.dazzledUntil - g.time);
    R.step(60 * 2.2);
    return { stag, daz, blind: R.blind.reduce((a: number, b: number) => a + b, 0), said, bad: R.bad };
  };
  try {
    const S = await run('standard', true), H = await run('hard', true), O = await run('hard', false);
    const near = (a: number[], b: number[], k = 1) => a.length === 3 && a.every((x, i) => x > 0.3 && Math.abs(x - b[i] * k) < 1e-6);
    verdict(near(H.daz, S.daz) && near(O.daz, S.daz), 'blind exactly as long at standard, at hard, and at hard with the row off', `dazzled ${S.daz.map(f2).join(' / ')} s · hard ${H.daz.map(f2).join(' / ')} · row off ${O.daz.map(f2).join(' / ')}`);
    verdict(near(H.stag, S.stag, DRILLED.shaken) && near(O.stag, S.stag), `doubled over × ${DRILLED.shaken} at hard; as standard with the row off`, `doubled over ${S.stag.map(f2).join(' / ')} s · hard ${H.stag.map(f2).join(' / ')} · row off ${O.stag.map(f2).join(' / ')}`);
    verdict(H.blind > S.blind && H.blind > O.blind && H.blind <= BLIND.rounds * 3, 'more of the blind burst is fired at hard than at standard or with the row off', `blind rounds in 2.2 s: standard ${S.blind} · hard ${H.blind} · row off ${O.blind} (of ${BLIND.rounds * 3})`);
    verdict(H.said === 1 && S.said === 0 && O.said === 0 && !S.bad && !H.bad && !O.bad, 'the first drilled man to fire blind says so, once; nobody says it at standard or with the row off', `said: standard ${S.said} · hard ${H.said} · row off ${O.said}`);
  } finally { HARD.drilled = was; setDifficulty('standard', false); }
  return done();
});

export const nightbreachRestart = guarded(async () => {
  const { verdict, done } = family('nightbreach-restart: a restart under it stages it again');
  const R = await rig(11); const { game: g, NB, W } = R; const P = g.level.breach;
  R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.press(); R.until(() => !isNaN(R.beat('door-flung')), 20); R.step(20);
  const old = [...NB.ops, ...NB.hostiles]; const mid = NB.state;
  W.input.keys.add('ShiftLeft'); W.input.pressed.add('Enter'); R.step(); W.input.keys.delete('ShiftLeft'); R.step(2);
  const check = (label: string, n: number) => {
    const pl = g.player; const door = g.doors.byName(P.door);
    const fresh = NB.ops.length === 2 && NB.hostiles.length === 3 && [...NB.ops, ...NB.hostiles].every((x: any) => !old.includes(x) && g.guards.includes(x) && x.state !== 'dead');
    const marks = NB.ops.every((o: any, i: number) => dist(o.char.pos, P.from[i]) < 0.4) && NB.hostiles.every((h: any, i: number) => dist(h.char.pos, P.hostiles[i].pos) < 0.4);
    verdict(NB.active && NB.state === 'staged' && NB.staged === n && fresh && marks && g.guards.length === 5 && Math.abs(door.angle) < 0.02 && dist(pl.char.pos, NIGHTBREACH.samAt) < 0.4 && pl.slot === 'rifle' && !pl.holstered && !pl.down && NB.blindRounds === 0,
      label, `${NB.summary()} · fresh cast ${fresh} on marks ${marks} · guards ${g.guards.length} · door ${f2(door.angle)} · Sam @${pl.char.pos.map(f2)} ${pl.slot}/${pl.holstered ? 'holstered' : 'up'} · blind rounds ${NB.blindRounds}`);
  };
  check(`Shift+Enter mid-entry (state '${mid}') → staged again on the next frame: fresh cast on the marks, door shut, Sam back with the rifle up`, 2);
  R.step(120);
  verdict(NB.state === 'staged' && isNaN(R.beat('go')), 'the orders are back to none: the fresh pair waits', `state ${NB.state} · go beat ${f2(R.beat('go'))}`);
  old.splice(0, old.length, ...NB.ops, ...NB.hostiles);
  g.restartEncounter(); R.step(2);
  check('a bare restartEncounter() (the down card, the menus) → staged again', 3);
  { // a bare resetGuards (the panel's reset, a console) with the charge in the air: answered with a FULL restart — nothing of the old run left to go off
    old.splice(0, old.length, ...NB.ops, ...NB.hostiles);
    R.press(); R.until(() => NB.state === 'set', 30); R.press(); R.until(() => !isNaN(R.beat('toss')), 20);
    const inAir = itemsOf(g).filter((it: any) => it.kind === 'flash').length;
    g.resetGuards(); R.step(2);
    check(`resetGuards() with the charge in the air (${inAir} can) → a full restart, staged again`, 4);
    verdict(inAir > 0 && itemsOf(g).length === 0, 'and the old run\'s charge is gone with it', `items on the floor / in the air: ${itemsOf(g).length}`); }
  R.press(); const set = R.until(() => NB.state === 'set', 30); R.press(); const ended = R.until(() => NB.drill.phase === 'done', 45);
  verdict(set && ended && (NB.state === 'clear' || NB.state === 'failed') && NB.blindRounds > 0 && !R.bad, 'and it plays through again from the restage, to the room taken or the team down (the default is a fight: either is an end)', NB.summary());
  NB.stop();
  return done();
});

export const nightbreachStop = guarded(async () => {
  const { verdict, done } = family('nightbreach-stop: stop() puts the night back');
  const R = await rig(11); const { game: g, NB, W } = R;
  R.step(60); R.press(); R.until(() => NB.state === 'set', 30); R.press(); R.until(() => NB.drill.phase === 'done', 45);
  NB.stop(); R.step(2);
  const staff = g.guards.filter((x: any) => !x.unit);
  verdict(!NB.active && NB.state === 'off' && NB.drill === null && g.guards.length === R.before.guards && staff.length === R.before.guards && staff.every((x: any) => x.state === 'patrol' && g.engine.lights.lights.includes(x.flashlight)),
    'the cast is gone and the shift is back on the list, on patrol, torches in the light set', `${NB.summary()} · guards ${g.guards.map((x: any) => `${x.callsign}:${x.state}`).join(' ')}`);
  verdict(g.civilians.length === R.before.civilians && JSON.stringify(g.tune) === R.before.tune && steady(W) === R.before.steady && R.lit() === R.before.room,
    'the civilians, Game.tune, the room\'s lights and the steady light count are as before', `civilians ${g.civilians.length}/${R.before.civilians} · tune ${JSON.stringify(g.tune) === R.before.tune ? 'untouched' : 'CHANGED'} · breakroom ${R.lit()} · steady lights ${steady(W)}/${R.before.steady}`);
  const pl = g.player; let threw = '';
  try { R.step(60 * 10); } catch (e) { threw = String(e); }
  verdict(!threw && !R.bad && !pl.down && canSave(g, true) === null, 'the night floor runs on for ten seconds and a checkpoint may be filed again', `${threw || 'no throw'} · save: ${canSave(g, true) ?? 'allowed'}`);
  verdict(NB.start() === null && NB.state === 'staged' && (NB.stop(), !NB.active), 'and it starts and stops a second time', NB.summary());
  return done();
});
