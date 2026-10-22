// The 'journal' family (probes.ts: `bun run tools/qa/probes.ts journal` — also in 'all'): the SESSION JOURNAL (src/game/journal.ts + sensors.ts + digest.ts) held
// to its claim without a browser. What is checked:
//   journal-roundtrip  (a) a 90-second scripted session is RECORDED headless (the sensors live over the fake GPU that never answers — the harness's stand-in — Sam
//                          walked, crouched, a whistle that fetches Kowalski, a canister thrown, the pistol drawn and a lobby panel shot out, a sprint, then a long
//                          crouch in the corner while the floor works it out — ALL of it through the synthetic input path once the recording is up: a poke into the
//                          game past frame 0 is not an input and would not replay), the file passes its own check and its size per frame is printed stream by
//                          stream; REPLAYED into a fresh game it runs to the last frame with every digest agreeing and not one sensor read diverging;
//   journal-pagelike   (a2) the same script recorded as ON THE PAGE where the harness can imitate it — a GPU that ANSWERS every query a frame late with f32s, a
//                          ragged rAF dt, the HUD nulling expired bubbles after each update, the stop deferred as F10's — replays identically with no probe;
//   journal-perturb    (b) the same file with ONE sensor's values forged from a frame on (the guards' smoke sight lines to Sam made opaque, then Sam's meter made
//                          bright) diverges — a digest mismatch and / or a sensor divergence at or after that frame, never before it — and the field is named;
//   journal-knob       (c) the same file replayed by a build whose gameplay differs (a knob nudged after the file's own were applied: the men walk 15 % faster)
//                          mismatches, naming a guard's field — what an INTENDED change looks like (re-record); while a presentation-only change (the torch's
//                          emitter radius on the replay's engine — a look, not an input) replays identically;
//   journal-fixtures   (d) every session under tools/qa/sessions/ (the committed fixtures — the first is this family's own recording) replays identically on
//                          this build: the gate a refactor must pass. `--write` files (a)'s recording there as selftest.json.gz.
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { replaySession, reportLines, readSession, isSessionName } from './replay.ts';
const J = await import(`${ROOT}/src/game/journal.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write'), VERBOSE = argv.includes('--verbose');
const SESSIONS_DIR = resolve(ROOT, 'tools/qa/sessions');
const verdictLine = (ok: boolean, label: string, detail: string, fails: string[]) => console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
let familyFails = 0;
export function journalFailures(): number { return familyFails; }

/** A stand-in for the GPU that ANSWERS (the 'page' variant): every key asked one frame is answered the next with a value off its own die — an irradiance for a point
 *  query (skewed dark, the odd bright one), a transmittance for a segment — as f32s, the way the probe's readback hands them over; `results` is the table forget()
 *  deletes from. Nothing of it exists in a replay: the journal must carry every value the game took. */
export function answeringProbe(seed: number) {
  const rnd = mulberry32(seed); const asked = new Map<string, boolean>(); const results = new Map<string, [number, number, number]>();
  const probe = { query(k: string) { asked.set(k, false); }, querySegment(k: string) { asked.set(k, true); }, get(k: string) { return results.get(k); }, results, hasPending: false, encode() { /* no GPU */ }, afterSubmit() { /* no GPU */ } };
  const tick = () => { for (const [k, seg] of asked) { const r = rnd(); results.set(k, [Math.fround(seg ? (r < 0.15 ? 0.05 + r : 0.75 + 0.25 * r) : (r < 0.9 ? r * r * 0.08 : 0.4 + 3 * rnd())), 0, 0]); } asked.clear(); };
  return { probe, tick, results };
}

/** RECORD the scripted session headless → the file (parsed back through JSON, as off a disk) + notes. Everything after request() is INPUT: keys, cursor, clicks.
 *  `page` = as on the game page where the harness can imitate it: a GPU that answers (answeringProbe, a frame late), a ragged rAF dt, the HUD's bubble expiry after
 *  every update (journal.ts hudExpireBubbles) with the file flagged env.hud, and the stop DEFERRED to the end of the next update as F10's is. */
export async function recordScripted(seed = 6011, page = false, seconds = 90): Promise<{ file: any; notes: string[]; game: any }> {
  Math.random = mulberry32(seed);
  const W = await standUp(); const { game, input } = W; const notes: string[] = [];
  const gpu = page ? answeringProbe(seed ^ 0x9e3779b9) : null; if (gpu) game.probe = gpu.probe;
  const dtDie = mulberry32(seed + 7); const dtOf = () => page ? 1 / 60 + (dtDie() - 0.5) * 0.006 : DT;   // (a 60 Hz rAF's dt wanders a few hundred µs either way; the odd long frame)
  // staged BEFORE the recording (all of it lands in the checkpoint): Sam a little into the lobby, dark-ish, god mode (a firefight must not end the take), autosave on
  game.godMode = true; game.saves.enabled = true; game.player.visibility = 0.12;
  for (let i = 0; i < 30; i++) { gpu?.tick(); W.step(DT); }
  const ok = game.journal.request({ seed: 424242, note: `journal-probes scripted session (${page ? 'page-like: answering GPU, ragged dt, HUD' : 'headless'})`, hud: page });
  if (!ok) throw new Error('journal.request refused: ' + game.journal.summary());
  const hold = new Set<string>();
  const press = (k: string) => input.pressed.add(k);
  const aimAt = (p: Vec3) => W.cursorAt(p);
  let f = 0; const stepN = (n: number) => { for (let i = 0; i < n; i++) { for (const k of hold) input.keys.add(k); gpu?.tick(); W.step(dtOf()); if (page) J.hudExpireBubbles(game); f++; } };
  const setHold = (...ks: string[]) => { for (const k of [...input.keys]) if (!ks.includes(k)) input.keys.delete(k); hold.clear(); for (const k of ks) hold.add(k); };
  // t 0–2.5 s: walk east across the lobby
  setHold('KeyD'); stepN(150);
  // crouch, creep north-east a little
  press('KeyC'); setHold('KeyD', 'KeyW'); stepN(90); setHold(); stepN(20);
  notes.push(`t ${game.time.toFixed(1)}: Sam at (${game.player.char.pos[0].toFixed(1)}, ${game.player.char.pos[2].toFixed(1)}) crouched ${game.player.crouch}`);
  // whistle (Kowalski walks the corridor's west end a few metres north), then slip away south-west
  press('KeyV'); stepN(20); setHold('KeyS', 'KeyA'); stepN(110); setHold(); stepN(40);
  notes.push(`t ${game.time.toFixed(1)}: whistled; ${game.guards.map((g: any) => `${g.callsign} ${g.state} ${g.awareness.toFixed(2)}`).join(', ')}`);
  // a smoke canister lobbed east: select it, hold G with the cursor out on the lobby floor, let go
  press('Digit3'); stepN(10); aimAt([12.5, 0, 17.5]); setHold('KeyG'); stepN(30); setHold(); stepN(90);
  notes.push(`t ${game.time.toFixed(1)}: canisters left ${game.player.canisters}, items ${game.items.items.map((it: any) => it.kind).join(',') || 'none'}`);
  // the pistol out, a lobby ceiling panel shot (the auto-aim snaps to the light), holstered again
  press('Digit1'); stepN(6); press('KeyE'); stepN(40);
  const panel = game.targets.find((t: any) => t.name === 'panel_lobby_2') ?? game.targets.find((t: any) => t.kind === 'analytic' && t.on);
  if (panel) { aimAt(panel.pos); stepN(4); input.clicked |= 1; input.buttons |= 1; stepN(2); input.buttons &= ~1; stepN(30); }
  notes.push(`t ${game.time.toFixed(1)}: shot at ${panel?.name} → on ${panel?.on} broken ${panel?.broken}; pistol ${game.player.pistol.chamber}+${game.player.pistol.mag}`);
  press('KeyE'); stepN(30);
  // sprint south-west into the corner, then a long crouched wait while the floor reacts (search, radio, calm)
  if (game.player.crouch) press('KeyC'); setHold('ShiftLeft', 'KeyS', 'KeyA'); stepN(120); setHold(); stepN(10); press('KeyC'); stepN(30);
  aimAt([6, 0, 12]); stepN(60);
  const FRAMES = seconds * 60; stepN(Math.max(0, FRAMES - f - (page ? 1 : 0)));
  notes.push(`t ${game.time.toFixed(1)}: end — ${game.guards.map((g: any) => `${g.callsign} ${g.state}`).join(', ')}; escalation ${game.escalation}; chronicle ${game.chronicle.events.length} rows; Sam hits left ${game.player.hitsLeft}; meter ${game.player.visibility.toFixed(2)}`);
  let file0: any;
  if (page) { game.journal.stop('selftest (deferred, as F10)'); if (!game.journal.stopping) throw new Error('a deferred stop did not defer'); stepN(1); file0 = game.journal.last; }   // F10's road: asked between frames, finalised at the end of the next update
  else file0 = game.journal.stop('selftest', true);
  if (!file0 || game.journal.state !== 'idle') throw new Error('journal.stop returned no file: ' + game.journal.summary());
  const file = JSON.parse(JSON.stringify(file0));   // (through the disk's eye)
  return { file, notes, game };
}
/** bytes per stream of a file, per frame */
function sizeTable(F: any): string {
  const n = Math.max(1, F.frames); const b = (x: unknown) => JSON.stringify(x).length;
  const parts: [string, number][] = [['save', b(F.save)], ['env+knobs', b(F.env) + b(F.knobs)], ['dt', b(F.dt)], ['view', b(F.view)], ['cam', b(F.cam)], ['input', b(F.input)], ['sensors', b(F.sensors)], ['digests', b(F.digests)]];
  const total = b(F); const perFrame = parts.filter(([k]) => k !== 'save' && k !== 'env+knobs').reduce((s, [, v]) => s + v, 0) / n;
  return `${(total / 1024).toFixed(1)} KB total for ${F.frames} frames (${(F.meta?.seconds ?? 0)} s) = ${(total / n).toFixed(0)} B/frame all-in, ${perFrame.toFixed(1)} B/frame of streams · ` + parts.map(([k, v]) => `${k} ${v > 4096 ? (v / 1024).toFixed(1) + ' KB' : v + ' B'}${k === 'save' || k === 'env+knobs' ? '' : ` (${(v / n).toFixed(1)}/f)`}`).join(' · ');
}
/** the key sequence current at frame `f` of a sensor stream (indices into keys) */
function seqAt(S: any, f: number): number[] { let seq: number[] = []; for (const r of S.recs) { const isK = r[0] === 'K'; const rf = isK ? r[1] : r[0]; if (rf > f) break; if (isK) seq = r.slice(2); } return seq; }
/** forge: from frame `f` on, every read of a key matching `re` delivers `value` (spliced into the stream as value records after every 'K' at or past f, and one at f) */
function forgeSensor(F: any, re: RegExp, f: number, value: number): number {
  const S = F.sensors; const recs: any[] = []; let placed = 0;
  const valueRec = (frame: number, seq: number[]) => { const vr: any[] = [frame]; seq.forEach((ki: number, i: number) => { if (re.test(S.keys[ki])) vr.push(i, value); }); return vr.length > 1 ? vr : null; };
  let injected = false;
  for (const r of S.recs) {
    const isK = r[0] === 'K'; const rf = isK ? r[1] : r[0];
    if (!injected && rf > f) { const vr = valueRec(f, seqAt(S, f)); if (vr) { recs.push(vr); placed++; } injected = true; }
    recs.push(r);
    if (isK && rf >= f) { const vr = valueRec(rf, r.slice(2)); if (vr) { recs.push(vr); placed++; } injected = injected || rf >= f; }
  }
  if (!injected) { const vr = valueRec(f, seqAt(S, f)); if (vr) { recs.push(vr); placed++; } }
  S.recs = recs; return placed;
}

let cached: { file: any; notes: string[] } | null = null;
async function theRecording() { return cached ??= await recordScripted(); }

// ================================================================================================================================ (a) round trip
export async function journalRoundtrip() {
  console.log('\n=== journal-roundtrip: a 90 s scripted session recorded headless (walk, crouch, whistle, canister, a light shot out, sprint, wait), the file checked and sized, replayed into a fresh game — identical to the last digest, no sensor read diverging ===');
  const fails: string[] = []; const notes: string[] = [];
  const t0 = performance.now(); const { file: F, notes: staged } = await theRecording(); notes.push(...staged);
  notes.push(`recorded in ${((performance.now() - t0) / 1000).toFixed(1)} s wall: ${F.frames} frames, seed ${F.seed}, ${F.sensors.keys.length} sensor keys [${F.sensors.keys.slice(0, 8).join(', ')}${F.sensors.keys.length > 8 ? ', …' : ''}], ${F.sensors.recs.length} sensor records, ${F.input.length} input records, ${F.cam.length} camera records, ${F.digests.length} digests`);
  const bad = J.checkSessionFile(F); if (bad) fails.push(`the file fails its own check: ${bad}`);
  notes.push('SIZE: ' + sizeTable(F));
  if (F.frames !== 90 * 60) fails.push(`frames ${F.frames} ≠ ${90 * 60}`);
  if (WRITE && !bad) { mkdirSync(SESSIONS_DIR, { recursive: true }); const p = resolve(SESSIONS_DIR, 'selftest.json.gz'); const gz = Bun.gzipSync(new TextEncoder().encode(JSON.stringify(F))); writeFileSync(p, gz); notes.push(`written → ${p} (${(gz.length / 1024).toFixed(0)} KB gzipped)`); }
  const R = await replaySession(JSON.parse(JSON.stringify(F)), 'scripted', { invariants: true, quiet: !VERBOSE });
  notes.push(...reportLines(R));
  if (!R.ok) fails.push(`replay not identical: ${R.bad || (R.digestMismatch ? `digest mismatch after frame ${R.digestMismatch.f}: ${R.digestMismatch.diffs.slice(0, 3).join(' · ')}` : R.sensor.first ? `sensor ${R.sensor.first.kind} '${R.sensor.first.key}' frame ${R.sensor.first.f}` : R.violations.length ? `invariant ${R.violations[0].kind}: ${R.violations[0].text}` : 'last digest missing')}`);
  if (R.ok && !R.lastDigestOk) fails.push('the last frame carried no digest to agree on');
  if (R.digestsChecked < Math.floor(F.frames / J.JOURNAL_DIGEST_EVERY)) fails.push(`only ${R.digestsChecked} digests checked`);
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(a) record 90 s headless → check → replay in a fresh game: every digest agrees, no sensor divergence, no invariant broken', notes.join('\n    '), fails);
}

// ================================================================================================================================ (a2) round trip, page-like
export async function journalPagelike() {
  console.log('\n=== journal-pagelike: the same script recorded as on the game page where the harness can imitate it — a GPU that ANSWERS every meter / sight-line query a frame late (f32s), a ragged rAF dt, the HUD nulling expired bubbles after each update, the stop deferred as F10\'s — replayed in a fresh game with NO probe at all: identical ===');
  const fails: string[] = []; const notes: string[] = [];
  const t0 = performance.now(); const { file: F, notes: staged } = await recordScripted(6017, true, 60); notes.push(...staged);
  const vals = F.sensors.recs.filter((r: any[]) => r[0] !== 'K').reduce((s: number, r: any[]) => s + (r.length - 1) / 2, 0);
  notes.push(`recorded in ${((performance.now() - t0) / 1000).toFixed(1)} s wall: ${F.frames} frames, env.hud ${F.env.hud}, ${F.dt.length} dt runs, ${F.sensors.keys.length} sensor keys, ${F.sensors.recs.length} sensor records carrying ${vals} value changes, ${F.digests.length} digests`);
  notes.push('SIZE: ' + sizeTable(F));
  const bad = J.checkSessionFile(F); if (bad) fails.push(`the file fails its own check: ${bad}`);
  if (!F.env.hud) fails.push('env.hud not set on a page-like recording');
  if (F.dt.length < F.frames * 0.9) fails.push(`a ragged dt run-length coded into only ${F.dt.length} runs`);
  if (vals < F.frames) fails.push(`only ${vals} sensor value changes journaled over ${F.frames} frames of an answering GPU`);
  if (F.digests[F.digests.length - 1]?.[0] !== F.frames - 1) fails.push('the deferred stop filed no closing digest on the last frame');
  const R = await replaySession(JSON.parse(JSON.stringify(F)), 'page-like', { invariants: true, quiet: !VERBOSE });
  notes.push(...reportLines(R));
  if (!R.ok) fails.push(`replay not identical: ${R.bad || (R.digestMismatch ? `digest mismatch after frame ${R.digestMismatch.f}: ${R.digestMismatch.diffs.slice(0, 3).join(' · ')}` : R.sensor.first ? `sensor ${R.sensor.first.kind} '${R.sensor.first.key}' frame ${R.sensor.first.f}` : R.violations.length ? `invariant ${R.violations[0].kind}: ${R.violations[0].text}` : 'last digest missing')}`);
  // and the HUD's write matters: replayed WITHOUT it (env.hud forced off) the same file must diverge somewhere a bubble lapsed — or, if no bubble ever lapsed inside a reader's window, at least replay (never crash)
  { const G = JSON.parse(JSON.stringify(F)); G.env.hud = false; const R2 = await replaySession(G, 'hud-off', { quiet: true }); notes.push(`the same file replayed WITHOUT the HUD's bubble expiry: ${R2.ok ? 'still identical (no bubble lapsed where a reader or the digest could tell)' : `diverges — ${R2.digestMismatch ? `digest after frame ${R2.digestMismatch.f}: ${R2.digestMismatch.diffs[0]}` : R2.sensor.first ? `sensor '${R2.sensor.first.key}' frame ${R2.sensor.first.f}` : '?'}`}`); }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(a2) a page-like recording (answering GPU a frame late, ragged dt, HUD bubble expiry, deferred stop) replays identically with no GPU', notes.join('\n    '), fails);
}

