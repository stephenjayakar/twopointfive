// REPLAY a session journal headless (src/game/journal.ts — recorded on the game page with F10, or by tools/qa/journal-probes.ts):
//   bun run tools/qa/replay.ts <session.json …> [--strict] [--invariants] [--until F] [--quiet]
//   bun run tools/qa/replay.ts --all [--strict] [--invariants]        every *.json in tools/qa/sessions/
// A fresh headless Game stood up as the recording's engine was where the simulation can tell (its env), the file's checkpoint loaded, its knobs applied, Math.random
// seeded with its seed, then every frame fed back: dt, the canvas, the camera, the input through the synthetic path, and every GPU-side value the game asks for
// served from the journal by the sensors in REPLAY mode. After each update the digest the recording filed for that frame (every JOURNAL_DIGEST_EVERY, and the last)
// is compared with the replay's own. REPORT: frames replayed; the first sensor DIVERGENCE (a read the recording never made on that frame / values it delivered that
// were never read — the game took another road); the first DIGEST mismatch with the fields that differ ('guards[1 Novak].aw: 0.31 ≠ 0.29'); with --invariants the
// soak's essential per-frame invariants over the replayed run (nothing NaN or out of the world, the men's states sane, Sam never through a static between frames nor
// inside one at a frame's end). --strict stops at the first divergence or mismatch. EXIT: 0 = replayed identically to the end (and no invariant broken),
// 1 = diverged / mismatched / violated, 2 = a bad or unreadable file. A REFACTOR must exit 0 on every fixture; an intended gameplay change is expected to
// diverge — re-record (CLAUDE.md 'Session journal').
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const J = await import(`${ROOT}/src/game/journal.ts`);
const { loadState, canLoad, levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { simDie } = await import(`${ROOT}/src/math/dice.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { playerBodyR } = await import(`${ROOT}/src/game/player.ts`);

type Vec3 = [number, number, number];
export interface ReplayOpts { strict?: boolean; invariants?: boolean; until?: number; quiet?: boolean; log?: (s: string) => void;
  /** a check's own hand between two frames, called before frame f is applied: what it did to the recording game there, done again to this one (off the tape, as it was) */
  between?: (f: number, game: any) => void; }
export interface ReplayReport {
  file: string; ok: boolean; bad: string; frames: number; replayed: number; seconds: number;
  digestsChecked: number; digestMismatch: { f: number; diffs: string[] } | null;
  sensor: { divergences: number; unjournaled: number; unasked: number; first: { f: number; kind: string; key: string; detail: string } | null; reads: number };
  violations: { f: number; kind: string; text: string }[];
  lastDigestOk: boolean;
}

/** a session file off the disk: .json, or .json.gz (the fixtures are kept gzipped — a 90 s session is ~450 KB of JSON, ~80 KB gzipped) */
export function readSession(path: string): any {
  const raw = readFileSync(path);
  const text = path.endsWith('.gz') ? new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(raw))) : raw.toString('utf8');
  return JSON.parse(text);
}
export const isSessionName = (n: string) => n.endsWith('.json') || n.endsWith('.json.gz');

/** Replay one parsed session file; never throws on a bad file (report.bad says why). */
export async function replaySession(F: any, name: string, opts: ReplayOpts = {}): Promise<ReplayReport> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const R: ReplayReport = { file: name, ok: false, bad: '', frames: 0, replayed: 0, seconds: 0, digestsChecked: 0, digestMismatch: null, sensor: { divergences: 0, unjournaled: 0, unasked: 0, first: null, reads: 0 }, violations: [], lastDigestOk: false };
  const bad = J.checkSessionFile(F); if (bad) { R.bad = bad; return R; }
  R.frames = F.frames;
  // ---- stand up as recorded: env → settings / particles / canister row; the checkpoint; the knobs; the staggers; the seed
  Math.random = simDie(0x5e55, Math.random);   // (whatever the fresh boot draws before the load: nothing after it depends on it)
  if (!(F.knobs as any)?.tables?.DOORWAY) (await import(`${ROOT}/src/game/doors.ts`)).DOORWAY.oneWay = false;   // (a recording from before the doors had one side carries no table: it was made on the double-acting leaves, whatever the last file in this process left)
  // (the maths the file was recorded on — src/math/exact.ts — said as the stand's own word for this one stand-up, so the level and the game are BUILT on it:
  //  applyKnobs below comes after the build. The word is put back at once: the next stand-up in this process is the caller's own)
  const saidExact = process.env.TPS_EXACT; process.env.TPS_EXACT = (F.knobs as any)?.tables?.EXACT?.on ? '1' : '0';
  // (… and whether a vehicle's lamps were light targets — src/game/carlamps.ts: the Game reads that switch as it is built, so a file from before the table, or one
  //  recorded with it off, is stood up with none; said the same way, put back the same way)
  const saidLamps = process.env.TPS_CARLAMPS; process.env.TPS_CARLAMPS = (F.knobs as any)?.tables?.CARLAMPS?.on ? '1' : '0';
  const saidRound = process.env.TPS_ROUND; process.env.TPS_ROUND = (F.knobs as any)?.tables?.ROUND?.on ? '1' : '0';   // (…and round things: the level's boxes are read as it is stood up — src/scene/round.ts)
  let W: Awaited<ReturnType<typeof standUp>>;
  try { W = await standUp({ env: F.env }); } finally { if (saidExact === undefined) delete process.env.TPS_EXACT; else process.env.TPS_EXACT = saidExact; if (saidLamps === undefined) delete process.env.TPS_CARLAMPS; else process.env.TPS_CARLAMPS = saidLamps; if (saidRound === undefined) delete process.env.TPS_ROUND; else process.env.TPS_ROUND = saidRound; }
  const { game, input, cam, canvas } = W;
  const fp = levelFingerprint(game); if (fp.fp !== F.level?.fp) { R.bad = `another level (file ${F.level?.fp} ${F.level?.boxes} boxes, this build ${fp.fp} ${fp.boxes} boxes) — re-record`; return R; }
  const whyNot = canLoad(game, F.save); if (whyNot) { R.bad = `the checkpoint will not load: ${whyNot}`; return R; }
  J.applyKnobs(game, F.knobs);            // (tune before the load too: loadState reads the tables — FOG.filed, whether the fog's memory in the file is handed back — so a tape from before a key loads with it off)
  loadState(game, F.save);
  J.applyKnobs(game, F.knobs); J.applyEnvGame(game, F.env);
  Math.random = simDie(F.seed >>> 0, (Math.random as any).sys ?? Math.random);
  game.sensors.replay(F.sensors);
  // (the checkpoint store as the recording found it: the rows the Enter once down chooses among; the text of one it loaded comes with its frame — journal.ts slotRead)
  const slotLoads: [number, string, string][] = F.slots?.loads ?? []; let slotI = 0; if (F.slots) game.saves.tapeSeed(F.slots);
  const P = new J.SessionPlayer(F);
  const last = F.frames - (F.meta?.lost ? 1 : 0);   // (a recording ended by a load no replay can make — journal.ts cut, `lost`: its last frame is that load's, and is not played)
  const until = Math.min(last, opts.until ?? Infinity);
  // ---- invariants' memory
  let prevPl: Vec3 | null = null; const col = game.col;
  const violate = (f: number, kind: string, text: string) => { if (R.violations.length < 40) R.violations.push({ f, kind, text }); };
  const finiteChar = (c: any) => [c.pos[0], c.pos[1], c.pos[2], c.bodyYaw, c.aimYaw, c.aimPitch].every(Number.isFinite);
  const p2 = (p: Vec3) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
  let playerRef = game.player;
  // ---- the frames
  let f = 0, stoppedEarly = '';
  for (; f < until; f++) {
    opts.between?.(f, game);
    while (slotI < slotLoads.length && slotLoads[slotI][0] <= f) { game.saves.tapeText(slotLoads[slotI][1], slotLoads[slotI][2]); slotI++; }
    const dt = P.applyFrame(f, input, cam, canvas);
    game.sensors.beginFrame();
    game.update(dt, input, cam, canvas);
    game.sensors.endFrame();
    W.engine.lights.update(dt, game.time);
    W.engine.world.dynamics = game.dynBoxes; W.engine.world.upload();
    input.endFrame();
    R.replayed = f + 1; R.seconds += dt;
    // digest on the recording's beat
    const want = P.digestAt(f);
    if (want && f === F.frames - 1 && F.meta?.between && F.env.hud) J.hudExpireBubbles(game);   // (a recording finished between two frames — journal.ts finish: its closing digest was taken after the HUD's write of that frame, so the replay makes the write first)
    if (want) {
      R.digestsChecked++; const have = digestGame(game, true);
      if (JSON.stringify(have) !== JSON.stringify(want)) { if (!R.digestMismatch) { R.digestMismatch = { f, diffs: diffDigest(want, have, 14) }; if (!opts.quiet) log(`  ✗ digest mismatch after frame ${f} (t ${game.time.toFixed(2)} s) — recorded ≠ replayed:\n      ${R.digestMismatch.diffs.join('\n      ')}`); } if (opts.strict) { stoppedEarly = 'digest'; f++; break; } }
      else if (f === F.frames - 1) R.lastDigestOk = true;
    }
    if (F.env.hud) J.hudExpireBubbles(game);   // a page recording: the HUD nulled expired bubbles here, after the update (and after the journal's digest of it) — so does the replay
    // sensors
    const S = game.sensors; if (S.firstDivergence && !R.sensor.first) { R.sensor.first = { ...S.firstDivergence }; if (!opts.quiet) log(`  ✗ sensor divergence on frame ${S.firstDivergence.f}: ${S.firstDivergence.detail}`); if (opts.strict) { stoppedEarly = 'sensor'; f++; break; } }
    // invariants (the soak's essential subset)
    if (opts.invariants) {
      const pl = game.player, pc = pl.char;
      if (game.player !== playerRef) { playerRef = game.player; prevPl = null; }   // (a restart mid-session — Shift+Enter — is a new man, not a jump)
      if (!finiteChar(pc)) violate(f, 'nan', `player pos / yaw not finite: ${pc.pos} ${pc.bodyYaw}`);
      const pp = pc.pos; if (pp[0] < -0.5 || pp[0] > 40.5 || pp[2] < -0.5 || pp[2] > 28.5) violate(f, 'out-of-world', `player at ${p2(pp)}`);
      for (const gd of game.guards) {
        const c = gd.char;
        if (!finiteChar(c) || !Number.isFinite(gd.speed) || !Number.isFinite(gd.awareness)) violate(f, 'nan', `${gd.callsign} pos ${c.pos} speed ${gd.speed} aw ${gd.awareness}`);
        if (c.pos[0] < -0.5 || c.pos[0] > 40.5 || c.pos[2] < -0.5 || c.pos[2] > 28.5) violate(f, 'out-of-world', `${gd.callsign} at ${p2(c.pos)} (${gd.state})`);
        if (!['patrol', 'suspicious', 'alert', 'search', 'dead'].includes(gd.state)) violate(f, 'bad-state', `${gd.callsign} state ${gd.state}`);
        if (gd.awareness < -1e-6 || gd.awareness > 1 + 1e-6) violate(f, 'awareness-range', `${gd.callsign} awareness ${gd.awareness}`);
        if (Math.abs(gd.speed) > 6) violate(f, 'speed-range', `${gd.callsign} speed ${gd.speed}`);
        if (f % 10 === 0 && gd.state !== 'dead') { const q = v3.copy(c.pos); if (col.collideCircle(q, 0.22, 0.3, 1.4, 1) && v3.distXZ(q, c.pos) > 0.06) violate(f, 'in-geometry', `${gd.callsign} ${v3.distXZ(q, c.pos).toFixed(2)} m inside static geometry at ${p2(c.pos)}`); }
      }
      const cur = v3.copy(pc.pos);
      if (prevPl && !pl.down) {
        const d = v3.distXZ(prevPl, cur);
        if (d > 0.3) { const wall = col.segmentBlocked([prevPl[0], 0.6, prevPl[2]], [cur[0], 0.6, cur[2]]) && col.segmentBlocked([prevPl[0], 1.2, prevPl[2]], [cur[0], 1.2, cur[2]]); if (wall) violate(f, 'popped-through-wall', `player jumped ${d.toFixed(2)} m THROUGH static geometry ${p2(prevPl)} → ${p2(cur)}`); }   // (a teleport / a checkpoint load is a legitimate long jump; only one through a wall is not)
        else if (d > 1e-3 && col.segmentBlocked([prevPl[0], 0.45, prevPl[2]], [cur[0], 0.45, cur[2]], 0) && col.segmentBlocked([prevPl[0], 0.9, prevPl[2]], [cur[0], 0.9, cur[2]], 0) && !col.segmentBlockedDynamic([prevPl[0], 0.45, prevPl[2]], [cur[0], 0.45, cur[2]]) && !col.segmentBlockedDynamic([prevPl[0], 0.9, prevPl[2]], [cur[0], 0.9, cur[2]])) violate(f, 'player-crossed-wall', `player crossed static geometry between frames: ${p2(prevPl)} → ${p2(cur)} (${d.toFixed(3)} m)`);
      }
      prevPl = cur;
      if (!pl.down) { const q = v3.copy(pc.pos); if (col.collideCircle(q, playerBodyR(game, pc.pos), 0.2, pl.crouch ? 1.0 : 1.7, 1) && v3.distXZ(q, pc.pos) > 0.03) violate(f, 'in-geometry', `player's circle ${v3.distXZ(q, pc.pos).toFixed(3)} m into static geometry at frame end at ${p2(pc.pos)}`); }
    }
  }
  const S = game.sensors.stats; R.sensor.divergences = S.divergences; R.sensor.unjournaled = S.unjournaled; R.sensor.unasked = S.unasked; R.sensor.reads = S.reads;
  if (!R.sensor.first && game.sensors.firstDivergence) R.sensor.first = { ...game.sensors.firstDivergence };
  const complete = R.replayed === last;
  R.ok = !R.digestMismatch && !R.sensor.first && !R.violations.length && (complete ? R.lastDigestOk || !!F.meta?.lost : !stoppedEarly);
  R.seconds = +R.seconds.toFixed(2);
  return R;
}

