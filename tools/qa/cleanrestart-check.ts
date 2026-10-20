// A RESTART GIVES A CLEAN LEVEL (src/game/cleanrestart.ts, CLEANRESTART).
// The office night twice over on one die: one Game WRECKED (every fixture a round can reach shot out — a parked vehicle's lamps among them —, wall switches
// thrown, a fixture tripped by the OCP, grenades by doors and by men, doors opened, the mains pulled by hand and then the breaker shot), its TWIN left alone for
// the same ticks. Both are restarted, and the wrecked one is compared with the twin and with a Game just stood up:
//   the lights (every target's switch, glass, timer and painted factor; the mains; the beacons; nothing said, nothing sounded), every static's paint, what
//   the host holds (decals, thrown things, smoke, lights, moving boxes, the camera, the picture's histories), the whole game state one tick and ten seconds on
//   (every difference either gone or on a list below with its reason), the run digest second by second;
// then each way a restart is reached (the cards' buttons and the panel's, Shift+Enter, Enter when down — Game.restart — and a mission's restage), a
// checkpoint laid over a restart (a load is not a restart: a file saved in the dark, far from the start, loads dark with the camera on its man), the switch
// off (the fault as it was), the stands and a recording from before the table.
//   bun run tools/qa/cleanrestart-check.ts          (probes.ts cleanrestart; CLEANRESTART_BREAK=1 must FAIL — the switch is left down where the check raises it)
// Both stands: the check raises the switch itself, and gives the stand the words that make a wall switch and a vehicle's lamp things to break on either.
// Nothing here is a picture: the restart's first frames have not been seen on a GPU by this check (cleanrestart-page.cjs counts them on the software adapter).
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { CLEANRESTART, CLEANRESTART_STATS } = await import(`${ROOT}/src/game/cleanrestart.ts`);
const RB: any = await import(`${ROOT}/src/game/rollback.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const FR: any = await import(`${ROOT}/src/game/frag.ts`);
const LS: any = await import(`${ROOT}/src/game/lightswitch.ts`);
const { VEHICLE_GROUP, CARLAMPS } = await import(`${ROOT}/src/game/carlamps.ts`);
const { VENT_DEFAULTS } = await import(`${ROOT}/src/scene/levelData.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

const DT = 1 / 60, BREAK = process.env.CLEANRESTART_BREAK === '1', VERBOSE = !!process.env.CLEANRESTART_VERBOSE;
function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function hushed<T>(f: () => T | Promise<T>): Promise<T> { const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { }; try { return await f(); } finally { console.log = log; console.warn = warn; console.error = err; } }
const WORDS = ['TPS_CARLAMPS', 'TPS_LIGHTSWITCH'];
/** the office night on die 1, a wall switch and a vehicle's lamp things to break on either stand; `word` = the stand's own word for this switch, or none */
async function stand(word?: '0' | '1'): Promise<any> {
  const was = [...WORDS, 'TPS_CLEANRESTART'].map(k => [k, process.env[k]] as const);
  try {
    for (const k of WORDS) process.env[k] = '1';
    if (word !== undefined) process.env.TPS_CLEANRESTART = word;
    Math.random = seeded(21);
    const W: any = await hushed(() => standUp({ seed: 1 }));
    W.said = !!CLEANRESTART.on; W.rnd = seeded(5); W.input.mouseX = 1000; W.input.mouseY = 380;   // (the cursor somewhere definite: at the screen's centre it sits on the man and his aim has no direction)
    return W;
  } finally { for (const [k, v] of was) if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}
/** n frames of each Game in turn, each on its own stream of the page's dice (sparks and moths: nothing the game reads) */
const steps = (Ws: any[], n: number) => { for (let i = 0; i < n; i++) for (const W of Ws) { Math.random = W.rnd; W.step(DT); } };
const restart = async (W: any, on: boolean) => { CLEANRESTART.on = on && !BREAK; W.rnd = seeded(9); Math.random = W.rnd; await hushed(() => W.game.restart()); };   // (Game.restart: what the cards' buttons and the keys call)

// What a wrecked level's restart may still differ in from its untouched twin's, and why. Nothing here is read by the game's rules, the men or the picture:
// counters that only ever count up, logs, caches and scratch that are rebuilt on demand, tables with an entry made the first time something is asked, and
// the order of an object's keys.
const ALLOW: [RegExp, string][] = [
  [/^game\.col\.(sound\.cache|stamp|stampId|cellStamp|segCells|trig(Yaw|Cos|Sin))\b/, 'the collision grid\'s visit stamps and memo tables'],
  [/^game\.(col\.dynamicBoxes|dynBoxes|targets)\[\d+\]: keys /, 'the order of an object\'s keys (a field first written by the last try)'],
  [/^world\.(?!statics\b)/, 'the host world\'s packed buffers, grids and serials (the statics themselves are compared box by box, line 3)'],
  [/^game\.(eventSeq|fxSeed|rollSeq|items\.serial|decals\.serial|devices\.seq|verdict\.wallSerial)\b/, 'serial numbers: they count up and name nothing that stands'],
  [/^game\.civilians\[\d+\]\.heardUpTo\b/, 'a place in the event list, which is numbered by the serial above'],
  [/^game\.(props\.near|reachHold|tmpV)\b/, 'scratch written before it is read'],
  [/^game\.destr\.(debris\.(serial0?|frame|stats)|walls\.(serial|changes|scratch\w*|wear\.(stats|log))|edgeLook\.room|furn\.(groups|memberAt|kept|fronts|fling)|roofs|gatherScratch|caps\.\w+\.ts)\b/, 'destruction\'s serials, logs, per-level tables found on first use and rate caps\' stamps of a time now past'],
  [/^game\.wind\.all\[\d+\]\.gust\b/, 'the gust of a source that is not blowing (written the next time it does)'],
  [/^game\.glassBreak\.(log|ext)\b/, 'the glass log and the panes\' extents, found on first use'],
  [/^game\.(saves\.(log|stats)|sensors\.stats)\b/, 'tallies'],
  [/^dialogue\.ambientByGame\{[^}]*\}\.(played|count)\b/, 'which idle chatter has been heard: kept through a restart on purpose (dialogue.ts)'],
  [/^(dialogue\.(ownRects|roomRects)|frag\.TORN|glasspen\.states|handleside\.faces|lighting\.LENS_FROM|wallcharge\.skyMemo|rainFx\.states)\{/, 'a table\'s entry made the first time it is asked for'],
  [/^(fixtureBreak\.STATE\{[^}]*\}\.keys|coverfire\.states\{[^}]*\}\.serial|lightswitch\.states\{[^}]*\}\.serial)\b/, 'a table\'s own serial or count of keys seen'],
  [/^game\.sparks\.pool\[\d+\]\.(?!alive\b)/, 'a dead spark\'s last numbers (the pool is all dead in both: `alive` is compared)'],
  [/^game\.moths\.moths\[\d+\]\.box\.rot\b/, 'a moth\'s heading on the restart\'s own tick, turned from the one it flew the tick before (the same a tick later; where it is is compared)'],
  [/^(game\.wallCharge\.nearby|guards\.bodyProbeN\{|workthings\.errands\{)/, 'a scratch list, a per-tick budget and an answer asked again every second'],
  [/^(game\.destr\.furn\.mouthMemo|game\.col\.nav\.\w*[sS]cratch\w*)\b/, 'a memo of the last hole asked about and the path finder\'s scratch'],
];
const audit = (a: any, b: any) => { a.col.nav.scratch = null; b.col.nav.scratch = null; const all: string[] = RB.stateAlike(a, b, 20000); const left = all.filter(d => !ALLOW.some(([re]) => re.test(d))); return { n: all.length, left }; };
const group = (d: string[]) => { const m = new Map<string, number>(); for (const x of d) { const k = x.split(':')[0].replace(/\[\d+\]/g, '[]').replace(/\{[^}]*\}/g, '{}').replace(/<[^>]*>/g, '<>'); m.set(k, (m.get(k) ?? 0) + 1); } return [...m].slice(0, 8).map(([k, n]) => `${n}× ${k}`).join(' · '); };
const group2 = (d: string[]) => { const m = new Map<string, number>(); for (const x of d) { const k = x.split(':')[0].replace(/\[\d+\]/g, '[]').replace(/\{[^}]*\}/g, '{}').replace(/<[^>]*>/g, '<>'); m.set(k, (m.get(k) ?? 0) + 1); } return [...m].map(([k, n]) => `${n}× ${k}`).join(' · '); };
const paint = (s: any) => JSON.stringify([s.c, s.h, s.flags, s.rot ?? null, s.albedo, s.emissive, s.markGain ?? null]);
const shape = (s: any) => JSON.stringify([s.c, s.h, s.flags, s.rot ?? null]);
/** the lights as named things: nothing broken, tripped or blacked out, no restrike left to play, no beacon turning */
const lightsFresh = (g: any) => {
  const bo = g.blackout, bad: string[] = [];
  if (bo.active || bo.permanent || bo.until !== -1 || bo.since !== -1 || bo.restoredAt !== -100) bad.push(`the mains ${JSON.stringify(bo)}`);
  const broken = g.targets.filter((t: any) => t.broken).length, tripped = g.targets.filter((t: any) => t.disabledUntil > 0).length, turning = g.beacons.filter((b: any) => b.target.on || b.light.enabled).length;
  if (broken) bad.push(`${broken} broken`); if (tripped) bad.push(`${tripped} tripped`); if (turning) bad.push(`${turning} beacons turning`);
  if (g.breakerFixT !== 0) bad.push('a hand on the breaker'); if (g.guards.some((x: any) => x.task?.kind === 'breaker')) bad.push('a man sent to the breaker');
  return bad;
};
const said = (g: any) => g.messages.map((m: any) => m.text).filter((t: string) => /mains|guards reset|encounter restarted|power/i.test(t));
const sounded = (W: any, from: number) => (W.audioLog as { name: string }[]).slice(from).map(c => c.name).filter(n => /power/i.test(n));
/** put a level's lights out by the mains (by hand) and break one fixture: the short wreck the ways-in lines use */
const darken = (W: any) => { const g = W.game; const t = g.targets.find((x: any) => x.kind !== 'breaker' && x.mains && !x.broken); if (t) t.broken = true; g.setBlackout(86400, 'hand'); steps([W], 90); return { out: g.blackout.active, broke: !!t }; };

