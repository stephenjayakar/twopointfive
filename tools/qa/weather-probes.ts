// The 'weather' family (game/weather.ts — E10: the night storm; the experiment's fire-exit mist was cut at the merge), run through probes.ts:
//   bun run tools/qa/probes.ts weather | weather-scheduler | weather-flash | weather-thunder | weather-smoke | weather-off | weather-daylight   [--verbose]
// PASS / FAIL each, all headless (the Weather the Game constructs, stepped in main.ts's order by the harness):
//   weather-scheduler   the storm's dice are its own and seeded: two runs on one seed strike at the same times from the same bearings and distances, another seed
//                       differs; the first stroke comes 6‥12 s in, every later gap sits inside the brief's band (8‥25 s mean × the 0.5‥1.5 jitter), and nothing
//                       the weather does draws from Math.random (a seeded game sequence comes out the same with the storm on and off)
//   weather-flash       strike() puts ONE light in the set — kind 2, transient, named 'lightning' — lit from that frame, its intensity the two-return-stroke envelope
//                       integrated per frame (the energy a stroke delivers is the same at 60 and at 20 fps, and equals peak × Σ amp·τ), gone inside FLASH_SECS + a
//                       frame with the set and the upload count back to what they were
//   weather-thunder     the thunder is played distance / 343 s after the stroke (± a frame), near strokes crack ('thunderNear', brighter, louder), far ones roll
//                       ('thunderFar', low-passed harder, slower); it is ambience — no GameEvent of any kind comes of a storm, and calm men stay at awareness 0
//                       through a minute of it (headless there is no probe to light Sam: the flash's own, real, effect on eyes is measured in the browser — EXPERIMENT.md)
//   weather-smoke       the storm never touches the smoke solver: a minute of it beside the fire exit, shut then open, with strokes — not one emitter (the
//                       experiment's ground mist there was cut at the merge; this holds the cut)
//   weather-off         disabled before the first step (= ?noweather) the storm touches nothing: light set, asphalt albedo / flags and settings.gloss are exactly a
//                       fresh Game's after a minute; enabled for a minute then disabled → the same (everything it touched put back, no 'lightning' left, frame zeroed)
//   weather-daylight    day (setDaylight, the breach's variant) holds the storm: a stroke in progress is taken out, none fire by day, and the breach-daylight round
//                       trip (light list / sky / switches bit for bit) still holds with the weather on; night again → strokes resume
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const { Weather, strokeMean } = await import(`${ROOT}/src/game/weather.ts`);
const { setDaylight, isDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function lightList(engine: any): string {
  return engine.lights.lights.map((l: any) => `${l.name}:${l.kind}:${l.enabled ? 1 : 0}:${l.peakIntensity.toFixed(3)}:${l.color.map((c: number) => c.toFixed(3)).join(',')}:${/^beacon|^flashlight|pistol_light|^cam_/.test(l.name) ? '-' : l.dir.map((c: number) => c.toFixed(3)).join(',')}:${l.radius.toFixed(3)}`).join('|');
}
function upload(W: any) { W.engine.lights.upload(W.game.time); }
const asphaltOf = (engine: any) => engine.world.statics.find((b: any) => b.c[1] < 0 && b.c[1] + b.h[1] > -0.01 && b.h[0] > 15 && b.h[2] > 10);
const lotState = (W: any) => { const a = asphaltOf(W.engine); return `albedo ${a.albedo.map((x: number) => x.toFixed(4)).join(',')} flags ${a.flags} gloss ${W.engine.settings.gloss}`; };
/** park everybody: nobody walks, hears or shoots — the storm alone acts */
function quiet(W: any) { const { game } = W; game.playerInvisible = true; game.godMode = true; for (const gd of game.guards) { gd.hold = true; gd.pinned = true; } }

// ---------------------------------------------------------------- weather-scheduler
export async function weatherScheduler() {
  const F = family('weather-scheduler: seeded, banded, and off the game\'s dice (weather.ts gap / strike)');
  const record = async (seed: number, gameSeed: number, secs: number, storm = 1) => {
    Math.random = seeded(gameSeed);
    const W = await standUp(); quiet(W);
    const wx = W.game.weather; wx.seed(seed); wx.storm = storm;
    const strokes: { t: number; bearing: number; distKm: number; peak: number }[] = [];
    let last = 0;
    for (let i = 0; i < secs / DT; i++) { W.step(DT); if (wx.stats.flashes > strokes.length && wx.flash) strokes.push({ t: W.game.time, bearing: wx.flash.bearing, distKm: wx.flash.distKm, peak: wx.flash.peak }); last = W.game.time; }
    return { strokes, sig: strokes.map(s => `${f2(s.t)}@${f2(s.bearing)}/${f2(s.distKm)}/${f2(s.peak)}`).join(' '), last, mathRandomAfter: Math.random() };
  };
  const A = await record(77, 5, 120), B = await record(77, 5, 120), C = await record(78, 5, 120);
  { const f: string[] = [];
    if (A.strokes.length < 4) f.push(`only ${A.strokes.length} strokes in 120 s at storm 1`);
    if (A.sig !== B.sig) f.push(`same seed, different strokes:\n      ${A.sig}\n      ${B.sig}`);
    if (A.sig === C.sig) f.push('a different seed gave the same strokes');
    F.verdict(f.length === 0, 'two runs on seed 77 strike identically (time, bearing, distance, peak); seed 78 does not', f.join('; ') || `${A.strokes.length} strokes: ${A.sig.slice(0, 160)}…`); }
  { const f: string[] = [];
    const t0 = A.strokes[0]?.t ?? Infinity; if (!(t0 >= 6 - DT && t0 <= 12.6)) f.push(`first stroke at ${f2(t0)} s (want 6‥12)`);   // (+ up to 0.5 s: the schedule is checked once a frame and starts at the first update)
    const gaps = A.strokes.slice(1).map((s, i) => s.t - A.strokes[i].t);
    const lo = 8 * 0.5 - 0.05, hi = 25 * 1.5 + 0.05;
    const bad = gaps.filter(g => g < lo || g > hi); if (bad.length) f.push(`gaps outside ${lo}‥${hi}: ${bad.map(f2).join(', ')}`);
    const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length); if (gaps.length >= 3 && (mean < 6 || mean > 20)) f.push(`mean gap ${f2(mean)} s at storm 1 (want ≈ 11)`);
    F.verdict(f.length === 0, 'first stroke 6‥12 s in; every later gap inside the band (4‥37.5 s), mean near the authored 11 s at storm 1', f.join('; ') || `first ${f2(t0)} s; gaps ${gaps.map(f2).join(', ')} (mean ${f2(mean)})`); }
  { // the game's own dice: a seeded run with the storm ON and one with it OFF must leave Math.random at the same place (the weather never draws from it)
    Math.random = seeded(9); const W1 = await standUp(); quiet(W1); W1.game.weather.storm = 1; for (let i = 0; i < 40 / DT; i++) W1.step(DT); const r1 = Math.random(); const n1 = W1.game.weather.stats.flashes;
    Math.random = seeded(9); const W2 = await standUp(); quiet(W2); W2.game.weather.setEnabled(false); for (let i = 0; i < 40 / DT; i++) W2.step(DT); const r2 = Math.random();
    const f: string[] = []; if (r1 !== r2) f.push(`Math.random diverged (on ${r1} vs off ${r2})`); if (n1 < 1) f.push('no stroke fired in the on run (nothing was tested)');
    F.verdict(f.length === 0, 'a seeded 40 s with the storm on and with it off leave Math.random at the same value (strokes, thunder, remarks all on the weather\'s own dice)', f.join('; ') || `${n1} strokes in the on run; Math.random() after both = ${r1.toFixed(6)}`); }
  return F.done();
}