/** one line + the details for a report */
export function reportLines(R: ReplayReport, verbose = true): string[] {
  const out: string[] = [];
  if (R.bad) { out.push(`- FAIL — ${R.file}: BAD FILE — ${R.bad}`); return out; }
  const head = `${R.file}: ${R.replayed}/${R.frames} frames (${R.seconds} s) · ${R.digestsChecked} digests checked${R.digestMismatch ? `, FIRST MISMATCH after frame ${R.digestMismatch.f}` : ', all agree'} · ${R.sensor.reads} sensor reads served, ${R.sensor.divergences} divergence(s)${R.sensor.first ? ` (first: frame ${R.sensor.first.f}, ${R.sensor.first.kind} '${R.sensor.first.key}')` : ''}${R.violations.length ? ` · ${R.violations.length} INVARIANT VIOLATION(S)` : ''}`;
  out.push(`- ${R.ok ? 'PASS' : 'FAIL'} — ${head}`);
  if (verbose) {
    if (R.digestMismatch) out.push(...R.digestMismatch.diffs.map(d => `    digest: ${d}`));
    if (R.sensor.first) out.push(`    sensor: ${R.sensor.first.detail}`);
    for (const v of R.violations.slice(0, 6)) out.push(`    invariant '${v.kind}' frame ${v.f}: ${v.text}`);
  }
  return out;
}