export async function cleanrestartCheck(): Promise<boolean> {
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log(`\n=== cleanrestart: a restart gives a clean level${BREAK ? ' (CLEANRESTART_BREAK: the switch left off)' : ''} ===`);
  const was = { ...CLEANRESTART }, stats0 = { ...CLEANRESTART_STATS }, rnd = Math.random, held = { ls: LS.LIGHTSWITCH.on, cl: CARLAMPS.on };   // (the stand's words below raise the wall switches and the vehicles' lamps: put back with this check's own)
  try {
    const shipped = process.env.TPS_PROFILE === 'shipped', given = process.env.TPS_CLEANRESTART;
    const A: any = await stand(), B: any = await stand(), C: any = await stand();
    const g = A.game, gb = B.game, gc = C.game, pl = g.player, c = pl.char;
    for (const W of [A, B, C]) W.audioLog = [];
    let smokeCleared = 0; { const was = A.smoke.clearAll?.bind(A.smoke); A.smoke.clearAll = () => { smokeCleared++; was?.(); }; }
    const pictures: string[] = []; A.engine.restartPicture = (why: string) => { pictures.push(why); };

    // ---- the wreck (A), the twin idling beside it (B)
    const did = { shot: 0, lamps: 0, switches: 0, ocp: 0, doorsOff: 0, opened: 0, dead: 0, decals: 0, items: 0, far: 0 };
    await hushed(() => {
      steps([A, B], 30);
      for (let i = 0; i < 3 && !pl.pistolUp; i++) { A.input.pressed.add(i === 0 ? 'Digit1' : 'KeyE'); steps([A, B], 50); }
      for (const t of g.targets) { if (t.kind === 'breaker') continue;   // a round at every fixture from wherever one can stand by it
        for (let k = 0; k < 16 && !t.broken; k++) { const a = k / 16 * Math.PI * 2, p = [t.pos[0] + Math.sin(a) * 2.5, 0, t.pos[2] + Math.cos(a) * 2.5]; if (g.col.nav.isBlocked(p[0], p[2])) continue;
          g.teleportPlayer(p); steps([A, B], 2); pl.aim?.clear?.(); fireWeapon(g, c, t.pos, true, { spread: 0 }); steps([A, B], 1); } }
      did.shot = g.targets.filter((t: any) => t.broken).length; did.lamps = g.targets.filter((t: any) => t.broken && t.group === VEHICLE_GROUP).length;
      const sws = LS.wallSwitches(g); for (const sw of sws.slice(0, 3)) { LS.flipSwitch(g, sw, !LS.switchLit(sw), c); did.switches++; }
      { const t = g.targets.find((x: any) => !x.broken && x.mains && x.kind !== 'breaker'); if (t) { g.ocp(t); steps([A, B], 5); if (t.disabledUntil > 0 || g.blackout.active) did.ocp = 1; if (g.blackout.active) g.endBlackout(); } }
      let nb = 0; const blast = (p: number[]) => { FR.blast(g, [p[0], 0.2, p[2]], { who: 0, serial: 900 + nb++, name: 'frag grenade', destr: { radius: FR.FRAG.destrM, power: 1 } }); steps([A, B], 20); };
      for (const d of g.doors.list.slice(0, 6)) blast([d.def.hinge[0] + 0.4, 0, d.def.hinge[1] + 0.4]);
      for (const d of g.doors.list.slice(6, 12)) { g.doors.use(d, c.pos, 0); did.opened++; }
      for (const gd of g.guards.slice(0, 4)) blast([gd.char.pos[0] + 0.5, 0, gd.char.pos[2]]);
      g.setBlackout(86400, 'hand'); steps([A, B], 60); g.setBlackout(Infinity, 'shot'); steps([A, B], 60);   // the mains by hand, then the breaker shot
    });
    did.doorsOff = g.doors.list.filter((d: any) => d.off).length; did.dead = g.guards.filter((x: any) => x.state === 'dead').length; did.decals = g.decals.count; did.items = g.items.items.length;
    did.far = v3.distXZ(A.cam.target, gc.followPos());
    const wrecked = did.shot >= 20 && did.lamps >= 1 && did.switches >= 1 && did.ocp === 1 && (did.doorsOff >= 1 || !shipped) && did.opened >= 1 && did.dead >= 1 && did.decals > 50 && g.blackout.active && g.blackout.permanent && did.far > 3;
    gb.dice.s = g.dice.s; gb.dice.n = g.dice.n;   // (the twin's die where the wrecked Game's stands: a restart does not wind the die back, and the two are then one run)

    // ---- both restarted; one tick; against the twin and a Game just stood up
    const lo = { a: A.audioLog.length, b: B.audioLog.length }, st0 = { ...CLEANRESTART_STATS }, ventsSlow = g.wind.all.filter((s: any) => s.why === 'vent' && s.on < 1).length; let ventsWrong = 0;
    await restart(A, true); const saidA = said(g), linesA = g.messages.length;
    const vents = g.wind.all.filter((s: any) => s.why === 'vent'), due = (v: any, t: number) => !(v.period > 0) || (((t - (v.phase ?? 0)) / v.period) % 1 + 1) % 1 <= (v.duty ?? VENT_DEFAULTS.duty);
    const ventsOff = vents.filter((s: any) => s.on !== (due(s.vent, g.time) ? 1 : 0)).length, ventsRest = vents.filter((s: any) => s.on === 0).length;
    if (vents.length) { const s = vents.find((x: any) => x.vent.period > 0) ?? vents[0], want = due(s.vent, g.time) ? 1 : 0; s.on = 1 - want; g.wind.fresh(); if (s.on !== want) ventsWrong++; }   // (… and one put the other way round is put back by the same call)
    await restart(B, true);
    steps([A, B, C], 1);
    const st1 = { ...CLEANRESTART_STATS };
    line(wrecked, '1 the wreck is one: fixtures shot out (a vehicle\'s lamp among them), switches thrown, the OCP tripped, doors blown and opened, men dead, the mains out for good, the camera elsewhere',
      `${did.shot} of ${g.targets.length} fixtures shot, ${did.lamps} a vehicle's · ${did.switches} switches · OCP ${did.ocp} · ${did.doorsOff} doors off${shipped ? '' : ' (the frozen stand: a blast takes none off its frame)'}, ${did.opened} opened · ${did.dead} dead · ${did.decals} decals · ${did.items} things on the floor · the camera ${did.far.toFixed(1)} m from the start`);

    { const T = g.targets, TB = gb.targets, TC = gc.targets; const bad = lightsFresh(g);
      let twin = 0, fresh = 0, named = 0;
      for (let i = 0; i < T.length; i++) { if (!Object.is(T[i].factor, TB[i].factor)) twin++; if (T[i].factor !== TC[i].factor) fresh++; if (T[i].on !== TC[i].on || T[i].broken !== TC[i].broken || T[i].disabledUntil !== TC[i].disabledUntil) named++; }
      let twinB = 0; for (let i = 0; i < T.length; i++) if (TB[i].factor !== TC[i].factor) twinB++;
      const noise = [...saidA, ...sounded(A, lo.a)];
      line(T.length === TC.length && bad.length === 0 && twin === 0 && named === 0 && fresh === twinB && noise.length === 0 && linesA === 0 && JSON.stringify(g.blackout) === JSON.stringify(gc.blackout),
        '2 one tick after the restart every light stands as a level just opened has it: whole, switched as authored, the mains in with no restrike and no beacon turning, nothing said and nothing sounded',
        `${T.length} targets · painted factor: ${twin} off the twin's · ${fresh} off a fresh boot's (the twin: ${twinB}, lamps that follow the clock) · switch, glass or timer off a fresh boot's: ${named} · ${bad.join(', ') || 'the mains as new'} · said or sounded: ${noise.join(', ') || 'nothing'} · lines on the HUD ${linesA}`); }

    { const sa = A.engine.world.statics, sb = B.engine.world.statics, sc = C.engine.world.statics; let twin = 0, place = 0, glow = 0;
      for (let i = 0; i < Math.min(sa.length, sb.length, sc.length); i++) { if (paint(sa[i]) !== paint(sb[i])) twin++; if (shape(sa[i]) !== shape(sc[i])) place++; if (paint(sa[i]) !== paint(sc[i])) glow++; }
      let glowB = 0; for (let i = 0; i < Math.min(sb.length, sc.length); i++) if (paint(sb[i]) !== paint(sc[i])) glowB++;
      line(sa.length === sb.length && sa.length === sc.length && twin === 0 && place === 0 && glow === glowB, '3 every static box is where and what a level just opened has it, and painted as the twin\'s',
        `${sa.length} boxes (fresh ${sc.length}) · paint off the twin's: ${twin} · place, size or flags off a fresh boot's: ${place} · paint off a fresh boot's: ${glow} (the twin: ${glowB}, the glow of lamps that follow the clock)`); }

    { const cnt = (W: any) => ({ decals: W.game.decals.count, items: W.game.items.items.length, lights: W.engine.lights.lights.length, lit: W.engine.lights.lights.filter((l: any) => l.enabled).length, dyn: W.game.dynBoxes.length, col: W.game.col.boxes.length,
        doors: W.game.doors.list.filter((d: any) => d.off || Math.abs(d.angle - (d.def.angle ?? 0)) > 1e-6).length, men: W.game.guards.filter((x: any) => x.state !== 'dead').length, civ: W.game.civilians?.length ?? 0 });
      const a = cnt(A), b = cnt(B), f = cnt(C), camA = v3.distXZ(A.cam.target, C.cam.target);
      const same = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify({ ...a, lit: 0 }) === JSON.stringify({ ...f, lit: 0 });
      line(same && a.decals === 0 && a.items === 0 && smokeCleared >= 1 && pictures.length === 1 && camA < 0.05 && vents.length > 0 && ventsOff === 0 && ventsWrong === 0 && st1.restarts - st0.restarts === 2 && st1.relit - st0.relit === 1 && st1.cuts - st0.cuts === 2,
        '4 what the host holds is a fresh level\'s: no decal, nothing thrown, the smoke cleared, every door hung and standing as authored, the same lights and boxes, the picture\'s histories restarted once, the camera on the man, every vent where its own cycle has it',
        `wrecked ${JSON.stringify(a)} · fresh ${JSON.stringify(f)} · smoke cleared ${smokeCleared}× · the host told ${pictures.length}× (${pictures[0] ?? '-'}) · the camera ${camA.toFixed(3)} m from a fresh boot's (${did.far.toFixed(1)} m before) · ${vents.length} vents (${ventsSlow} run down by the blackout before), ${ventsOff} off their cycle after (${ventsRest} at rest in it), one turned round by hand put back: ${ventsWrong === 0} · tally ${JSON.stringify(st1)}`); }

    // ---- the whole state, one tick and ten seconds on; the run by digest
    { const one = audit(g, gb); const hashes: string[] = []; let split = -1, splitAt = '';
      const run = (x: any) => { const d: any = digestGame(x, true); delete d.seq; for (const cv of d.civilians ?? []) delete cv.heard; return d; };   // (the digest less the event serial and each civilian's place in it: a number that counts up through a restart and names nothing that stands)
      for (let s = 0; s <= 10; s++) { const da = run(g), db = run(gb), ha = hashDigest(da) as string, hb = hashDigest(db) as string; hashes.push(ha); if (ha !== hb && split < 0) { split = s; splitAt = Object.keys(da).filter(k => JSON.stringify(da[k]) !== JSON.stringify(db[k])).join(', '); if (VERBOSE) for (const k of splitAt.split(', ')) console.log(`      digest ${k}:\n        ${JSON.stringify(da[k]).slice(0, 700)}\n        ${JSON.stringify(db[k]).slice(0, 700)}`); } if (s < 10) await hushed(() => steps([A, B], 60)); }
      const ten = audit(g, gb);
      line(one.left.length === 0 && ten.left.length === 0 && split < 0, '5 the game state of the wrecked level, restarted, is its untouched twin\'s one tick on and ten seconds on, and the run is the twin\'s by digest every second',
        `one tick: ${one.n} differences, ${one.left.length} not on the list${one.left.length ? ` (${group(one.left)})` : ''} · ten seconds: ${ten.n}, ${ten.left.length} not on the list${ten.left.length ? ` (${group(ten.left)})` : ''} · digest ${split < 0 ? `the same at 0…10 s (${hashes[10]})` : `splits at ${split} s in ${splitAt}`}`);
      if (VERBOSE) for (const d of [...one.left, ...ten.left].slice(0, 60)) console.log(`      ${d.slice(0, 200)}`);
      if (VERBOSE) console.log(`      unlisted, grouped: ${group2(one.left)}`); }

    // ---- the picture's own knob; the switch off (the restart as it was)
    { const D: any = await stand(); const gd = D.game; D.audioLog = []; const pics: string[] = []; D.engine.restartPicture = (w: string) => { pics.push(w); };
      await hushed(() => steps([D], 30)); darken(D);
      CLEANRESTART.picture = false; await restart(D, true); const quiet = pics.length; CLEANRESTART.picture = was.picture;
      darken(D); const lo = D.audioLog.length, msgs = gd.messages.length; await restart(D, false); await hushed(() => steps([D], 1));
      const T = gd.targets, TC = gc.targets; let off = 0; for (let i = 0; i < T.length; i++) if (T[i].factor !== TC[i].factor) off++;
      const turning = gd.beacons.filter((b: any) => b.target.on).length, saidOff = said(gd), heard = sounded(D, lo);
      line(quiet === 0 && pics.length === 0 && gd.blackout.restoredAt > 0 && turning > 0 && saidOff.length > 0 && heard.length > 0, '6 the picture knob down, the host is not told; the switch off, a restart is the one it was: the mains come back by the breaker\'s road, beacons turning, a line on the HUD, the sound of the power',
        `host told ${quiet}× with the knob down · off: ${off} of ${T.length} factors off a fresh boot's at the first tick, ${turning} beacons turning · said: ${saidOff.join(' / ')} · sounded: ${heard.join(', ')} · ${gd.messages.length - msgs >= 0 ? 'the HUD kept its lines' : 'lines dropped'}`);

      // ---- each way a restart is reached
      const ways: string[] = [], wrong: string[] = [];
      const way = async (name: string, go: () => void | Promise<void>, W: any = D) => { const d = darken(W), n = CLEANRESTART_STATS.restarts, lo = W.audioLog.length; CLEANRESTART.on = !BREAK; await hushed(async () => { Math.random = W.rnd; await go(); steps([W], 1); });
        const bad = lightsFresh(W.game), noise = [...said(W.game), ...sounded(W, lo)]; const ok = d.out && d.broke && CLEANRESTART_STATS.restarts > n && bad.length === 0 && noise.length === 0;
        ways.push(`${name} ${ok ? 'clean' : 'NOT'}`); if (!ok) wrong.push(`${name}: ${!d.out ? 'never dark · ' : ''}${CLEANRESTART_STATS.restarts > n ? '' : 'no restart counted · '}${[...bad, ...noise].join(', ')}`); };
      await way('Shift+Enter', () => { D.input.keys.add('ShiftLeft'); D.input.pressed.add('Enter'); D.step(DT); D.input.keys.delete('ShiftLeft'); });
      await way('Enter when down', () => { gd.player.down = true; D.input.pressed.add('Enter'); D.step(DT); });
      const src = (f: string) => readFileSync(`${ROOT}/${f}`, 'utf8');
      const cards = (src('src/ui/menu.ts').match(/\.restart\(\)/g) ?? []).length, panel = /restart \(Shift\+Enter\)', run: \(\) => game\.restart\(\)/.test(src('src/ui/bindings.ts')), key = /g\.restart\(said\)/.test(src('src/game/player.ts'));
      const others = ['src/game/savestate.ts', 'src/game/journal.ts', 'src/replay/engineplay.ts'].filter(f => /\.restart\(/.test(src(f)));   // (a load, a recording's first frame and a tape's restart row reset the encounter and keep their own camera and picture)
      await way('the cards\' and the panel\'s button', () => gd.restart());
      gd.msg('a line of the last try'); CLEANRESTART.on = !BREAK; await hushed(() => gd.restart('checkpoint: why it would not load')); const kept = gd.messages.map((m: any) => m.text).join(' / ');
      const E: any = await stand(); E.audioLog = []; const ge = E.game;
      const start = () => { const { why } = startFromQuery(ge, new URLSearchParams('rescue')) as { why: string | null }; if (why) throw new Error(`the mission did not start: ${why}`); };
      await hushed(() => { start(); steps([E], 30); });
      await way('a mission\'s restage', () => ge.rescue.restage(), E);
      const staged = !!ge.rescue?.active && ge.guards.length > 0;
      line(wrong.length === 0 && cards === 2 && panel && key && others.length === 0 && staged && kept === 'checkpoint: why it would not load', '7 every way to a restart is a clean one: Shift+Enter, Enter when down, the pause and down cards\' buttons and the panel\'s, a mission restaged (a mission picked from the list is a page load: a level just opened)',
        `${ways.join(' · ')} · menu.ts calls it ${cards}×, the panel ${panel ? 'does' : 'DOES NOT'}, the key ${key ? 'does' : 'DOES NOT'}; a load, a recording, a tape: ${others.join(', ') || 'none do'} · a line about the restart itself outlives it, the last try's do not: "${kept}" · the mission staged after: ${staged}${wrong.length ? ` · ${wrong.join(' · ')}` : ''}`);

      // ---- a checkpoint is not a restart
      { await hushed(() => { gd.restartEncounter(); steps([D], 30); });
        { const p = gd.player.char.pos; for (let k = 10; k < 40; k++) { const q = [p[0] + k, 0, p[2]]; if (!gd.col.nav.isBlocked(q[0], q[2])) { gd.teleportPlayer(q); break; } } steps([D], 5); }   // (the man well off the start: a load's camera is the loaded man's)
        const d = darken(D); const s = D.snapshot('in the dark', true); const brokeWas = gd.targets.filter((t: any) => t.broken).length, away = v3.distXZ(gd.player.char.pos, gd.level.playerSpawn);
        await restart(D, true); await hushed(() => steps([D], 30)); const mid = lightsFresh(gd).length === 0, toldWas = pics.length;
        CLEANRESTART.on = !BREAK; const t0 = { ...CLEANRESTART_STATS }; await hushed(() => { D.restore(s); steps([D], 1); });
        const broke = gd.targets.filter((t: any) => t.broken).length, camOff = v3.distXZ(D.cam.target, gd.player.char.pos), told = pics.length, cut = CLEANRESTART_STATS.cuts - t0.cuts;
        line(d.out && mid && gd.blackout.active && broke === brokeWas && broke >= 1 && away > 8 && camOff < 2 && cut === 0 && told === toldWas, '8 a checkpoint saved in the dark, far from the start, loads dark with the camera on the loaded man: a load lays its file over the fresh level, is no cut of the restart\'s and does not restart the picture',
          `saved ${away.toFixed(1)} m from the start with the mains out and ${brokeWas} broken · restarted: ${mid ? 'clean' : 'NOT clean'} · loaded: the mains ${gd.blackout.active ? 'out' : 'IN'}, ${broke} broken, the camera ${camOff.toFixed(2)} m from the man, ${cut} cuts of the restart's, the host told ${told - toldWas}×`); }
    }

    // ---- the stands and a recording from before the table
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`);
      const up: any = await stand('1'), down: any = await stand('0');
      const plain = given !== undefined ? given === '1' : shipped;   // (what a stand with no word of this check's gives: the caller's word, else the page's ON under the shipped stand and the module's OFF under the frozen)
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      CLEANRESTART.on = true; const old = snap(); delete old.tables.CLEANRESTART; J.applyKnobs(g, old); const before = CLEANRESTART.on;
      CLEANRESTART.on = true; const rec = snap(); CLEANRESTART.on = false; J.applyKnobs(g, rec); const kept = CLEANRESTART.on;
      const page = /CLEANRESTART\.on = q\.get\('cleanrestart'\) !== '0' && !q\.has\('kitview'\);/.test(readFileSync(`${ROOT}/src/host/profile.ts`, 'utf8'));   // (read, not called: pageSwitches writes every switch the page has)
      line(A.said === plain && up.said === true && down.said === false && before === false && kept === true && page && PR.FROZEN_HOLDS['CLEANRESTART.on'] === 'TPS_CLEANRESTART=1' && SE.STAND_ENV.includes('TPS_CLEANRESTART') && KN.JOURNAL_KNOBS.includes('CLEANRESTART'),
        '9 the stands: the frozen stand holds the switch off and its word raises it, the page has it on (?cleanrestart=0 puts it off); a recording from before the table replays its restarts as they were, one made with it on, clean',
        `this stand (${shipped ? 'shipped' : 'frozen'}${given !== undefined ? `, the caller's word ${given}` : ''}): ${A.said} · word 1: ${up.said} · word 0: ${down.said} · applyKnobs without the table: ${before} · recorded on: ${kept} · the page's line (on, ?cleanrestart=0 off, off in the kit picture's window) ${page ? 'there' : 'MISSING'} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CLEANRESTART.on']}`); }
  } catch (e) { console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); all = false; }
  finally { Object.assign(CLEANRESTART, was); Object.assign(CLEANRESTART_STATS, stats0); Math.random = rnd; LS.LIGHTSWITCH.on = held.ls; CARLAMPS.on = held.cl; }
  console.log(`=== cleanrestart: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await cleanrestartCheck()) ? 0 : 1);