// ================================================================================================================================ (b) a forged sensor value diverges
export async function journalPerturb() {
  console.log('\n=== journal-perturb: one sensor forged from a frame on → the replay diverges at or after that frame (never before), and says where ===');
  const fails: string[] = []; const notes: string[] = [];
  const { file: F } = await theRecording();
  const cases: { name: string; re: RegExp; at: number; value: number }[] = [
    { name: "the guards' smoke sight lines to Sam made opaque (trans 0) from frame 200", re: /^smoke\d+$/, at: 200, value: 0 },
    { name: "Sam's light meter made bright (E 40) from frame 200", re: /^player(Chest|Head)$/, at: 200, value: 40 },
  ];
  let diverged = 0;
  for (const c of cases) {
    const G = JSON.parse(JSON.stringify(F)); const placed = forgeSensor(G, c.re, c.at, c.value);
    const R = await replaySession(G, 'forged', { quiet: true });
    const firstF = Math.min(R.digestMismatch?.f ?? Infinity, R.sensor.first?.f ?? Infinity);
    const d = R.digestMismatch || R.sensor.first;
    notes.push(`${c.name}: ${placed} value record(s) spliced → ${d ? `DIVERGED — ${R.digestMismatch ? `digest after frame ${R.digestMismatch.f} (${R.digestMismatch.diffs.slice(0, 2).join(' · ')})` : ''}${R.digestMismatch && R.sensor.first ? '; ' : ''}${R.sensor.first ? `sensor ${R.sensor.first.kind} '${R.sensor.first.key}' on frame ${R.sensor.first.f}` : ''}` : 'replayed IDENTICALLY (the forged value changed nothing the digest sees)'}`);
    if (!placed) fails.push(`${c.name}: nothing to forge (no such key read at / after frame ${c.at})`);
    if (d) { diverged++; if (firstF < c.at) fails.push(`${c.name}: divergence reported at frame ${firstF}, BEFORE the forgery at ${c.at}`); }
  }
  if (!diverged) fails.push('neither forgery made the replay diverge — the sensors are not being served, or nothing reads them');
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(b) a forged sensor stream is caught: divergence at or after the forged frame, the field / key named', notes.join('\n    '), fails);
}