// ================================================================================================================================ CLI
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (k: string) => argv.includes(`--${k}`);
  const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const KNOWN_FLAGS = ['strict', 'invariants', 'until', 'quiet', 'all'];
  for (const a of argv) if (a.startsWith('--') && !KNOWN_FLAGS.includes(a.slice(2))) { console.error(`error: unknown flag ${a} (known: ${KNOWN_FLAGS.map(k => '--' + k).join(' ')})`); process.exit(2); }
  const opts: ReplayOpts = { strict: flag('strict'), invariants: flag('invariants'), until: val('until') ? Number(val('until')) : undefined, quiet: flag('quiet') };
  let files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--until');
  if (flag('all')) { const dir = resolve(ROOT, 'tools/qa/sessions'); files = existsSync(dir) ? readdirSync(dir).filter(isSessionName).sort().map(n => resolve(dir, n)) : []; if (!files.length) { console.error(`error: no *.json / *.json.gz in tools/qa/sessions/`); process.exit(2); } }
  if (!files.length) { console.error('usage: bun run tools/qa/replay.ts <session.json[.gz] …> | --all  [--strict] [--invariants] [--until F] [--quiet]'); process.exit(2); }
  console.log(`\n=== replay: ${files.length} session file(s)${opts.strict ? ' · strict' : ''}${opts.invariants ? ' · invariants' : ''}${opts.until !== undefined ? ` · until frame ${opts.until}` : ''} ===`);
  let fails = 0, bad = 0;
  for (const path of files) {
    let F: any = null;
    try { F = readSession(path); } catch (e: any) { console.log(`- FAIL — ${basename(path)}: cannot read / parse — ${e?.message ?? e}`); bad++; continue; }
    const t0 = performance.now();
    const R = await replaySession(F, basename(path), opts);
    if (R.bad) bad++; else if (!R.ok) fails++;
    for (const ln of reportLines(R)) console.log(ln);
    if (!opts.quiet && !R.bad) console.log(`    (${((performance.now() - t0) / 1000).toFixed(1)} s wall · recorded ${F.recordedAt ?? '?'}${F.commit ? ` on ${F.commit}` : ''}${F.note ? ` · ${F.note}` : ''} · seed ${F.seed} · ${F.frames} frames)`);
  }
  console.log(`\n=== replay: ${fails || bad ? `${fails} FAIL${bad ? ` · ${bad} BAD FILE` : ''}` : 'ALL PASS'} ===`);
  process.exit(bad && !fails && files.length === bad ? 2 : fails || bad ? 1 : 0);
}