// ---------------------------------------------------------------- weather-flash
export async function weatherFlash() {
  const F = family('weather-flash: one transient kind-2 light per stroke, the envelope\'s energy whatever the frame rate, gone with the set restored (weather.ts strike / applyFlash)');
  for (const dt of [1 / 60, 1 / 20]) {
    Math.random = seeded(3);
    const W = await standUp(); quiet(W); const { game, engine } = W;
    const wx = game.weather; wx.storm = 0;   // no scheduled strokes: only the one fired here
    for (let i = 0; i < 30; i++) W.step(dt);
    upload(W); const n0 = engine.lights.lights.length, up0 = engine.lights.activeCount, L0 = lightList(engine);
    const fl = wx.strike({ bearing: Math.PI, elevDeg: 30, distKm: 2.0, peak: 18 });
    const f: string[] = [];
    if (!fl) f.push('strike() returned null');
    const li = engine.lights.lights.find((l: any) => l.name === 'lightning');
    if (!li) f.push("no 'lightning' in the set after strike()");
    else { if (li.kind !== 2) f.push(`kind ${li.kind}`); if (!li.transient) f.push('not flagged transient'); if (li.ttl >= 0) f.push(`ttl ${li.ttl} (the LightSet envelope would fight the stroke's)`); if (!(li.intensity > 0)) f.push(`intensity ${li.intensity} on the strike frame`); if (Math.abs(v3.len(li.dir) - 1) > 1e-6) f.push('dir not unit'); if (!(li.dir[1] < 0)) f.push('dir does not point down'); }
    upload(W); if (engine.lights.activeCount !== up0 + 1) f.push(`${engine.lights.activeCount} uploaded on the strike frame (want ${up0 + 1})`);
    // step through the flash: integrate what the frames showed (step i draws the envelope over [(i − 1)·dt, i·dt] — weather.ts update)
    let energy = 0, frames = 0, maxI = li?.intensity ?? 0, goneAt = -1, everTwo = false;
    for (let i = 1; i <= Math.ceil(1.0 / dt); i++) {
      W.step(dt); upload(W);
      const cur = engine.lights.lights.filter((l: any) => l.name === 'lightning');
      if (cur.length > 1) everTwo = true;
      if (cur.length === 1) { energy += cur[0].intensity * dt; if (cur[0].intensity > 0) frames++; maxI = Math.max(maxI, cur[0].intensity); }
      else if (goneAt < 0) goneAt = i * dt;
    }
    const want = 18 * fl!.stroke.pulses.reduce((s: number, p: any) => s + p.amp * p.tau * (1 - Math.exp(-(0.5 - p.t0) / p.tau)), 0);   // ∫₀^FLASH_SECS peak·Σ amp e^{−(t−t0)/τ} dt (FLASH_SECS 0.5; the frames cover [0, ≥ 0.5])
    if (Math.abs(energy - want) / want > 0.03) f.push(`energy ${energy.toFixed(4)} vs ${want.toFixed(4)} (${(100 * (energy / want - 1)).toFixed(1)} %)`);
    if (goneAt < 0) f.push('light still in the set a second later'); else if (goneAt > 0.5 + 3 * dt + 1e-9) f.push(`light gone only at ${f2(goneAt)} s (FLASH_SECS 0.5)`);
    if (everTwo) f.push('two lightning lights at once');
    upload(W); const L1 = lightList(engine);
    if (engine.lights.lights.length !== n0 || engine.lights.activeCount !== up0) f.push(`set ${engine.lights.lights.length}/${n0}, uploaded ${engine.lights.activeCount}/${up0} after`);
    if (L1 !== L0) f.push('light list after ≠ before');
    if (wx.flash) f.push('weather.flash still set');
    F.verdict(f.length === 0, `${Math.round(1 / dt)} fps: one 'lightning' (kind 2, transient, ttl −1, pointing down) lit on the strike frame, +1 uploaded, energy = peak × Σ amp·τ within 3 %, gone by FLASH_SECS (+2 frames), set and upload count restored, list identical`,
      f.join('; ') || `${frames} lit frames, max I ${f2(maxI)} (peak 18 × first-frame mean ${f2(strokeMean(fl!.stroke, 0, dt))}), energy ${energy.toFixed(3)} vs ${want.toFixed(3)}, gone at ${f2(goneAt)} s; ${n0} lights / ${up0} uploaded before and after`);
  }
  return F.done();
}