// ================================================================================================================================ (c) a gameplay change diverges, a presentation change does not
export async function journalKnob() {
  console.log('\n=== journal-knob: the file replayed by a "changed build" — the men walking 15 % faster — mismatches and names a guard field; the torch\'s emitter radius changed (presentation only) replays identically ===');
  const fails: string[] = []; const notes: string[] = [];
  const { file: F } = await theRecording();
  { // gameplay: tune.guardWalk × 1.15 applied AFTER the file's knobs (replaySession applies knobs, then we reach in through a wrapped applyKnobs)
    const G = JSON.parse(JSON.stringify(F)); G.knobs = JSON.parse(JSON.stringify(G.knobs)); G.knobs.tune.guardWalk = (G.knobs.tune.guardWalk ?? 1.15) * 1.15;
    const R = await replaySession(G, 'walk×1.15', { quiet: true });
    const named = R.digestMismatch?.diffs.find((d: string) => /^guards\[/.test(d));
    notes.push(`guardWalk × 1.15: ${R.digestMismatch ? `digest mismatch after frame ${R.digestMismatch.f}: ${R.digestMismatch.diffs.slice(0, 3).join(' · ')}` : 'NO digest mismatch'}${R.sensor.first ? ` · sensor ${R.sensor.first.kind} '${R.sensor.first.key}' frame ${R.sensor.first.f}` : ''}`);
    if (!R.digestMismatch) fails.push('a 15 % faster patrol replayed to identical digests');
    else if (!named) fails.push(`the mismatch names no guard field: ${R.digestMismatch.diffs.slice(0, 2).join(' · ')}`);
  }
  { // presentation: the torch's emitter radius is handed to the renderer every frame (softer or harder shadows) — a replay reads no GPU, so the simulation must not notice
    const G = JSON.parse(JSON.stringify(F)); G.env.flashlightRadius = 0.031;   // (0.07 as recorded → 0.031: a look, not an input)
    const R = await replaySession(G, 'torchRadius', { quiet: true });
    notes.push(`flashlightRadius 0.07 → 0.031 (presentation only): ${R.ok ? 'replays identically' : `DIVERGED — ${reportLines(R).join(' ')}`}`);
    if (!R.ok) fails.push('a presentation-only env change diverged');
  }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, '(c) an intended gameplay change is what a divergence looks like (named to the guard); a presentation-only change is invisible to the replay', notes.join('\n    '), fails);
}

