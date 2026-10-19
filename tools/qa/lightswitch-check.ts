// A ROOM'S LIGHTS HAVE A SWITCH ON THE WALL (src/game/lightswitch.ts, LIGHTSWITCH).
// On the office, by hand: the plates the level is given and where they hang; Sam at the manager's plate — the row, the tap, the room dark to the light
// estimate the men's eyes and the meter read, the tap again and the room as authored; a room the level left dark put on (its tubes strike); a door beside
// a plate keeps the tap; a calm defender in the room comes to the switch and puts it back a beat after the hand, once, and one with no line to it does
// not come; nobody lights a room the level left dark; a plate goes with its wall; a checkpoint keeps the dark room and a restart forgets it; with the switch off there is no plate, no row and no box; a run nobody touches a switch in is the same run by digest
// on as off; and every level file's plates hang on plain wall within a hand's reach of floor a man can stand on.
//   bun run tools/qa/lightswitch-check.ts          (probes.ts lightswitch; LIGHTSWITCH_BREAK=1 must FAIL — the switch is left off where the check puts it on)
// Both stands: the check throws the switch itself. Nothing here is a picture: no plate, glow or hand has been seen on a GPU by this check.
import { readFileSync, readdirSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { LIGHTSWITCH, LIGHTSWITCH_STATS, wallSwitches, switchLit, lightSwitchReset } = await import(`${ROOT}/src/game/lightswitch.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);

const DT = 1 / 60, BREAK = process.env.LIGHTSWITCH_BREAK === '1', VERBOSE = !!process.env.LIGHTSWITCH_VERBOSE;
const f2 = (x: number) => x.toFixed(2), flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function hushed<T>(f: () => T | Promise<T>): Promise<T> { const log = console.log, warn = console.warn; if (!VERBOSE) console.log = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.warn = warn; } }
let stood: boolean | null = null;   // (the switch as the stand left it, read once after the first stand-up)
async function stand(file: string): Promise<any> {
  Math.random = seeded(21);
  const W: any = await hushed(() => standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${file}`, 'utf8'))), seed: 1 }));
  if (stood === null) stood = !!LIGHTSWITCH.on;
  return W;
}