// ---------------------------------------------------------------- weather-thunder
export async function weatherThunder() {
  const F = family('weather-thunder: distance ÷ 343 later, shaped by distance, and nobody\'s noise (weather.ts playThunder)');
  Math.random = seeded(4);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true;
  for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.awareness = 0; }   // planted calm men with their ears open
  game.teleportPlayer([5.0, 0, 23.0]); game.player.crouch = true;   // Sam still in the lobby corner, out of everyone's way
  const wx = game.weather; wx.storm = 0;
  for (let i = 0; i < 60; i++) W.step(DT);
  W.audioLog = [];
  const ev0 = game.events.length; const kinds = new Set<string>(); let maxAw = 0;
  const cases = [{ distKm: 0.5, bearing: Math.PI / 2 }, { distKm: 1.2, bearing: Math.PI }, { distKm: 3.4, bearing: -Math.PI / 2 }];
  const rows: string[] = []; const f: string[] = [];
  for (const c of cases) {
    const t0 = game.time; wx.strike({ ...c, elevDeg: 30, peak: 16 });
    const due = c.distKm * 1000 / 343;
    let played: any = null;
    for (let i = 0; i < (due + 1.5) / DT; i++) { W.step(DT); for (const e of game.events) kinds.add(e.kind); for (const gd of game.guards) maxAw = Math.max(maxAw, gd.awareness); if (!played) played = W.audioLog!.find((a: any) => /^thunder/.test(a.name) && a.t > t0) ?? null; }
    if (!played) { f.push(`${c.distKm} km: no thunder played within ${f2(due + 1.5)} s`); continue; }
    const delay = played.t - t0;
    if (Math.abs(delay - due) > DT + 1e-6) f.push(`${c.distKm} km: thunder after ${delay.toFixed(3)} s (want ${due.toFixed(3)} ± a frame)`);
    const wantName = c.distKm < 1.3 ? 'thunderNear' : 'thunderFar'; if (played.name !== wantName) f.push(`${c.distKm} km: played ${played.name} (want ${wantName})`);
    if (played.pos !== null) f.push(`${c.distKm} km: positional (pos ${played.pos})`);
    rows.push(`${c.distKm} km → ${played.name} after ${delay.toFixed(2)} s (due ${due.toFixed(2)}), gain ${f2(played.gain)}, lowpass ${Math.round(played.opts?.lowpass)} Hz, rate ${f2(played.opts?.rate)}, pan ${f2(played.opts?.pan)}`);
    (c as any).played = played;
    W.audioLog!.length = 0;
  }
  { const P = cases.map(c => (c as any).played).filter(Boolean);
    if (P.length === 3) { if (!(P[0].opts.lowpass > P[1].opts.lowpass && P[1].opts.lowpass > P[2].opts.lowpass)) f.push(`lowpass not falling with distance (${P.map((p: any) => Math.round(p.opts.lowpass)).join(' > ')})`); if (!(P[0].gain > P[2].gain)) f.push(`near not louder than far (${f2(P[0].gain)} vs ${f2(P[2].gain)})`); if (!(P[0].opts.rate > P[2].opts.rate)) f.push('near not quicker than far'); }
    F.verdict(f.length === 0, 'each stroke\'s thunder plays distance ÷ 343 s later (± a frame), non-positional, near = thunderNear / far = thunderFar, duller, quieter and slower with every kilometre', f.join('; ') || rows.join('\n    ')); }
  { const g: string[] = [];
    for (let i = 0; i < 20 / DT; i++) { W.step(DT); for (const e of game.events) kinds.add(e.kind); for (const gd of game.guards) maxAw = Math.max(maxAw, gd.awareness); }
    if (game.events.length !== ev0 || kinds.size) g.push(`events during the storm: ${[...kinds].join(', ') || game.events.length}`);
    if (maxAw > 1e-9) g.push(`a guard's awareness reached ${maxAw.toFixed(3)}`);
    if (game.guards.some((gd: any) => gd.state !== 'patrol')) g.push(`states ${game.guards.map((gd: any) => gd.state).join('/')}`);
    F.verdict(g.length === 0, 'three strokes and their thunder over ~40 s: not one GameEvent, every planted man still on patrol at awareness 0 (thunder is ambience; headless nothing lights Sam)', g.join('; ') || `${wx.stats.flashes} strokes, ${wx.stats.thunders} thunders, ${wx.stats.barks} remarks; events ${game.events.length}; max awareness ${maxAw}`); }
  return F.done();
}

