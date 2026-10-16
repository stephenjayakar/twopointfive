// A CALM GUARD BURNS HIS TORCH ONLY WHERE HE NEEDS IT — the check behind src/game/calmtorch.ts (TORCH.calmOff: on in the page, ?calmtorch=0; off on the frozen
// stand, TPS_CALMTORCH=1).
//   bun run tools/qa/calmtorch-check.ts        (also `probes.ts calmtorch`)
// The office, the night shift on its own beats, Sam out of everybody's sight, the switch thrown by hand:
//   (a) at dusk, and (b) at night under the working ceiling panels: a calm man whose place has read LIT for the dwell has his torch off — asked of every man four
//       times a second over four minutes of his route, the place read again by the check itself — and a man who has stood in the DARK for the dwell (the lobby with
//       its lamps out, the break room) has it on; both must really happen on the walk;
//   (c) a blackout: every calm torch is burning inside the dwell;
//   (d) anything that is not calm is the base: suspicious / alert / searching men burn their lights in every frame of a run in which Sam is seen, a man whose
//       awareness is up burns his at once, and a torch knocked dark in a lit room comes on the frame he is no longer calm;
//   (e) no flicker: over those walks no man's torch moves twice inside a second, nor more than eight times a minute;
//   (f) a checkpoint carries the switch and its dwell: continue ≡ load, torch for torch, over ten seconds;
//   (h) a torch the rule has put out and the OCP: a man with no light on is nothing to it (lighting.ts ocpable — not offered, no charge, no line, the man
//       untouched), and the same man a frame after something has his attention burns his torch and IS the OCP's: fried, a charge spent, dark;
//   (g) the switch off = the base: nothing is asked, no man is met, every calm torch burns in every frame, and a seeded minute digests as one stood up with the
//       rule never touched.
// It prints, for each of the office's three, the share of his patrol he walks with the torch burning at night and at dusk, and where.
// CALMTORCH_BREAK=1 = the rule left on for the 'off' lines: (g) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function calmtorchCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { TORCH, TORCH_STATS, placeRead, workLit, calmTorchRuled, calmTorchOf } = await import(`${ROOT}/src/game/calmtorch.ts`);
  const { HOUR, applyHour } = await import(`${ROOT}/src/game/hours.ts`);
  const { roomOf } = await import(`${ROOT}/src/game/chronicle.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const DT = 1 / 60, rnd0 = Math.random, was = { ...TORCH }; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== calmtorch: a calm patrol burns his torch only where his place is dark ===');
  const stand = async (seed: number, hour = 'night') => { Math.random = seeded(seed); HOUR.id = 'night'; HOUR.sun = 1; const W: any = await quiet(() => standUp()); const g = W.game;
    if (hour !== 'night') applyHour(g, hour); g.playerInvisible = true; g.godMode = true; return W; };
  const staff = (g: any) => g.guards.filter((x: any) => !x.unit && x.team === 'guard');
  const burns = (gd: any) => !!gd.flashlight.enabled;
  /** frames a reading must have stood before the switch is owed (the dwell, the hold after the last click, one ask late, a frame of slack) */
  const owedOff = Math.ceil((TORCH.offSecs + TORCH.holdSecs + 2 * TORCH.askSecs) / DT) + 2, owedOn = Math.ceil((TORCH.onSecs + TORCH.holdSecs + 2 * TORCH.askSecs) / DT) + 2;

  interface Walk { name: string; n: number; on: number; flips: number[]; rooms: Map<string, [number, number]>; litOff: number; litOn: number; darkOn: number; darkOff: number; bad: string[]; }
  /** `secs` of everybody's route with the rule on: per man the share burning, the clicks, and the rule held against the check's own reading of his place */
  const walk = async (hour: string, secs: number): Promise<Walk[]> => {
    const W = await stand(11, hour), g = W.game; TORCH.calmOff = true;
    const R = new Map<any, Walk & { last: boolean | null; run: number; runOf: number }>();
    for (const gd of staff(g)) R.set(gd, { name: gd.callsign, n: 0, on: 0, flips: [], rooms: new Map(), litOff: 0, litOn: 0, darkOn: 0, darkOff: 0, bad: [], last: null, run: 0, runOf: 0 });
    for (let f = 0; f < secs * 60; f++) { W.step(DT);
      for (const gd of staff(g)) { const r = R.get(gd)!; if (gd.state !== 'patrol') { r.last = null; r.run = 0; continue; }
        const on = burns(gd), ruled = calmTorchRuled(g, gd); r.n++; if (on) r.on++;
        const room = roomOf(gd.char.pos, g.level), rr = r.rooms.get(room) ?? [0, 0]; rr[0]++; if (on) rr[1]++; r.rooms.set(room, rr);
        if (r.last !== null && r.last !== on) r.flips.push(f * DT); r.last = on;
        if (!ruled) { r.run = 0; continue; }
        { const read = placeRead(g, gd); if (read === r.runOf) r.run++; else { r.runOf = read; r.run = 0; } }   // (the check's own reading, EVERY frame: the rule asks four times a second on a frame of its own, so a reading that
                                                                                                              //  dips for one frame can fall on the rule's ask and restart its dwell; read every fifth frame the check missed such a dip — Reyes in the break room
                                                                                                              //  once real-size doors moved his walk — and called the two seconds that followed 22 frames against the rule)
        if (r.runOf === 1 && r.run >= owedOff) { if (on) { r.litOn++; if (r.bad.length < 3) r.bad.push(`burning at ${(f * DT).toFixed(1)} s in ${room} after ${(r.run * DT).toFixed(1)} s of lit floor`); } else r.litOff++; }
        if (r.runOf === -1 && r.run >= owedOn) { if (!on) { r.darkOff++; if (r.bad.length < 3) r.bad.push(`dark at ${(f * DT).toFixed(1)} s in ${room} after ${(r.run * DT).toFixed(1)} s of dark floor`); } else r.darkOn++; } } }
    return [...R.values()];
  };
  const share = (w: Walk) => `${w.name}: torch on ${(100 * w.on / Math.max(1, w.n)).toFixed(0)} % of his patrol (${[...w.rooms].filter(([, v]) => v[0] >= 60).map(([k, v]) => `${k} ${(100 * v[1] / v[0]).toFixed(0)} %`).join(' · ')}) · ${w.flips.length} clicks`;
  const gapOf = (w: Walk) => { let m = Infinity; for (let i = 1; i < w.flips.length; i++) m = Math.min(m, w.flips[i] - w.flips[i - 1]); return m; };
  const SECS = 240;
  try {
    // (a) dusk · (b) night · (e) no flicker
    const dusk = await walk('dusk', SECS), night = await walk('night', SECS);
    console.log(`  the rule: lit = ${TORCH.litAt} on the meter there or on floor in view within ${TORCH.spillM} m (by day, daylit floor within ${TORCH.dayM} m), ${TORCH.aheadM} m down his way; on after ${TORCH.onSecs} s of dark, off after ${TORCH.offSecs} s of lit floor`);
    for (const [h, ws] of [['at night', night], ['at dusk', dusk]] as const) for (const w of ws) console.log(`  ${h} — ${share(w)}`);
    { const off = dusk.reduce((a, w) => a + w.litOff, 0), bad = dusk.reduce((a, w) => a + w.litOn + w.darkOff, 0);
      const open = dusk.map(w => { const v = w.rooms.get('cubicles') ?? w.rooms.get('the cubicles') ?? [0, 0]; return v; }).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
      line(off > 600 && bad === 0, 'dusk: a calm man on lit floor for the dwell walks with his torch off, in every frame asked', `${off} man-frames owed dark, all dark · ${bad} against the rule${dusk.flatMap(w => w.bad).length ? ' · ' + dusk.flatMap(w => w.bad).join(' | ') : ''}${open[0] ? ` · in the open office the torch burns ${(100 * open[1] / open[0]).toFixed(0)} % of the time` : ''}`); }
    { const off = night.reduce((a, w) => a + w.litOff, 0), on = night.reduce((a, w) => a + w.darkOn, 0), bad = night.reduce((a, w) => a + w.litOn + w.darkOff, 0);
      const darkRooms = [...new Set(night.flatMap(w => [...w.rooms].filter(([, v]) => v[0] >= 60 && v[1] / v[0] > 0.4).map(([k]) => k)))], litRooms = [...new Set(night.flatMap(w => [...w.rooms].filter(([, v]) => v[0] >= 60 && v[1] / v[0] < 0.1).map(([k]) => k)))];
      line(off > 600 && on > 300 && bad === 0 && darkRooms.length > 0, 'night: off under the working lights, on in the dark rooms — both happen on the walk, and no frame goes against the dwell', `${off} man-frames owed dark, ${on} owed burning · ${bad} against the rule${night.flatMap(w => w.bad).length ? ' · ' + night.flatMap(w => w.bad).join(' | ') : ''} · burning over 40 % of a man's time in: ${darkRooms.join(', ') || '—'} · under 10 % in: ${litRooms.join(', ') || '—'}`); }
    { const ws = [...dusk, ...night], worst = Math.min(...ws.map(gapOf)), most = Math.max(...ws.map(w => w.flips.length / (SECS / 60)));
      line(worst >= 1 && most <= 8, 'no flicker: no torch moves twice inside a second, nor more than eight times a minute, on either walk', `shortest gap between two clicks ${Number.isFinite(worst) ? worst.toFixed(2) + ' s' : 'none'} · most clicks ${most.toFixed(1)} a minute`); }

    // (c) a blackout
    { const W = await stand(12), g = W.game; TORCH.calmOff = true; let dark0 = 0;
      for (let i = 0; i < 60 * 40 && dark0 < 2; i++) { W.step(DT); dark0 = staff(g).filter((x: any) => !burns(x)).length; }   // (until two of them walk dark)
      g.setBlackout(60, 'debug'); let at = -1; const lim = Math.ceil((TORCH.onSecs + TORCH.askSecs + TORCH.holdSecs) / DT) + 3;
      for (let i = 1; i <= lim * 2; i++) { W.step(DT); if (staff(g).every((x: any) => x.state === 'dead' || burns(x))) { at = i; break; } }
      line(dark0 >= 2 && at >= 0 && at <= lim, 'a blackout: every torch of the shift is burning inside the dwell', `${dark0} walked dark before it · all burning ${at < 0 ? 'never' : (at * DT).toFixed(2) + ' s'} after the mains went (the bar is ${(lim * DT).toFixed(2)} s)`); }

    // (d) not calm = the base
    { const W = await stand(13), g = W.game; TORCH.calmOff = true; let man: any = null;
      for (let i = 0; i < 60 * 60 && !man; i++) { W.step(DT); man = staff(g).find((x: any) => !burns(x) && calmTorchOf(x)?.dark && calmTorchOf(x)?.read === 1) ?? null; }   // a man walking dark through a lit place
      let awOn = false, stOn = false;
      if (man) { const snap = W.snapshot('calm', true);
        man.awareness = TORCH.calmAw + 0.05; W.step(DT); awOn = burns(man);   // something has his attention
        Math.random = seeded(13); W.restore(snap); const m2 = staff(g).find((x: any) => x.callsign === man.callsign); const lit = workLit(g, m2.char.pos[0], m2.char.pos[2]);
        const dark2 = !burns(m2); m2.state = 'suspicious'; m2.awareness = 0.6; m2.lastKnown = [m2.char.pos[0] + 2, 0, m2.char.pos[2]]; W.step(DT); stOn = dark2 && lit && burns(m2); }
      line(!!man && awOn && stOn, 'a man walking dark through a lit place: his light is on the frame something has his attention, and the frame he is suspicious', man ? `${man.callsign} · awareness up → ${awOn ? 'burning' : 'DARK'} · suspicious (restored dark from the checkpoint) → ${stOn ? 'burning' : 'DARK'}` : 'nobody walked dark inside a minute');
      // a run in which Sam is seen: every frame of every man who is not on a calm patrol
      // (the shipped stand's close-in rule lets a calm man pass Sam unseen in the dark short of touching him — `CLOSE.dark`, close.ts closeNearK — and Novak's waypoint is dark: nobody
      //  was raised there and the line counted 0 frames. This line is about the lights of raised men, not about how they come to be raised: that one term is held off for the walk)
      const { CLOSE } = await import(`${ROOT}/src/game/close.ts`); const closeDark = CLOSE.dark; CLOSE.dark = false;
      const W2 = await stand(14), g2 = W2.game; TORCH.calmOff = true; g2.playerInvisible = false; let hot = 0, darkHot = 0; const seen = new Set<string>(), prev = new Map<any, boolean>();
      const novak = staff(g2).find((x: any) => x.callsign === 'Novak') ?? staff(g2)[0], wp = novak.route.points[1] ?? novak.route.points[0]; g2.teleportPlayer([wp[0], 0, wp[2]]);
      for (let i = 0; i < 60 * 45; i++) { W2.step(DT);
        for (const gd of staff(g2)) { const calm = gd.state === 'patrol', wasCalm = prev.get(gd) ?? true; prev.set(gd, calm);   // (a man another man's radio raised after his own update shows it on his next frame, as his gun does)
          if (calm || wasCalm || gd.state === 'dead' || gd.held || gd.torchLostAt >= 0 || g2.time < gd.lightDeadUntil + 1) continue; hot++; seen.add(gd.state); if (!burns(gd)) darkHot++; } }
      line(hot > 300 && darkHot === 0, 'Sam stood on a man\'s beat: every suspicious / alert / searching frame of the shift has its light burning, as the base', `${hot} man-frames (${[...seen].join(', ')}) · ${darkHot} dark`); CLOSE.dark = closeDark; }

    // (h) the OCP and a torch the rule has put out
    { const { ocp, ocpable } = await import(`${ROOT}/src/game/lighting.ts`);
      const W = await stand(13), g = W.game; TORCH.calmOff = true; let man: any = null;
      for (let i = 0; i < 60 * 60 && !man; i++) { W.step(DT); man = staff(g).find((x: any) => !burns(x) && calmTorchOf(x)?.dark && calmTorchOf(x)?.read === 1) ?? null; }   // a man walking dark through a lit place
      let ok = false, said = 'nobody walked dark inside a minute';
      if (man) { const o = g.player.ocp, aim = () => { g.aimTarget = null; g.aimGuard = man; o.charge = 1; }, texts = () => g.messages.map((m: any) => String(m.text)).join('\n');
        aim(); const t0 = texts(), dead0 = man.lightDeadUntil, aw0 = man.awareness, offered = ocpable(g); ocp(g, null);
        const spent = o.charge < 1 - 1e-6, lined = texts() !== t0, touched = man.lightDeadUntil !== dead0 || man.awareness !== aw0;
        man.awareness = TORCH.calmAw + 0.05; W.step(DT); const lit = burns(man);   // something has his attention: it burns (line (d)) — and now it is a light like any other
        aim(); const offered2 = ocpable(g); ocp(g, null); const fried = man.lightDeadUntil > g.time, spent2 = o.charge < 1 - 1e-6, told = /flashlight fried/.test(texts()); W.step(DT); const out = !burns(man);
        ok = !offered && !spent && !lined && !touched && lit && offered2 && fried && spent2 && told && out;
        said = `${man.callsign}, torch off by the rule: offered ${offered} · charge spent ${spent} · a line ${lined} · the man touched ${touched} — then his attention up: burning ${lit} · offered ${offered2} · fried ${fried} · charge spent ${spent2} · said so ${told} · dark the frame after ${out}`; }
      line(ok, 'a torch the rule has put out is nothing to the OCP (not offered, no charge, no line, the man untouched); burning again the frame something has his attention, it is the OCP\'s like any light', said); }

    // (f) a checkpoint: continue ≡ load
    { const W = await stand(15), g = W.game; TORCH.calmOff = true; for (let i = 0; i < 60 * 20; i++) W.step(DT);   // (twenty seconds in: one man is part way through his dwell, and nobody is mid-chat — the base's own continue ≡ load does not hold through two men talking)
      const snap = W.snapshot('calm', true), carried = Array.isArray(snap.calmTorch) && snap.calmTorch.some((m: any) => m);
      const run = () => { Math.random = seeded(99); let s = ''; for (let i = 0; i < 600; i++) { W.step(DT); s += staff(g).map((x: any) => burns(x) ? '1' : '0').join('') + (i % 60 === 59 ? hashDigest(digestGame(g, true)) + ' ' : ''); } return s; };
      const a = run(); W.restore(snap); const b = run(); const flips = (a.match(/01|10/g) ?? []).length;
      line(carried && a === b, 'a checkpoint carries each man\'s switch and dwell: ten seconds continued and ten seconds after a load are the same torches and the same game', `slice in the file ${carried} · timelines equal ${a === b}${a === b ? '' : ` (first difference at character ${[...a].findIndex((c, i) => c !== b[i])})`} · ${flips ? 'torches moved in the stretch' : 'no torch moved in the stretch'}`); }

    // (g) off = the base
    { const minute = async (touch: boolean) => { const W = await stand(16), g = W.game;
        if (touch) { TORCH.calmOff = true; for (let i = 0; i < 30; i++) W.step(DT); TORCH.calmOff = process.env.CALMTORCH_BREAK === '1'; Math.random = seeded(16); const W3 = await quiet(() => standUp()); W3.game.playerInvisible = true; W3.game.godMode = true; TORCH.calmOff = process.env.CALMTORCH_BREAK === '1'; return run(W3); }
        TORCH.calmOff = false; return run(W); };
      const run = (W: any) => { const g = W.game, asks0 = TORCH_STATS.asks; let s = '', darkCalm = 0, met = 0; Math.random = seeded(161);
        for (let i = 0; i < 3600; i++) { W.step(DT); for (const gd of staff(g)) if (gd.state === 'patrol' && !burns(gd) && gd.torchLostAt < 0 && g.time >= gd.lightDeadUntil + 1) darkCalm++; if (i % 60 === 59) s += hashDigest(digestGame(g, true)) + ' '; }
        for (const gd of staff(g)) if (calmTorchOf(gd)) met++;
        return { s, darkCalm, asks: TORCH_STATS.asks - asks0, met }; };
      const base = await minute(false), off = await minute(true);
      line(off.asks === 0 && off.met === 0 && off.darkCalm === 0 && base.darkCalm === 0 && off.s === base.s, 'the switch off: nothing is asked, nobody is met, every calm torch burns in every frame, and a seeded minute digests as the stand that never had the rule on', `asks ${off.asks} · men met ${off.met} · calm frames with a dark torch ${off.darkCalm} (base ${base.darkCalm}) · sixty digests equal ${off.s === base.s}`); }
  } finally { Object.assign(TORCH, was); Math.random = rnd0; HOUR.id = 'night'; }
  console.log(`=== calmtorch: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await calmtorchCheck()) ? 0 : 1);