export async function lightswitchCheck(): Promise<boolean> {
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== lightswitch: a room\'s lights have a switch on the wall ===');
  const was = { ...LIGHTSWITCH, beside: [...LIGHTSWITCH.beside] }, rnd = Math.random, stats0 = { ...LIGHTSWITCH_STATS };
  const put = (g: any, on: boolean) => { LIGHTSWITCH.on = on; lightSwitchReset(g); };
  try {
    const W = await stand('office.json'), g = W.game, pl = g.player; g.godMode = true;
    const shipped = (process.env.TPS_PROFILE ?? '') === 'shipped', word = process.env.TPS_LIGHTSWITCH === '1';
    line(stood === (shipped || word), 'the stand: off on the frozen stand unless its word raises it, on on the shipped one', `stood up ${stood} · ${shipped ? 'shipped' : 'frozen'}${word ? ' with TPS_LIGHTSWITCH=1' : ''}`);
    const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
    const rows = () => (g.nearby as any[]).map(r => `${r.kind}:${r.verb}`).join(' ');
    const tap = (verb: string) => { const ok = g.selectVerb('switch', verb); if (ok) { W.input.pressed.add('Space'); step(); } return ok as boolean; };
    const swBoxes = () => (g.dynBoxes as any[]).filter(b => b.mkey !== undefined && b.mkey >= (5 << 24) + 0x400000 && b.mkey < (5 << 24) + 0x800000).length;
    step(20);

    // (1) the office's plates
    put(g, !BREAK);
    const L = wallSwitches(g) as any[], of = (grp: string) => L.filter(s => s.targets[0].group === grp);
    const groups = [...new Set(L.map(s => s.targets[0].group))];
    const need = ['manager', 'server', 'storage', 'breakroom', 'conference', 'corridor'];
    line(need.every(n => of(n).length >= 1) && L.every(s => s.targets.every((t: any) => t.mains && (t.kind === 'analytic' || t.kind === 'emissive') && !/monitor|tv|logo|vending|exit|rack|beacon/.test(t.name))),
      'the office: a plate for each of its rooms\' circuits; only mains lights of the room hang off one (no screen, sign, rack or beacon)', `${L.length} plates · ${groups.join(', ')}`);
    const conf = of('conference')[0];
    line(!!conf && !(g.level.boxes[(g.col.raycast([conf.stand[0], 1.2, conf.stand[2]], [-conf.n[0], 0, -conf.n[2]], 1) ?? { index: 0 }).index].flags & BoxFlag.Glass), 'the conference room\'s front is glass: its plate hangs on the room\'s nearest plain wall instead', conf ? `at ${f2(conf.pos[0])}, ${f2(conf.pos[2])} · ${f2(flat(conf.pos, conf.door.frameCentre))} m from its door` : 'no plate');

    // (2) Sam at the manager's plate: the row, the tap, the dark
    const sw = of('manager')[0]; if (!sw) { line(false, 'the manager\'s room has a plate', 'none'); return false; }
    const lamp = sw.targets.find((t: any) => t.name === 'desk_lamp'), panel = sw.targets.find((t: any) => t.kind === 'emissive');
    const under = [lamp.pos[0], 0.9, lamp.pos[2] + 0.4] as [number, number, number];
    g.teleportPlayer([sw.stand[0], 0, sw.stand[2]]); step(2);
    const row0 = rows(), top0 = g.hover?.kind, e0 = lightEstimateAt(g, under) as number, box0 = swBoxes();
    line(top0 === 'switch' && /switch:lightsOff/.test(row0) && !/door:/.test(row0) && g.hover?.line1 === 'switch · on', 'at the plate: Space\'s row is \'lights off\', and the door beside it is out of reach from there', `rows: ${row0 || 'none'} · reads '${g.hover?.line1}' · ${f2(flat(pl.char.pos, sw.door.frameCentre))} m from the door`);
    const f0 = LIGHTSWITCH_STATS.flips, ev0 = LIGHTSWITCH_STATS.events; W.audioLog = [];
    const tapped = tap('lightsOff'); step(2);
    const e1 = lightEstimateAt(g, under) as number, clicks = (W.audioLog as any[]).filter(a => a.name === 'click' || a.name === 'lightOff').length; W.audioLog = null;
    line(tapped && !switchLit(sw) && sw.targets.every((t: any) => !t.on) && typeof lamp.handOff === 'number' && panel.handOff === undefined && e0 > 1 && e1 < e0 * 0.02 && LIGHTSWITCH_STATS.flips === f0 + 1 && LIGHTSWITCH_STATS.events === ev0 + 1 && clicks >= 2,
      'the tap: every light of the room off on the frame, the floor under the lamp dark to the light estimate, a click, one light-out raised for the one light that was burning (and only it a hand\'s)', `estimate ${f2(e0)} → ${f2(e1)} · lamp on ${lamp.on} · a hand's ${lamp.handOff} · sounds ${clicks} · events ${LIGHTSWITCH_STATS.events - ev0}`);
    line(/switch:lightsOn/.test(rows()) && swBoxes() === box0 && box0 === L.length * 3, 'the row turns to \'lights on\'; three small boxes a plate, drawn off or on', `rows: ${rows()} · ${box0} boxes for ${L.length} plates`);
    tap('lightsOn'); step(2);
    line(lamp.on && !panel.on && lamp.handOff === undefined && (lightEstimateAt(g, under) as number) > e0 * 0.9, 'the tap again: the room as the level left it — the lamp back, the panel the level left dark still dark', `lamp ${lamp.on} · panel ${panel.on} (authored ${g.authoredOn(panel)}) · estimate ${f2(lightEstimateAt(g, under))}`);

    // (3) a room the level left wholly dark: all of it, and the tubes strike
    { const br = of('breakroom')[0]; let ok = false, detail = 'no plate', own = false, ownD = 'no plate';
      if (br) { g.teleportPlayer([br.stand[0], 0, br.stand[2]]); step(2); const dark = !switchLit(br); const t = tap('lightsOn'); const struck = br.targets.filter((x: any) => x.disabledUntil >= 0).length; step(100);
        ok = dark && t && br.targets.every((x: any) => x.on && x.factor === 1 && x.disabledUntil < 0) && struck === br.targets.filter((x: any) => x.kind === 'emissive').length;
        detail = `dark at first ${dark} · ${br.targets.length} fixtures on ${br.targets.filter((x: any) => x.on).length} · struck ${struck} · steady after ${f2(100 * DT)} s ${br.targets.every((x: any) => x.factor === 1)}`;
        tap('lightsOff'); step(2);
        // … and put out again by Sam, it is nobody's to put back: a calm defender standing at its switch leaves it dark
        const gd = (g.guards as any[]).find(x => x.state === 'patrol' && !x.civ), p0 = gd ? [...gd.char.pos] : null, on0 = LIGHTSWITCH_STATS.guardOn;
        if (gd) { gd.char.pos[0] = br.floor[0]; gd.char.pos[2] = br.floor[2]; g.teleportPlayer([4, 0, 22]); step(60 * 4); gd.char.pos[0] = p0![0]; gd.char.pos[2] = p0![2]; }
        own = !!gd && !switchLit(br) && LIGHTSWITCH_STATS.guardOn === on0 && br.targets.every((x: any) => typeof x.handOff === 'number'); ownD = gd ? `${gd.callsign} ${gd.state} at the plate for 4 s · lit ${switchLit(br)} · put back ${LIGHTSWITCH_STATS.guardOn - on0}` : 'no calm man'; }
      line(ok, 'the break room, authored dark: \'lights on\' lights every panel, each striking like a tube and steady inside two seconds', detail);
      line(own, 'put out again by the same hand, a room the level left dark is nobody\'s to put back: a calm defender at its switch leaves it', ownD); }

    // (4) beside the door the tap is the door's
    { const F = sw.door, c = F.frameCentre, p: [number, number, number] = [(c[0] + sw.stand[0]) / 2 + sw.n[0] * 0.5, 0, (c[2] + sw.stand[2]) / 2 + sw.n[2] * 0.5];
      g.teleportPlayer(p); step(2); const top = g.hover?.kind, r = rows();
      line(top === 'door' && flat(pl.char.pos, sw.pos) < LIGHTSWITCH.reach, 'between the door and the plate, both in reach: the tap is still the door\'s', `top row ${top} · rows: ${r} · ${f2(flat(pl.char.pos, sw.pos))} m from the plate`); }

    // (5) a calm defender in the room comes to the switch and puts it back; one with no line does not come
    { const calm = (g.guards as any[]).filter(x => x.state === 'patrol' && !x.civ);
      const far = calm.filter(x => g.col.solidBlocked([x.char.pos[0], 1.6, x.char.pos[2]], lamp.pos) && flat(x.char.pos, sw.pos) > 4);
      g.teleportPlayer([sw.stand[0], 0, sw.stand[2]]); step(2);
      const aw0 = far.map(x => x.awareness as number); tap('lightsOff'); step(30);
      const came = far.filter((x, i) => x.awareness > aw0[i] + 0.2 || flat(x.lastKnown ?? [0, 0, 0], sw.floor) < 0.1).length;
      line(far.length > 0 && came === 0 && !switchLit(sw), 'nobody without a line to the light that went out is any the wiser', `${far.length} calm men behind walls · roused ${came}`);
      tap('lightsOn'); step(2);
      const gd = calm[0]; let lit = -1, at = '', once = 0;
      if (gd) { gd.char.pos[0] = sw.floor[0] + sw.n[0] * 2.5; gd.char.pos[2] = sw.floor[2] + sw.n[2] * 2.5; step(2); const on0 = LIGHTSWITCH_STATS.guardOn;
        tap('lightsOff'); g.teleportPlayer([4, 0, 22]);
        for (let i = 0; i < 60 * 20 && lit < 0; i++) { step(); if (switchLit(sw)) { lit = i * DT; at = `${gd.callsign} ${gd.state}, ${f2(flat(gd.char.pos, sw.pos))} m from the plate`; } }
        step(60 * 3); once = LIGHTSWITCH_STATS.guardOn - on0; at += ` · put back by a defender ${once} time(s) in the 3 s he stood there after`; }
      line(lit >= LIGHTSWITCH.guardSecs && lit < 15 && once === 1 && lamp.on && !panel.on && sw.targets.every((t: any) => t.handOff === undefined), 'a calm defender who was in the room when it went dark walks to the switch and puts the lights back — a beat after the hand, once, and as the level had them', lit >= 0 ? `${f2(lit)} s after the tap · ${at}` : `still dark after 20 s · ${gd ? `${gd.callsign} ${gd.state} ${f2(flat(gd.char.pos, sw.pos))} m off` : 'no calm man on the floor'}`); }

    // (6) a checkpoint keeps the dark room; a restart forgets it
    { LIGHTSWITCH.guards = false;   // (the man of (5) is still at the plate: he would put it back on the frame after the load, as he should)
      g.teleportPlayer([sw.stand[0], 0, sw.stand[2]]); step(2); if (switchLit(sw)) tap('lightsOff'); step(2);
      let kept = false, why = '';
      try { const s = W.snapshot('lightswitch', true); const txt = JSON.stringify(s); const back = JSON.parse(txt);
        const T = (wallSwitches(g) as any[]).find(x => x.targets[0].group === 'manager'); g.teleportPlayer([sw.stand[0], 0, sw.stand[2]]); step(2); tap('lightsOn'); step(2);
        W.restore(back); step(2);
        const l2 = (g.targets as any[]).find(t => t.name === 'desk_lamp'); kept = !l2.on && typeof l2.handOff === 'number' && /"hand":\d/.test(txt) && !!T; why = `in the file ${/"hand":\d/.test(txt)} · after the load: lamp on ${l2.on}, a hand's ${l2.handOff}`;
      } catch (e) { why = String(e).slice(0, 160); }
      line(kept, 'a checkpoint taken with the room dark loads with it dark, and still a hand\'s doing', why);
      LIGHTSWITCH.guards = was.guards;
      g.restartEncounter(); step(2);
      const l3 = (g.targets as any[]).find(t => t.name === 'desk_lamp'), L3 = wallSwitches(g) as any[];
      line(l3.on && l3.handOff === undefined && L3.length === L.length && L3.every((s, i) => flat(s.pos, L[i].pos) < 1e-6), 'a restart: the level as authored, nothing a hand\'s, the same plates in the same places', `lamp on ${l3.on} · ${L3.length} plates`); }

    // (6b) a plate goes with its wall (a stand of its own: the walls are adopted with destruction's switch up)
    { const d0 = DESTRUCTION.on; DESTRUCTION.on = true; let detail = '', ok = false;
      try { const V = await stand('office.json'), q = V.game; q.godMode = true; q.aiEnabled = false; q.tune.chaos = 0.5; put(q, !BREAK); await hushed(() => { for (let i = 0; i < 5; i++) V.step(DT); });
        const A = [...(wallSwitches(q) as any[])]; let gone: any = null, tried = 0;
        for (const s of A) { tried++; await hushed(() => { q.destr.blast([s.pos[0] + s.n[0] * 0.3, 0.3, s.pos[2] + s.n[2] * 0.3], { who: 0 }); for (let i = 0; i < 3; i++) V.step(DT); }); if (!(wallSwitches(q) as any[]).includes(s)) { gone = s; break; } }
        const now = wallSwitches(q) as any[]; q.teleportPlayer(gone ? [gone.stand[0], 0, gone.stand[2]] : [4, 0, 22]); await hushed(() => { for (let i = 0; i < 2; i++) V.step(DT); });
        const r = (q.nearby as any[]).map(x => x.kind).join(' '), whole = now.every(s => { const h = q.col.raycast([s.stand[0], LIGHTSWITCH.height, s.stand[2]], [-s.n[0], 0, -s.n[2]], 1); return !!h && Math.abs(h.t - LIGHTSWITCH.standM) < 0.03; });
        ok = !!gone && now.length < A.length && !/switch/.test(r) && whole && LIGHTSWITCH_STATS.gone > 0;
        detail = gone ? `${gone.targets[0].group}'s plate by ${gone.door.def.name}, blast ${tried} · ${A.length} → ${now.length} plates · rows there: ${r || 'none'} · every plate left on its wall ${whole}` : `no plate's wall opened in ${tried} blasts`;
      } catch (e) { detail = String(e).slice(0, 200); } finally { DESTRUCTION.on = d0; }
      line(ok, 'a wall blown out from behind its plate: the plate goes with it, no row where it hung, and every plate left has its wall', detail); }

    // (7) the switch off: no plate, no row, no box
    { put(g, false); g.teleportPlayer([sw.stand[0], 0, sw.stand[2]]); step(3);
      const none = (wallSwitches(g) as any[]).length === 0 && !/switch/.test(rows()) && swBoxes() === 0;
      line(none, 'the switch off: no plate on any wall, no row at the place one hung, no box drawn', `plates ${(wallSwitches(g) as any[]).length} · rows: ${rows() || 'none'} · boxes ${swBoxes()}`); }

    // (8) a run nobody touches a switch in is the same run, on as off
    { const run = async (on: boolean) => { const V = await stand('office.json'), q = V.game; put(q, on); await hushed(() => { for (let i = 0; i < 600; i++) V.step(DT); }); return { h: hashDigest(digestGame(q, true)) as string, n: (wallSwitches(q) as any[]).length }; };
      const off = await run(false), on = await run(!BREAK);
      line(off.h === on.h && on.n > 0 && off.n === 0, 'ten seconds of the office night with the switch on and nobody at one: the same run by digest as with it off', `off ${off.h} · on ${on.h} (${on.n} plates)`); }

    // (9) every level: each plate on plain wall, a hand's reach from floor a man can stand on, clear of every leaf
    { let files = 0, plates = 0, none: string[] = [], bad: string[] = [];
      for (const f of readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !f.includes('.lint')).sort()) {
        let q: any; try { q = (await stand(f)).game; } catch { continue; }
        files++; put(q, !BREAK); const S = wallSwitches(q) as any[]; plates += S.length;
        const lit = (q.targets as any[]).some(t => t.mains && t.kind === 'emissive' && /^(panel|tube)_/.test(t.name)); if (lit && !S.length) none.push(f);
        for (const s of S) {
          const h = q.col.raycast([s.stand[0], LIGHTSWITCH.height, s.stand[2]], [-s.n[0], 0, -s.n[2]], 1);
          const hb = h && h.index < 1e6 ? q.level.boxes[h.index] : null;
          const wall = !!hb && Math.abs(h.t - LIGHTSWITCH.standM) < 0.03 && !(hb.flags & BoxFlag.Glass) && hb.c[1] + hb.h[1] >= 2.2;
          const fit = [s.stand[0], 0, s.stand[2]]; q.col.collideCircle(fit, 0.3, 0.2, 1.5);
          const stands = flat(fit, s.stand) < 0.03 && !q.col.nav.isBlocked(s.floor[0], s.floor[2]) && flat(s.floor, s.pos) <= LIGHTSWITCH.reach && !q.col.solidBlocked([s.floor[0], 1.3, s.floor[2]], [s.pos[0] + s.n[0] * 0.05, s.pos[1], s.pos[2] + s.n[2] * 0.05]);
          const swept = (q.doors.list as any[]).some(d => q.doors.swingOf(d).sweeps(s.pos[0] + s.n[0] * 0.06, s.pos[2] + s.n[2] * 0.06, 0.05));
          const own = s.targets.length > 0 && s.targets.every((t: any) => t.mains);
          if (!wall || !stands || swept || !own) bad.push(`${f} ${s.door.def.name} (${!wall ? 'wall' : !stands ? 'floor' : swept ? 'leaf' : 'lights'})`);
        }
      }
      line(files > 20 && plates > files && bad.length === 0, 'every level file: each plate on plain solid wall that stands above a door\'s head (no panel, locker or cabinet), a man\'s place before it in a hand\'s reach, clear of every leaf\'s sweep, mains lights of its own', `${files} levels · ${plates} plates · faults: ${bad.length ? bad.slice(0, 6).join('; ') : 'none'}`);
      console.log(`    levels with ceiling lights and no plate at all: ${none.length ? none.join(', ') : 'none'}`); }

    // (10) the stands and a recording from before the table
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`);
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      LIGHTSWITCH.on = true; const old = snap(); delete old.tables.LIGHTSWITCH; J.applyKnobs(g, old); const before = LIGHTSWITCH.on;
      LIGHTSWITCH.on = true; const recOn = snap(); LIGHTSWITCH.on = false; J.applyKnobs(g, recOn); const kept = LIGHTSWITCH.on;
      line(before === false && kept === true && PR.FROZEN_HOLDS['LIGHTSWITCH.on'] === 'TPS_LIGHTSWITCH=1' && SE.STAND_ENV.includes('TPS_LIGHTSWITCH'), 'a recording from before the table replays with no switches, one made with them on replays on; the stands\' list has the row and the word',
        `a recording without the table: ${before} · recorded on: ${kept} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['LIGHTSWITCH.on'] ?? 'no row'} · STAND_ENV ${SE.STAND_ENV.includes('TPS_LIGHTSWITCH')}`); }
  } catch (e) { console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); all = false; }
  finally { Object.assign(LIGHTSWITCH, was); Object.assign(LIGHTSWITCH_STATS, stats0); Math.random = rnd; }
  console.log(`=== lightswitch: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await lightswitchCheck()) ? 0 : 1);