// ---------------------------------------------------------------- weather-smoke
export async function weatherSmoke() {
  const F = family('weather-smoke: the storm never emits into the smoke field (the fire-exit mist was cut at the merge)');
  Math.random = seeded(6);
  const W = await standUp(); quiet(W); const { game } = W;
  const emits: any[] = []; W.smoke.emit = (e: any) => { emits.push({ ...e, t: game.time }); };   // the harness's null smoke, now counting
  const wx = game.weather; wx.storm = 1;
  const door = game.doors.byName('fire_exit');
  const f: string[] = [];
  if ('mist' in wx) f.push("Weather still has a 'mist' member");
  game.teleportPlayer([33.0, 0, 20.5]); for (let i = 0; i < 30 / DT; i++) W.step(DT);
  door.latched = false; door.angle = 1.7; door.vel = 0; door.def.closer = false;
  for (let i = 0; i < 30 / DT; i++) W.step(DT);
  if (emits.length) f.push(`${emits.length} smoke emits from a minute of storm by the fire exit`);
  if (wx.stats.flashes < 1) f.push('no stroke fired in the minute (nothing was tested against strokes)');
  F.verdict(f.length === 0, 'a minute of storm 1 beside the fire exit (shut 30 s, open 30 s, strokes firing): zero smoke emitters, no mist knob left on the object', f.join('; ') || `${wx.stats.flashes} strokes, ${emits.length} emits`);
  return F.done();
}

