// The 'breach' family (game/breach.ts — the daytime, Door Kickers-style second showcase), run through probes.ts:
//   bun run tools/qa/probes.ts breach | breach-daylight | breach-run | breach-restore | breach-tour   [--verbose]
// PASS / FAIL each, all headless (the Breach constructed exactly as main.ts builds it — the Game, the FollowCamera, the harness Input, the null smoke — started
// with breach.start() and stepped in main.ts's order: breach.update → game.update → camera → lights):
//   breach-daylight   setDaylight(true) then (false) leaves the light list (name, kind, enabled, intensity, colour, dir) and the frame's sky / haze bit for bit as
//                     they were; while it is day: a 'sun' of kind 2 is in the set and lit, the moon and every street lamp are out, every listed group is on, and
//                     the level's blackout (thrown first) is over
//   breach-run        the show runs to its end by itself inside its authored length (118‥150 s of show clock since the loud half), the drill's beats land in order (start → approach-done →
//                     stacked → squeeze → kick → door-flung → aside → toss → bang → enter1 → enter2 → shots → three 'down' → clear → done), both operatives fire, every
//                     hostile ends on the floor, no operative is ever hit, nothing is NaN, and the budgets hold on every frame of it: characters ≤ 8 (the capsule
//                     budget), lights uploaded ≤ MAX_LIGHTS
//   breach-restore    after it ends (and after a P mid-show): three fresh guards on the level's three routes, level.routes back to 3, no 'sun' / 'breach_light*'
//                     in the set, the shift's torches lit again, sky / haze = the night's, no items / sparks / events, the player at the spawn and playable, every
//                     switch as authored, input unlocked
//   breach-tour       the showcase tour started on the same Game straight after a full breach run: 13 stops, no throw, guards = routes throughout, Sam never hit
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const { Breach } = await import(`${ROOT}/src/game/breach.ts`);
const { Demo } = await import(`${ROOT}/src/game/demo.ts`);
const { setDaylight, isDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
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

/** the light set as a comparable list (order matters: the GPU slots follow it) — everything but the momentary intensity, which fixtures on the blink and restriking
 *  tubes legitimately change from one frame to the next (the switches behind it are compared separately) */
function lightList(engine: any): string {
  return engine.lights.lights.map((l: any) => `${l.name}:${l.kind}:${l.enabled ? 1 : 0}:${l.peakIntensity.toFixed(3)}:${l.color.map((c: number) => c.toFixed(3)).join(',')}:${/^beacon|^flashlight|pistol_light|_cone$/.test(l.name) ? '-' : l.dir.map((c: number) => c.toFixed(3)).join(',')}:${l.radius.toFixed(3)}`).join('|');   // (the beacons turn, the torches swing and the cameras' haze cones pan whatever the hour: their direction is nobody's switch)
}
/** main.ts uploads the light set inside engine.render, which the harness has none of: do it by hand after a step so activeCount / activeIdx mean this frame */
function upload(W: any) { W.engine.lights.upload(W.game.time); }
const skyOf = (engine: any) => JSON.stringify({ z: engine.settings.skyZenith, h: engine.settings.skyHorizon, haze: engine.settings.hazeDensity });
const switches = (game: any) => game.targets.map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join('|');

/** shoulder-line yaw off the body's own facing (degrees): the run clip pumps it ±25° with the arms; a steadied long gun (character.ts longSteady) holds it to the weapon */
function shoulderYawDeg(c: any): number {
  const b = c.bones; if (!b.upperArmL || !b.upperArmR) return NaN;
  const lineYaw = Math.atan2(b.upperArmL[0] - b.upperArmR[0], b.upperArmL[2] - b.upperArmR[2]);   // right shoulder → left shoulder, as a heading
  let d = lineYaw - (c.bodyYaw + Math.PI / 2); d = Math.atan2(Math.sin(d), Math.cos(d));       // square across the facing = 0
  return d * 180 / Math.PI;
}
/** Run the breach on W to its end (or `abortAt` seconds of show clock, then stop() by hand). Returns what happened — including, per frame between the boot and #1's
 *  entry, whether #1 stood in the doorway's opening past his own kick line (the open threshold he must never cross), where both men ended up holding (the L), the
 *  shoulder line's swing on the run in, and what the second man's fist held when. */
function runBreach(W: any, opts: { abortAt?: number; maxSecs?: number; unsteady?: boolean } = {}) {
  const { game, cam, input } = W;
  const breach = new Breach(game, cam, W.smoke, input);
  let finishedFlag: boolean | null = null; breach.onStop = (f: boolean) => { finishedFlag = f; };
  breach.start();
  const started = breach.active;
  let frames = 0, maxChars = 0, maxLights = 0, maxWanted = 0, nan = '', opHit = '', crossed = '';
  const maxSecs = opts.maxSecs ?? 200;   // (the drill's ~28 s and, since the day showcase's loud half, ~100 s more to the cut outside)
  const ops = () => (breach as any).cast?.ops as any[] | undefined;
  const shy: number[][] = [[], []]; const prevYaw = [0, 0]; let hold: { a: Vec3; b: Vec3; yawA: number; yawB: number; t: number } | null = null; let pinnedFrames = 0, drift = 0;
  while (breach.active && frames < maxSecs / DT) {
    const O0 = ops(); if (opts.unsteady && O0) for (const o of O0) o.char.anim.longSteady = 0;   // (the before picture: the riflemen's shoulders as they were)
    const p = breach.update(DT);
    if (!breach.active) break;   // (stop() ran inside update: the frame after is plain play)
    W.step(DT, p); upload(W);
    frames++;
    maxChars = Math.max(maxChars, 1 + game.guards.length);
    maxLights = Math.max(maxLights, W.engine.lights.activeCount); maxWanted = Math.max(maxWanted, W.engine.lights.lights.filter((l: any) => l.enabled && l.intensity > 0).length);   // (activeCount is capped at MAX_LIGHTS by construction — count what WANTED a slot so an overflow (= silently dropped transients) can actually fail; review 08-10 #25)
    if (!nan) { for (const gd of game.guards) { const c = gd.char; if (![c.pos[0], c.pos[2], c.bodyYaw, c.aimYaw, c.aimPitch, gd.speed].every(Number.isFinite)) nan = `${gd.callsign} at show t ${f2(breach.t)}: pos ${c.pos} yaw ${c.bodyYaw} aim ${c.aimYaw}/${c.aimPitch} speed ${gd.speed}`; } if (![cam.yaw, cam.pitch, cam.distance, ...cam.target].every(Number.isFinite)) nan = `camera at show t ${f2(breach.t)}`; }
    const O = ops(); if (O && !opHit) for (const o of O) if (o.state === 'dead') opHit = `${o.callsign} down at show t ${f2(breach.t)}`;
    const dr = breach.drill;
    if (dr && O) {
      // #1 between his boot and his own entry: never in the opening north of the line he kicked from (the leaf's latch half is where he stands to kick; past it is the open doorway)
      if (!crossed && !isNaN(dr.tKick) && isNaN(dr.tEnter)) { const pa = O[0].char.pos; if (dr.inFunnel(pa) && pa[2] < dr.plan.kickFrom[2] - 0.2) crossed = `#1 at (${f2(pa[0])}, ${f2(pa[2])}) at drill t ${f2(dr.t)} — in the opening past his kick line`; }
      // the run in: shoulder-line swing per man once they are at speed (a second after the word, until #1 slows for the stack)
      if (dr.phase === 'approach' && dr.t > 3.8) O.forEach((o: any, i: number) => { const y = o.char.bodyYaw, py = prevYaw[i]; prevYaw[i] = y; if (o.speed > 2.5 && Math.abs(Math.atan2(Math.sin(y - py), Math.cos(y - py))) < 0.004) shy[i].push(shoulderYawDeg(o.char)); });   // (straight stretches only: a turn on the path swings the shoulders after the hips for a few frames, which is not the run clip's pumping)
      // the L: both holding, before the word for the next door — where they stand and which way #2 faces
      if ((dr as any).flows[0].st === 'hold' && (dr as any).flows[1].st === 'hold' && isNaN(dr.tNext) && O[1].script?.arrived) hold = { a: v3.copy(O[0].char.pos), b: v3.copy(O[1].char.pos), yawA: O[0].char.aimYaw, yawB: O[1].char.bodyYaw, t: dr.t };
      if (cam.pin) { pinnedFrames++; drift = Math.max(drift, v3.dist(cam.target, cam.pin.look)); }
    }
    if (opts.abortAt !== undefined && breach.t >= opts.abortAt) { breach.stop(); break; }
  }
  const timedOut = breach.active; if (timedOut) breach.stop();
  const pp = (a: number[]) => a.length > 10 ? Math.max(...a) - Math.min(...a) : NaN;
  return { breach, started, frames, showSecs: frames * DT, maxChars, maxLights, maxWanted, nan, opHit, crossed, hold, shoulderPP: [pp(shy[0]), pp(shy[1])], shoulderN: [shy[0].length, shy[1].length], pinnedFrames, drift, finished: finishedFlag, timedOut, log: breach.log as { t: number; what: string }[] };
}

// ---------------------------------------------------------------- breach-daylight
export async function breachDaylight() {
  const F = family('breach-daylight: the daytime variant swaps in and back out bit for bit (lighting.ts setDaylight)');
  Math.random = seeded(3);
  const W = await standUp(); const { game, engine, level } = W;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.setBlackout(30, 'debug'); for (let i = 0; i < 5; i++) W.step(DT);   // thrown first: day must bring the mains back
  game.endBlackout(); for (let i = 0; i < 6 / DT; i++) W.step(DT);         // …and the round trip is measured against a floor with the mains ON and every tube done restriking (a blackout is not something day → night should restore)
  upload(W); const L0 = lightList(engine), S0 = skyOf(engine), W0 = switches(game);
  game.setBlackout(30, 'debug'); W.step(DT);
  setDaylight(game, true); for (let i = 0; i < 3; i++) W.step(DT); upload(W);
  const D = level.daylight;
  { const f: string[] = [];
    if (!isDaylight(game)) f.push('isDaylight false');
    const sun = engine.lights.lights.find((l: any) => l.name === 'sun'); if (!sun) f.push('no sun in the set'); else { if (sun.kind !== 2) f.push(`sun kind ${sun.kind}`); if (!sun.enabled) f.push('sun disabled'); if (!(engine.lights.activeIdx as number[]).some((i: number) => engine.lights.lights[i] === sun)) f.push('sun not uploaded'); }
    const moon = engine.lights.lights.find((l: any) => l.name === 'moon'); if (moon?.enabled) f.push('moon still lit');
    for (const t of game.targets) { if (D.groupsOff.includes(t.group) && (t.on || (t.light && t.light.enabled))) f.push(`${t.name} (${t.group}) still on`); if (D.groupsOn.includes(t.group) && !t.on) f.push(`${t.name} (${t.group}) off`); }
    if (game.blackout.active) f.push('blackout still active');
    if (Math.abs(engine.settings.hazeDensity - D.haze) > 1e-9) f.push(`haze ${engine.settings.hazeDensity}`);
    if (JSON.stringify(engine.settings.skyZenith) !== JSON.stringify(D.sky.zenith)) f.push(`sky zenith ${engine.settings.skyZenith}`);
    const Ld = lightList(engine); setDaylight(game, true); if (lightList(engine) !== Ld) f.push('a second setDaylight(true) changed the list');
    F.verdict(f.length === 0, 'day: one lit sun of kind 2 uploaded, moon and street lamps out, every listed group on, mains back, sky / haze the variant\'s, idempotent', f.join('; ') || `sun dir ${sun?.dir.map(f2)} I ${sun?.intensity}; ${engine.lights.activeCount} lights uploaded by day; sky ${JSON.stringify(engine.settings.skyZenith)} haze ${engine.settings.hazeDensity}`); }
  setDaylight(game, false); for (let i = 0; i < 6 / DT; i++) W.step(DT); upload(W);   // (six seconds again: the groups day switched on and night switches back off restrike nothing, but a fixture on the blink is compared like for like)
  { const f: string[] = [];
    if (isDaylight(game)) f.push('isDaylight still true');
    const L1 = lightList(engine), S1 = skyOf(engine), W1 = switches(game);
    if (L1 !== L0) { const a = L0.split('|'), b = L1.split('|'); const i = a.findIndex((x, k) => x !== b[k]); f.push(`light list differs (first at #${i}: '${a[i]}' vs '${b[i]}'; ${a.length} vs ${b.length} lights)`); }
    if (S1 !== S0) f.push(`sky ${S0} → ${S1}`);
    if (W1 !== W0) { const a = W0.split('|'), b = W1.split('|'); f.push(`switches differ: ${a.filter((x: any, k: any) => x !== b[k]).slice(0, 6).join(', ')}`); }
    setDaylight(game, false); if (lightList(engine) !== L1) f.push('a second setDaylight(false) changed the list');
    F.verdict(f.length === 0, 'night again: light list, sky, haze and every switch exactly as before the round trip; idempotent', f.join('; ') || `${L0.split('|').length} lights, ${engine.lights.activeCount} uploaded by night, sky ${S0}`); }
  return F.done();
}

// ---------------------------------------------------------------- breach-run
const ORDER = ['start', 'go', 'approach-done', 'stacked', 'squeeze', 'kick', 'kickL', 'door-flung', 'retreat', 'toss', 'bang', 'enter1', 'enter2', 'clear', 'next', 'stack2', 'cut', 'done'];
const PER_MAN = [['enter1', 'in1', 'centre1', 'corner1', 'hold1', 'clear'], ['enter2', 'in2', 'centre2', 'corner2', 'hold2', 'clear']];
export async function breachRun() {
  const F = family('breach-run: the show runs itself to the end — battle drill six in order, the boot off the left leg and the step back, the charge in as the leaf clears, both men fire, three down, the L on the next door, the stack on it, budgets held (breach.ts)');
  Math.random = seeded(11);
  const W = await standUp(); const { game, level } = W;
  for (let i = 0; i < 30; i++) W.step(DT);
  const R = runBreach(W);
  const beats = R.log.map(b => b.what);
  const at = (w: string) => R.log.find(b => b.what === w)?.t ?? NaN;
  if (VERBOSE) console.log('   log: ' + R.log.map(b => `${b.what}@${f2(b.t)}`).join(' '));
  { const f: string[] = [];
    if (!R.started) f.push('breach.start() did not go active (level.breach / level.daylight missing?)');
    if (R.timedOut) f.push(`still running after ${f2(R.showSecs)} s`);
    if (R.finished !== true) f.push(`onStop(finished=${R.finished})`);
    if (R.showSecs < 118 || R.showSecs > 150) f.push(`show length ${f2(R.showSecs)} s (want 118‥150: the drill's ~28 s to its cut, then the loud half — tools/qa/day-probes.ts holds that half's own beats)`);
    F.verdict(f.length === 0, 'runs to its end by itself inside the authored length', f.join('; ') || `${f2(R.showSecs)} s of show, ${R.frames} frames, finished=${R.finished}`); }
  { const f: string[] = []; let k = -1;
    for (const w of ORDER) { const i = beats.indexOf(w); if (i < 0) { f.push(`no '${w}'`); continue; } if (i < k) f.push(`'${w}' out of order`); k = Math.max(k, i); }
    for (const seq of PER_MAN) { let kk = -1; for (const w of seq) { const i = beats.indexOf(w); if (i < 0) { if (!ORDER.includes(w)) f.push(`no '${w}'`); continue; } if (i < kk) f.push(`'${w}' out of order (per man)`); kk = Math.max(kk, i); } }
    if (beats.includes('stacked-late')) f.push('the stack formed late (a man never made his mark: stacked-late)');
    if (beats.includes('stack2-late')) f.push('the stack on the next door formed late (stack2-late)');
    if (beats.includes('door-pushed')) f.push('the kick missed its mark (door-pushed, not door-flung)');
    if (beats.includes('abort')) f.push('drill aborted (an operative went down)');
    const downs = beats.filter(b => b.startsWith('down:')); if (downs.length !== 3) f.push(`${downs.length} 'down' beats (want 3)`);
    const lastDown = Math.max(...R.log.filter(b => b.what.startsWith('down:')).map(b => b.t)); if (!(lastDown <= at('clear'))) f.push(`a man went down after 'clear' (${f2(lastDown)} > ${f2(at('clear'))})`);
    const shots1 = beats.filter(b => b === 'shot1').length, shots2 = beats.filter(b => b === 'shot2').length; if (shots1 < 2 || shots2 < 2) f.push(`rounds: #1 ${shots1}, #2 ${shots2} (want ≥ 2 each)`);
    // the timings the doctrine fixes: the charge leaves the hand within 0.2 s of the leaf coming free, #1 goes on the bang + 0.4, #2 at least 0.4 s behind him, each man checks the centre before he turns to his corner
    const tossLag = at('toss') - at('door-flung'); if (!(tossLag >= 0 && tossLag <= 0.2 + 1e-6)) f.push(`toss ${f2(tossLag)} s after the leaf came free (want ≤ 0.2)`);
    const goLag = at('enter1') - at('bang'); if (!(goLag >= 0.3 && goLag <= 0.7)) f.push(`#1 went ${f2(goLag)} s after the bang (want ≈ 0.4)`);
    const twoLag = at('enter2') - at('enter1'); if (!(twoLag >= 0.4 && twoLag <= 1.6)) f.push(`#2 went ${f2(twoLag)} s after #1 (want 0.4‥1.6)`);
    if (!(at('eyes1:0') >= at('enter1'))) f.push("#1's muzzle was on a man before he went");   // (08-13 doctrine: he engages AS he crosses the frame — the pair may come a stride before the 'in' beat, never before he goes)
    const firstShotLag = at('shot1') - at('in1'); if (!(firstShotLag <= 0.45)) f.push(`#1's first round ${f2(firstShotLag)} s after he was in (want ≤ 0.45: taken as he clears the frame, no beat in the threshold)`);
    if (!(at('corner1') >= at('centre1') && at('corner2') >= at('centre2'))) f.push('a corner begun before its centre check');   // (in, centre and corner are one continuous flow now: logged on the same frame)
    const drill = R.log.filter(b => ORDER.includes(b.what)).map(b => `${b.what}@${f2(b.t)}`).join(' ');
    F.verdict(f.length === 0, 'beats in order: start → run in → stacked → squeeze → kick (left) → leaf flung → retreat → toss ≤ 0.2 s later → bang → #1 (bang + 0.4): in, centre, corner → #2 ≥ 0.4 s behind: centre, corner → both holding → clear → next → stack on it → cut', f.join('; ') || `${drill}; rounds ${shots1}+${shots2}; toss +${f2(tossLag)} s, go +${f2(goLag)} s, #2 +${f2(twoLag)} s`); }
  { const f: string[] = [];
    if (R.crossed) f.push(R.crossed);
    const P = level.breach, B = P.bounds, N = game.doors.byName(P.next.door);
    const H = R.hold;
    if (!H) f.push('the pair never both held their sectors before the word for the next door');
    else {
      const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
      const angA = Math.atan2(H.a[2] - cz, H.a[0] - cx), angB = Math.atan2(H.b[2] - cz, H.b[0] - cx);
      let sep = Math.abs(angA - angB) * 180 / Math.PI; if (sep > 180) sep = 360 - sep;
      if (sep < 65 || sep > 115) f.push(`the L: ${f2(sep)}° between the two men about the room's centre (want 90 ± 25)`);
      const dc = N ? v3.distXZ(H.b, N.frameCentre) : Infinity; if (dc > 2.5) f.push(`#2 holds ${f2(dc)} m off the next door (want ≤ 2.5)`);
      // 08-13 (the maintainer on the Clear shot): #1 — the LEFT man — points at the next door across the middle of the room; #2 — the RIGHT man — has his BACK to the wall, facing into the room
      const wantA = N ? Math.atan2(N.frameCentre[0] - H.a[0], N.frameCentre[2] - H.a[2]) : 0; const offA = Math.abs(Math.atan2(Math.sin(H.yawA - wantA), Math.cos(H.yawA - wantA))) * 180 / Math.PI;
      if (offA > 30) f.push(`#1 faces ${f2(offA)}° off the next door (want ≤ 30: he holds it across the middle)`);
      const inward = Math.atan2(cx - H.b[0], cz - H.b[2]); let off = Math.abs(Math.atan2(Math.sin(H.yawB - inward), Math.cos(H.yawB - inward))) * 180 / Math.PI;
      if (off > 75) f.push(`#2 faces ${f2(off)}° off the room's middle (want ≤ 75: back to the wall, into the room)`);
      const wallB = Math.min(H.b[0] - B.x0, B.x1 - H.b[0], H.b[2] - B.z0, B.z1 - H.b[2]); if (wallB > 1.6) f.push(`#2 holds ${f2(wallB)} m off the nearest wall (want ≤ 1.6: his back to it)`);
      const O = (R.breach as any);   // (cast is gone after restore; the hold snapshot is what we have)
      void O;
      if (!f.length) f.push(`ok: L ${f2(sep)}° about (${f2(cx)}, ${f2(cz)}) — #1 at (${f2(H.a[0])}, ${f2(H.a[2])}), #2 at (${f2(H.b[0])}, ${f2(H.b[2])}) ${f2(dc)} m off ${P.next.door} facing ${f2(off)}° off it, at drill t ${f2(H.t)}`);
    }
    const ok = f.length === 1 && f[0].startsWith('ok: ') && !R.crossed;
    F.verdict(ok, "#1 never stands in the opening past his kick line before his own entry; the two end in an L about the room's centre — #1 holding the next door across it, #2 by it with his back to the wall facing in", (ok ? f[0].slice(4) : f.filter(x => !x.startsWith('ok: ')).join('; ')));
  }
  { const f: string[] = [];
    if (R.nan) f.push(`NaN: ${R.nan}`); if (R.opHit) f.push(`operative hit: ${R.opHit}`);
    if (R.maxChars > 8) f.push(`${R.maxChars} characters on a frame (capsule budget is 8)`);
    if (R.maxLights > MAX_LIGHTS || R.maxWanted > MAX_LIGHTS) f.push(`${R.maxWanted} lights wanted a slot on a frame (MAX_LIGHTS ${MAX_LIGHTS}: the rest were dropped)`);
    if (R.pinnedFrames < R.frames * 0.95) f.push(`camera pinned on ${R.pinnedFrames}/${R.frames} frames`); if (R.drift > 1e-6) f.push(`camera target drifted ${R.drift.toFixed(4)} m off the pinned look-at`);
    if (W.cam.pin) f.push('camera still pinned after the show');
    F.verdict(f.length === 0, 'nothing NaN, no operative hit, characters ≤ 8 and lights ≤ MAX_LIGHTS on every frame, the camera pinned to the shot verbatim throughout and released after', f.join('; ') || `max ${R.maxChars} characters, max ${R.maxLights}/${MAX_LIGHTS} lights uploaded, pinned ${R.pinnedFrames}/${R.frames} frames, drift ${R.drift.toFixed(4)} m`); }
  { // the run in: the shoulder line held to the weapon (character.ts longSteady, set where game.ts arms a man's FN2000 as player.ts arms Sam's) against the same run with it off
    Math.random = seeded(11);
    const W2 = await standUp(); for (let i = 0; i < 30; i++) W2.step(DT);
    const R0 = runBreach(W2, { unsteady: true, abortAt: 9 });
    const f: string[] = [];
    const on = R.shoulderPP, off = R0.shoulderPP;
    if (!(R.shoulderN[0] > 60 && R.shoulderN[1] > 60)) f.push(`too few run samples (${R.shoulderN.join('/')})`);
    for (const i of [0, 1]) { if (!(on[i] <= 20)) f.push(`#${i + 1}'s shoulder line swings ${f2(on[i])}° p-p on the run (bound 20)`); if (!(on[i] < off[i] * 0.6)) f.push(`#${i + 1}: steadied ${f2(on[i])}° vs unsteadied ${f2(off[i])}° p-p — not the better part of it gone`); }
    const ops = (R.breach as any); void ops;
    F.verdict(f.length === 0, 'the run in at the low ready: each man\'s shoulder line swings under 20° peak-to-peak about his facing, well under what the same run does unsteadied (longSteady 0)', f.join('; ') || `shoulder line p-p on the run: #1 ${f2(on[0])}° (unsteadied ${f2(off[0])}°), #2 ${f2(on[1])}° (unsteadied ${f2(off[1])}°), ${R.shoulderN.join('/')} samples`); }
  return F.done();
}

// ---------------------------------------------------------------- breach-restore
export function restoredCheck(W: any, label: string): string[] {
  const { game, engine, level, input } = W; const f: string[] = [];
  if (game.guards.length !== 3 || level.routes.length !== 3) f.push(`${label}: ${game.guards.length} guards / ${level.routes.length} routes`);
  game.guards.forEach((gd: any, i: number) => { if (gd.routeI !== i) f.push(`${label}: guard ${i} routeI ${gd.routeI}`); if (gd.state !== 'patrol' || gd.script || gd.hold || gd.pinned) f.push(`${label}: guard ${i} ${gd.state} script ${!!gd.script} hold ${gd.hold} pinned ${gd.pinned}`); if (gd.char.id !== 10 + i) f.push(`${label}: guard ${i} id ${gd.char.id}`); if (v3.distXZ(gd.char.pos, level.routes[i].points[0]) > 3.5) f.push(`${label}: guard ${i} ${f2(v3.distXZ(gd.char.pos, level.routes[i].points[0]))} m off his route start`); });   // (3.5 m: two seconds of plain play have passed — a man whose route has no wait at its first point is already a couple of metres down its first leg)
  const names = engine.lights.lights.map((l: any) => l.name); if (names.includes('sun')) f.push(`${label}: sun still in the set`); if (names.some((n: string) => n.startsWith('breach_light'))) f.push(`${label}: cast lights still in the set`);
  if (isDaylight(game)) f.push(`${label}: still day`);
  if (JSON.stringify(engine.settings.skyZenith) !== JSON.stringify(level.sky.zenith) || Math.abs(engine.settings.hazeDensity - 0.035) > 1e-9) f.push(`${label}: sky ${JSON.stringify(engine.settings.skyZenith)} haze ${engine.settings.hazeDensity}`);
  if (game.items.items.length || game.events.length) f.push(`${label}: ${game.items.items.length} items / ${game.events.length} events left`);
  if (game.player.down || v3.distXZ(game.player.char.pos, level.playerSpawn) > 0.5) f.push(`${label}: player down ${game.player.down} at ${game.player.char.pos.map(f2)}`);
  if (game.playerInvisible || game.godMode || game.quietUtility || game.touring) f.push(`${label}: flags invisible ${game.playerInvisible} god ${game.godMode} quiet ${game.quietUtility} touring ${game.touring}`);
  if (input.lockExcept) f.push(`${label}: input still locked`);
  const authored = new Map<string, boolean>(); for (const sw of level.switchables) authored.set(sw.name, sw.on); for (const l of level.lights) authored.set(l.name, l.enabled);
  const wrong = game.targets.filter((t: any) => authored.has(t.name) && authored.get(t.name) !== t.on).map((t: any) => t.name); if (wrong.length) f.push(`${label}: switches not as authored: ${wrong.slice(0, 5).join(', ')}`);
  return f;
}
export async function breachRestore() {
  const F = family('breach-restore: after the show (finished, or cut off with P) the night floor is exactly the start card\'s (breach.ts restore)');
  for (const mode of ['finished', 'aborted'] as const) {
    Math.random = seeded(mode === 'finished' ? 21 : 22);
    const W = await standUp(); const { game } = W;
    for (let i = 0; i < 30; i++) W.step(DT);
    const torchesBefore = game.guards.map((gd: any) => gd.flashlight);
    const R = runBreach(W, mode === 'aborted' ? { abortAt: 14 } : {});
    for (let i = 0; i < 120; i++) W.step(DT);   // two seconds of plain play afterwards
    const f = restoredCheck(W, mode);
    if (!R.started) f.push('never started');
    if (mode === 'finished' && R.finished !== true) f.push(`finished=${R.finished}`); if (mode === 'aborted' && R.finished !== false) f.push(`aborted run reported finished=${R.finished}`);
    game.guards.forEach((gd: any, i: number) => { if (gd.flashlight !== torchesBefore[i]) f.push(`guard ${i} has a different flashlight object`); if (!gd.flashlight.enabled) f.push(`guard ${i}'s torch is dark two seconds into play`); });
    if (!R.log.some(b => b.what === 'restore')) f.push("no 'restore' in the log");
    F.verdict(f.length === 0, `${mode === 'finished' ? 'run to the end' : 'P at 14 s'}: three fresh guards on three routes with their own lit torches, no sun / cast lights, night sky, nothing in the air, Sam at the spawn playable, switches as authored, input free`, f.join('; ') || `show ${f2(R.showSecs)} s; ${game.guards.map((gd: any) => gd.callsign + ':' + gd.state).join(' ')}`);
  }
  return F.done();
}

// ---------------------------------------------------------------- breach-tour
export async function breachTour() {
  const F = family('breach-tour: the showcase tour runs clean on the same Game straight after a breach (nothing of the show leaks into it)');
  Math.random = seeded(31);
  const W = await standUp(); const { game, cam, input, level } = W;
  const pin = () => { game.player.visibility = 0.05; };
  for (let i = 0; i < 30; i++) W.step(DT);
  const R = runBreach(W);
  for (let i = 0; i < 60; i++) W.step(DT);
  const demo = new Demo(game, cam, W.smoke, input);
  const f: string[] = []; let hits = 0, lastFlash = 0, stops = 0, lastShot = -1, threw = '';
  if (!R.started || R.finished !== true) f.push(`breach: started ${R.started} finished ${R.finished}`);
  demo.start(); if (!demo.active) f.push('demo.start() did not go active');
  let frames = 0;
  while (demo.active && frames < 260 / DT) {
    let p: Vec3 | null = null;
    try { p = demo.update(DT); } catch (e) { threw = `demo.update threw at stop ${demo.shotI}: ${(e as Error).message}`; break; }
    if (!demo.active) break;
    pin();
    try { W.step(DT, p); } catch (e) { threw = `game.update threw at stop ${demo.shotI}: ${(e as Error).message}`; break; }
    frames++;
    if (demo.shotI !== lastShot) { lastShot = demo.shotI; stops = Math.max(stops, demo.shotI + 1); }
    if (game.player.hitFlash > 0.99 && game.player.hitFlash > lastFlash) hits++; lastFlash = game.player.hitFlash;
    if (game.guards.length !== level.routes.length) { f.push(`stop ${demo.shotI}: ${game.guards.length} guards vs ${level.routes.length} routes`); break; }
    if (game.guards.some((gd: any) => gd.char.id >= 20)) { f.push(`stop ${demo.shotI}: a cast id among the guards`); break; }
  }
  if (threw) f.push(threw);
  if (demo.active) { f.push(`tour still active after ${f2(frames * DT)} s`); demo.stop(); }
  if (stops < 13) f.push(`${stops} stops reached (want 13)`);
  if (hits) f.push(`Sam hit ${hits}×`);
  if (W.engine.lights.lights.some((l: any) => l.name === 'sun')) f.push('a sun in the set during / after the tour');
  F.verdict(f.length === 0, '13 stops, no throw, guards = routes and no cast ids throughout, Sam never hit, no sun', f.join('; ') || `${stops} stops in ${f2(frames * DT)} s of tour after a ${f2(R.showSecs)} s breach`);
  return F.done();
}

// ---------------------------------------------------------------- clear-doctrine
/** The guards' own two-man RoomClear (squad.ts) keeps the doctrine the breach stages: run staged on the tour's conference plan (the kick) and on two of the level's
 *  lockdown plans (the keyed shove; rooms with a second door), measured off the men frame by frame — the kicker is out of the doorway's opening from half a
 *  second after the leaf goes until he starts in; #2 starts in ≥ 0.4 s behind #1; each man's muzzle bears on the room's centre inside 0.7 s of starting in and
 *  on his own corner (the first point of his authored sector) inside 1.15 s; where the room has another door #2 ends the search squared to it (≤ 30°); the
 *  drill still reaches 'resolve' with its lines said (the tour's stop counts on ≥ 10 inside 18 s). */
export async function clearDoctrine() {
  const F = family('clear-doctrine: the live RoomClear keeps battle drill six — kicker off the funnel, #2 a beat behind, centre then his corner, #2 on the next door (squad.ts)');
  const { RoomClear } = await import(`${ROOT}/src/game/squad.ts`);
  const { CONFERENCE_CLEAR } = await import(`${ROOT}/src/game/demo.ts`);
  const bearing = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
  const angOff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * 180 / Math.PI;
  const cases: { name: string; plan: (level: any) => any; wantNext: string | null }[] = [
    { name: "the tour's conference room (kicked)", plan: () => CONFERENCE_CLEAR, wantNext: null },
    { name: 'server room by its corridor door (keyed shove; side door to the office)', plan: (level: any) => level.clearPlans[1], wantNext: 'server_manager' },
    { name: 'break room by its corridor door (keyed shove; three other doors)', plan: (level: any) => level.clearPlans[4], wantNext: 'breakroom_w' },
  ];
  for (const [ci, C] of cases.entries()) {
    Math.random = seeded(41 + ci);
    const W = await standUp(); const { game, level } = W;
    game.playerInvisible = true; game.godMode = true; game.quietUtility = true; game.teleportPlayer([1.5, 0, 1.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    const P0 = C.plan(level); const [a, b] = game.guards; for (const o of game.guards.slice(2)) { o.hold = true; o.char.pos = [-40, 0, -40]; }
    // staged from a couple of metres up the stack line (the level's plans have no approach marks of their own)
    const u = v3.normalize([P0.stack[1][0] - P0.stack[0][0], 0, P0.stack[1][2] - P0.stack[0][2]]);
    const P = P0.from ? P0 : { ...P0, from: [v3.mad(P0.stack[0], u, 1.7), v3.mad(P0.stack[1], u, 1.9)] };
    const d = game.doors.byName(P.door); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false;
    const clear = new RoomClear(game, P, a, b); clear.start();
    let says = 0; const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { says++; return origSay(gd, text, radio); };
    let t = 0, tOpen = NaN, inFunnel = '', gap = NaN;
    const centreHit = [Infinity, Infinity], cornerHit = [Infinity, Infinity]; const starts = [NaN, NaN];
    const centre: Vec3 = P.bounds ? [(P.bounds.x0 + P.bounds.x1) / 2, 1, (P.bounds.z0 + P.bounds.z1) / 2] : (() => { const pts = [...P.entryAim[0], ...P.entryAim[1]]; let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[2]; } return [x / pts.length, 1, z / pts.length] as Vec3; })();
    const funnel = (p: Vec3) => { const [hx, hz] = d.def.hinge; const alongX = Math.abs(Math.sin(d.def.closedDir)) < 0.5; const u0 = alongX ? hx : hz, uu = alongX ? p[0] : p[2], w = alongX ? p[2] - hz : p[0] - hx; return uu > u0 - 0.05 && uu < u0 + d.def.width + 0.05 && Math.abs(w) < 0.9; };
    let faceOff = NaN; const phases = new Set<string>();
    for (let f = 0; f < 60 * 18; f++) {
      clear.tick(t, DT); W.step(DT); t += DT; phases.add(clear.phase);
      if (isNaN(tOpen) && !d.latched) tOpen = t;
      if ((P.breach ?? 'kick') === 'kick' && !isNaN(tOpen) && t > tOpen + 0.5 && isNaN(clear.tEnter) && !inFunnel && funnel(a.char.pos)) inFunnel = `#1 in the opening at (${f2(a.char.pos[0])}, ${f2(a.char.pos[2])}) ${f2(t - tOpen)} s after the leaf went`;
      starts[0] = clear.tEnter; starts[1] = clear.tEnter2;
      [a, b].forEach((gd: any, i: number) => {
        const t0 = starts[i]; if (isNaN(t0)) return; const c = gd.char, dtIn = t - t0;
        if (dtIn <= 0.7 && angOff(c.aimYaw, bearing(c.pos, centre)) < 20) centreHit[i] = Math.min(centreHit[i], dtIn);
        if (dtIn <= 1.15 && angOff(c.aimYaw, bearing(c.pos, P.entryAim[i][0])) < 20) cornerHit[i] = Math.min(cornerHit[i], dtIn);
      });
      if (!isNaN(clear.tEnter) && !isNaN(clear.tEnter2)) gap = clear.tEnter2 - clear.tEnter;
      if (clear.phase === 'resolve' && isNaN(faceOff)) { const nd = clear.nextDoor; faceOff = nd ? angOff(b.char.bodyYaw, bearing(b.char.pos, nd.frameCentre)) : 0; }
    }
    const f: string[] = [];
    if (inFunnel) f.push(inFunnel);
    if (!(gap >= 0.4)) f.push(`#2 started in ${f2(gap)} s after #1 (want ≥ 0.4)`);
    for (const i of [0, 1]) { if (!(centreHit[i] <= 0.7)) f.push(`#${i + 1}'s muzzle never bore on the room's centre inside 0.7 s of starting in`); if (!(cornerHit[i] <= 1.15)) f.push(`#${i + 1}'s muzzle never bore on his corner inside 1.15 s of starting in`); }
    const nd = clear.nextDoor?.def.name ?? null;
    if (nd !== C.wantNext) f.push(`next door ${nd} (want ${C.wantNext})`);
    if (C.wantNext && !(faceOff <= 30)) f.push(`#2 ${f2(faceOff)}° off the ${C.wantNext} door at resolve (want ≤ 30)`);
    if (!phases.has('resolve')) f.push(`never reached 'resolve' in 18 s (phases ${[...phases].join('→')})`);
    if (says < 10) f.push(`${says} barks (want ≥ 10)`);
    F.verdict(f.length === 0, C.name, f.join('; ') || `#2 in +${f2(gap)} s; centre at +${f2(centreHit[0])} / +${f2(centreHit[1])} s, own corner at +${f2(cornerHit[0])} / +${f2(cornerHit[1])} s; ${nd ? `#2 ${f2(faceOff)}° off ${nd} at resolve` : 'no second door'}; resolve at ${f2(clear.tResolve)} s, ${says} barks${(P.breach ?? 'kick') === 'kick' ? '; kicker clear of the opening from +0.5 s' : ''}`);
    clear.end('patrol'); game.say = origSay;
  }
  return F.done();
}