// ================================================================================================================================ (d) the fixtures
export async function journalFixtures() {
  console.log('\n=== journal-fixtures: every session in tools/qa/sessions/ replays identically on this build (a refactor\'s gate; an intended gameplay change re-records them) ===');
  const FIXTURE_FLOOR = 1;   // the committed selftest.json.gz (the page take and the Mac app's two were made on the office before its doors were real size: sessions/before-real-doors/README.md says how to put a page take back, then this is 2 again)
  const fails: string[] = []; const notes: string[] = [];
  const files = existsSync(SESSIONS_DIR) ? readdirSync(SESSIONS_DIR).filter(isSessionName).sort() : [];
  if (files.length < FIXTURE_FLOOR) { fails.push(`only ${files.length} fixture(s) in tools/qa/sessions/ (want ≥ ${FIXTURE_FLOOR}: the committed selftest + pane sessions — probes.ts journal --write files the scripted one; a vanished folder must not read as 'every session replays')`); }   // (wave-4 review: 0 fixtures was a vacuous green)
  for (const n of files) {
    let F: any; try { F = readSession(resolve(SESSIONS_DIR, n)); } catch (e: any) { fails.push(`${n}: unreadable — ${e?.message ?? e}`); continue; }
    const t0 = performance.now(); const R = await replaySession(F, n, { invariants: true, quiet: true });
    notes.push(...reportLines(R, !R.ok), `    (${((performance.now() - t0) / 1000).toFixed(1)} s wall · recorded ${F.recordedAt ?? '?'}${F.commit ? ' on ' + F.commit : ''}${F.env?.hud ? ' on the game page' : ' headless'} · ${F.note ?? ''})`);
    if (!R.ok) fails.push(`${n}: ${R.bad || 'diverged'} `);
  }
  const ok = !fails.length; if (!ok) familyFails++;
  verdictLine(ok, `(d) ${files.length} fixture(s) replay identically`, notes.join('\n    '), fails);
}

if (import.meta.main) {
  const which = argv.find(a => !a.startsWith('--')) ?? 'all';
  if (which === 'all' || which === 'roundtrip') await journalRoundtrip();
  if (which === 'all' || which === 'pagelike') await journalPagelike();
  if (which === 'all' || which === 'perturb') await journalPerturb();
  if (which === 'all' || which === 'knob') await journalKnob();
  if (which === 'all' || which === 'fixtures') await journalFixtures();
  console.log(`\n=== journal: ${familyFails ? `${familyFails} FAIL` : 'ALL PASS'} ===`);
  process.exit(familyFails ? 1 : 0);
}