// ---------------------------------------------------------------- weather-off
export async function weatherOff() {
  const F = family('weather-off: ?noweather touches nothing; on-then-off puts everything back (weather.ts setEnabled / teardown)');
  const fresh = async () => { Math.random = seeded(8); const W = await standUp(); quiet(W); return W; };
  // reference: a Game nobody steps (the level as constructed) — and one stepped a minute with the weather off from the start
  const R = await fresh(); upload(R); const refLot = lotState(R);
  const A = await fresh(); A.game.weather.setEnabled(false); for (let i = 0; i < 60 / DT; i++) A.step(DT); upload(A);
  { const f: string[] = [];
    if (lotState(A) !== refLot) f.push(`lot: ${lotState(A)} vs ${refLot}`);
    if (A.engine.lights.lights.some((l: any) => l.name === 'lightning' || l.group === 'weather')) f.push('a weather light in the set');
    const wf = A.engine.weather; if (wf && (wf.rain !== 0 || wf.wet !== 0 || wf.flash.some((x: number) => x !== 0))) f.push(`frame not zero: ${JSON.stringify(wf)}`);
    if (A.game.weather.stats.flashes || A.game.weather.stats.thunders) f.push(`strokes ${A.game.weather.stats.flashes} thunders ${A.game.weather.stats.thunders}`);
    // the light list against a run of the same seed with the weather merely between strokes is the same list: compare with a storm-0 enabled run
    const B = await fresh(); B.game.weather.storm = 0; for (let i = 0; i < 60 / DT; i++) B.step(DT); upload(B);
    if (lightList(A.engine) !== lightList(B.engine)) f.push('light list differs from an enabled (storm 0) run of the same seed');
    F.verdict(f.length === 0, 'disabled before the first step: after a minute the asphalt\'s albedo / flags and settings.gloss are the constructed level\'s, no weather light exists, the frame block is zero, nothing fired — and the light list equals an enabled run\'s between strokes', f.join('; ') || `${refLot}; ${A.engine.lights.lights.length} lights`); }
  { const C = await fresh(); const wx = C.game.weather; wx.storm = 1;
    for (let i = 0; i < 45 / DT; i++) C.step(DT);
    const during = lotState(C); const hadStroke = wx.stats.flashes > 0;
    wx.strike({ distKm: 3 });   // a stroke in progress and thunder pending at the moment it is switched off
    C.step(DT); wx.setEnabled(false); for (let i = 0; i < 5 / DT; i++) C.step(DT); upload(C);
    const f: string[] = [];
    if (during === refLot) f.push(`the lot never got wet in 45 s of rain (${during})`);
    if (lotState(C) !== refLot) f.push(`lot after off: ${lotState(C)} vs ${refLot}`);
    if (C.engine.lights.lights.some((l: any) => l.name === 'lightning')) f.push('lightning still in the set');
    if (wx.flash || wx.thunders.length) f.push(`flash ${!!wx.flash} thunders ${wx.thunders.length}`);
    const wf = C.engine.weather; if (wf && (wf.rain !== 0 || wf.wet !== 0)) f.push(`frame not zero: rain ${wf.rain} wet ${wf.wet}`);
    if (!hadStroke) f.push('no scheduled stroke in 45 s at storm 1 (nothing was live to tear down)');
    const asphalt = asphaltOf(C.engine); if (asphalt.flags & BoxFlag.Gloss) f.push('asphalt still Gloss');
    F.verdict(f.length === 0, 'a minute of storm (lot wet: darker + Gloss + settings.gloss on, strokes fired) then off mid-stroke: lot state = the constructed level\'s, no lightning, no pending thunder, frame zeroed', f.join('; ') || `wet: ${during} → off: ${lotState(C)}; ${wx.stats.flashes} strokes before`); }
  return F.done();
}

// ---------------------------------------------------------------- weather-daylight
export async function weatherDaylight() {
  const F = family('weather-daylight: day holds the storm and the daylight round trip still closes bit for bit with it on (weather.ts suspended × lighting.ts setDaylight)');
  Math.random = seeded(3);
  const W = await standUp(); quiet(W); const { game, engine } = W;
  const wx = game.weather; wx.storm = 1;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.setBlackout(30, 'debug'); for (let i = 0; i < 5; i++) W.step(DT); game.endBlackout(); for (let i = 0; i < 6 / DT; i++) W.step(DT);
  // sample the night list BETWEEN strokes (a stroke is legitimately in the list while it burns)
  while (wx.flash) W.step(DT);
  upload(W); const L0 = lightList(engine), S0 = JSON.stringify({ z: engine.settings.skyZenith, h: engine.settings.skyHorizon, haze: engine.settings.hazeDensity }), sw0 = game.targets.map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join('|');
  const f: string[] = [];
  wx.strike({ distKm: 2.5 }); W.step(DT); if (!wx.flash) f.push('no stroke to interrupt');
  setDaylight(game, true); W.step(DT);
  if (wx.flash) f.push('stroke survived into the day'); if (engine.lights.lights.some((l: any) => l.name === 'lightning')) f.push('lightning in the day set'); if (wx.thunders.length) f.push('thunder still pending by day');
  const n0 = wx.stats.flashes; for (let i = 0; i < 40 / DT; i++) W.step(DT); if (wx.stats.flashes !== n0) f.push(`${wx.stats.flashes - n0} strokes by day`);
  if (wx.strike({ distKm: 1 })) f.push('strike() by hand worked by day');
  const wf = engine.weather; if (wf && wf.rain !== 0) f.push(`rain ${wf.rain} by day`);
  if (!isDaylight(game)) f.push('not day?');
  F.verdict(f.length === 0, 'setDaylight(true) takes a burning stroke out of the set, drops its thunder, and no stroke fires (or can be fired) for 40 s of day; the frame\'s rain is 0', f.join('; ') || `${n0} strokes before day, ${wx.stats.flashes} after 40 s of it`);
  setDaylight(game, false); for (let i = 0; i < 6 / DT; i++) W.step(DT);
  { const g: string[] = [];
    while (wx.flash) W.step(DT); upload(W);
    const L1 = lightList(engine), S1 = JSON.stringify({ z: engine.settings.skyZenith, h: engine.settings.skyHorizon, haze: engine.settings.hazeDensity }), sw1 = game.targets.map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join('|');
    if (L1 !== L0) { const a = L0.split('|'), b = L1.split('|'); const i = a.findIndex((x, k) => x !== b[k]); g.push(`light list differs (first at #${i}: '${a[i]}' vs '${b[i]}'; ${a.length} vs ${b.length})`); }
    if (S1 !== S0) g.push(`sky ${S0} → ${S1}`); if (sw1 !== sw0) g.push('switches differ');
    const n1 = wx.stats.flashes; for (let i = 0; i < 45 / DT; i++) W.step(DT); if (wx.stats.flashes <= n1) g.push('no stroke in 45 s of night after the day');
    F.verdict(g.length === 0, 'night again: light list (between strokes), sky / haze and switches exactly as before the round trip, and the storm strikes again within 45 s', g.join('; ') || `${L0.split('|').length} lights; ${wx.stats.flashes - n1} strokes after`); }
  return F.done();
}
