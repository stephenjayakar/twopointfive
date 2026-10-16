// GOING LOUD BRINGS THE RESPONSE — the check behind qrf.ts `silentNet` (`tune.qrfSilent`).
// The fault it holds shut (the missions goal's S2): the response team wanted a locked-down floor and only a living man of the shift locks it down, so a player
// who shot all three met nobody — control silent with gunfire in its ears, a minute in an empty building (the team came in 2 of 24 loud runs).
//   bun run tools/qa/qrf-silent-check.ts [--seeds 1-3] [--off]
// What it does, on the game stood AS THE PAGE SHIPS IT (tools/qa/solo-night.ts's stand): plays the `loud` plan under god mode (the rifle on every man who shows,
// the drive pulled, the server room held 60 s) per seed, and for every run in which the WHOLE shift went down:
//   1. THE CUE: control asks for a radio check on the net, after the last man fell and before the team is sent
//   2. THE RESPONSE: the team is requested within WITHIN_SECS (20) of the last man falling, and control says how many, where from and how long
// and STAGED, on one game (the rule's edges, each from a fresh encounter):
//   3. QUIET WORK NEVER STARTS IT: all three put out cold with no gunfire heard — thirty seconds on, no radio check and the team idle
//   4. OLD GUNFIRE DOES NOT COUNT: the same with gunfire last heard 200 s before (the trigger's memory is 180) — nothing
//   5. A MAN BACK ON THE NET CANCELS IT: gunfire heard, two out cold, the third in Sam's arm — the radio check comes; let go of before the fourteen seconds,
//      nothing is sent for twenty more; out cold himself, the check comes again and the team is requested fourteen seconds after that
//   --off  the same with the rule off (TPS_QRFSILENT=0): the fault as it was — expected to FAIL (exit 1; read the lines: 2 and 5 say NEVER), the proof the check can
// exit 0 = all hold · 1 = one does not, a run errored, or no played run downed the whole shift before the team was called (NO VERDICT: the played half looked at nothing) · 2 = bad flags
import { resolve } from 'node:path';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--seeds', '--off', '--staged'].includes(a)) { console.error(`unknown flag ${a} (--seeds --off)`); process.exit(2); }
const off = argv.includes('--off');
const seeds = (flag('--seeds') ?? '1-3').split(',').flatMap(s => { const m = /^(\d+)-(\d+)$/.exec(s); if (!m) return [Number(s)]; const out: number[] = []; for (let k = +m[1]; k <= +m[2]; k++) out.push(k); return out; });
if (!seeds.length || seeds.some(s => !Number.isFinite(s))) { console.error('bad --seeds'); process.exit(2); }
const WITHIN_SECS = 20;

if (argv.includes('--staged')) {   // a child: the staged edges as one JSON line (its own process: the switch is read as the game stands up)
  const { standUp, ROOT } = await import('./headless.ts');
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`), { startGrab } = await import(`${ROOT}/src/game/player.ts`);
  const log = console.log; console.log = console.error = console.warn = () => { };
  const W: any = await standUp({ uploadEvery: 4 }); const g = W.game; g.godMode = true;
  const run = (secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) W.step(1 / 60); };
  const what = () => (g.qrf.log as { t: number; what: string }[]).map(l => l.what);
  const out: { name: string; ok: boolean; words: string }[] = [];
  const cold = (gd: any) => killGuard(g, gd, [1, 0, 0], true, 'struck');
  { run(0.5); for (const gd of [...g.guards]) cold(gd); run(30);
    out.push({ name: 'quiet work never starts it', ok: g.qrf.state === 'idle' && !what().includes('radio-check') && g.guards.every((x: any) => x.state === 'dead'), words: `three out cold, no gunfire heard, 30 s on: team ${g.qrf.state}, log [${what().join(', ')}]` }); }
  { g.restartEncounter(); run(0.5); g.qrf.loudT = g.time - 200; for (const gd of [...g.guards]) cold(gd); run(30);
    out.push({ name: 'old gunfire does not count', ok: g.qrf.state === 'idle' && !what().includes('radio-check'), words: `gunfire last heard 200 s before the last man fell, 30 s on: team ${g.qrf.state}, log [${what().join(', ')}]` }); }
  { g.restartEncounter(); run(0.5); const [a, b, c] = g.guards as any[]; g.qrf.loudT = g.time; cold(a); cold(b);
    const yaw = c.char.bodyYaw; g.teleportPlayer([c.char.pos[0] - Math.sin(yaw) * 0.7, 0, c.char.pos[2] - Math.cos(yaw) * 0.7]); g.player.char.bodyYaw = g.player.char.aimYaw = yaw; g.player.holstered = true;
    startGrab(g, c); const grabbed = !!c.held; run(9); const checked = what().filter(x => x === 'radio-check').length, stillIdle = g.qrf.state === 'idle';
    c.held = null; run(20); const afterLetGo = g.qrf.state as string, alive = c.state !== 'dead';   // (let go of at nine seconds: he is back on the net)
    const t0 = g.time; if (alive) cold(c); let askedAt = -1; for (let i = 0; i < 60 * 20 && askedAt < 0; i++) { W.step(1 / 60); if (g.qrf.state !== 'idle') askedAt = g.time - t0; }
    const checks = what().filter(x => x === 'radio-check').length;
    out.push({ name: 'a man back on the net cancels it', ok: grabbed && checked === 1 && stillIdle && afterLetGo === 'idle' && alive && checks === 2 && askedAt > 13.5 && askedAt < 14.5 && g.qrf.reason === 'silent',
      words: `the third man ${grabbed ? 'in his arm' : 'NOT grabbed'}: ${checked} radio check by 9 s, team ${stillIdle ? 'idle' : 'CALLED'}; let go of, 20 s on: team ${afterLetGo}; then out cold: ${checks} radio checks in all, the team ${askedAt < 0 ? 'NEVER requested' : `requested ${askedAt.toFixed(1)} s after (reason ${g.qrf.reason})`}` }); }
  console.log = log; console.log(JSON.stringify(out)); process.exit(0);
}
let failed = false, looked = 0;
const dir = mkdtempSync(resolve(tmpdir(), 'qrf-silent-'));
const jobs = seeds.map(seed => async () => {
  const f = resolve(dir, `loud-${seed}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'solo-night.ts'), '--one', `loud:${seed}`, '--outfile', f, '--god', '--linger', '60'], { stdout: 'ignore', stderr: 'ignore', env: { ...process.env, TPS_QRFSILENT: off ? '0' : '1' } }); await pr.exited;
  let r: any = null; try { r = JSON.parse(readFileSync(f, 'utf8')); } catch { /* */ }
  if (!r || r.end === 'error') { failed = true; console.log(`- FAIL — loud:${seed} did not play (${r ? r.why.split('\n')[0] : 'no result file'})`); return; }
  const dead = Object.entries(r.firsts as Record<string, Record<string, number>>).filter(([n]) => !/^QRF/.test(n)).map(([n, f1]) => [n, f1.dead] as [string, number | undefined]), roster = Number(r.counts?.roster);
  if (!(roster >= 1)) { failed = true; console.log(`- FAIL — loud:${seed}: the run does not say how many men the shift had`); return; }
  if (dead.filter(([, t]) => t !== undefined).length < roster) { console.log(`- (loud:${seed}: ${dead.filter(([, t]) => t !== undefined).length} of the shift's ${roster} fell — a living man can call it in himself: not looked at)`); return; }
  { const last = Math.max(...dead.map(([, t]) => t!)), early = (r.qrfLog as string[]).map(l => l.split(' ')).find(l => l[1] === 'requested'); if (early && Number(early[0]) < last) { console.log(`- (loud:${seed}: the team was requested at ${early[0]} s, before the last man fell at ${last.toFixed(1)} s — a living man called it in: not looked at)`); return; } }
  looked++;
  const last = Math.max(...dead.map(([, t]) => t!)), log = (r.qrfLog as string[]).map(l => { const i = l.indexOf(' '); return { t: Number(l.slice(0, i)), what: l.slice(i + 1) }; });
  const check = log.find(l => l.t >= last && /radio check/.test(l.what)), asked = log.find(l => l.what === 'requested'), rolling = log.find(l => /QRF is rolling/.test(l.what) && /\d+ men/.test(l.what) && /\d+ seconds/.test(l.what));
  const ok = !!check && !!asked && check.t < asked.t && asked.t - last <= WITHIN_SECS && !!rolling;
  if (!ok) failed = true;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — loud:${seed}: the last of the shift fell at ${last.toFixed(1)} s · control's radio check ${check ? `at ${check.t} s` : 'NEVER'} · the team ${asked ? `requested at ${asked.t} s (${(asked.t - last).toFixed(1)} s after; the bar is ${WITHIN_SECS})` : 'NEVER requested'} · ${rolling ? `"${rolling.what.replace(/^CONTROL — /, '').slice(0, 90)}"` : 'no word of how many, where and when'}${r.qrf === 'deployed' ? ' · on the floor before the run ended' : ` · the run ended with the team ${r.qrf}`}`);
});
{ let k = 0; const worker = async () => { while (k < jobs.length) await jobs[k++](); }; await Promise.all([worker(), worker(), worker()]); }
rmSync(dir, { recursive: true, force: true });
{ const pr = Bun.spawn(['bun', 'run', import.meta.path, '--staged'], { stdout: 'pipe', stderr: 'ignore', env: { ...process.env, TPS_QRFSILENT: off ? '0' : '1' } });
  const text = await new Response(pr.stdout).text(); await pr.exited;
  let rows: { name: string; ok: boolean; words: string }[] | null = null; try { rows = JSON.parse(text.trim().split('\n').pop()!); } catch { /* */ }
  if (!rows || rows.length !== 3) { failed = true; console.log('- FAIL — the staged edges did not run'); }
  else for (const x of rows) { if (!x.ok) failed = true; console.log(`- ${x.ok ? 'PASS' : 'FAIL'} — staged, ${x.name}: ${x.words}`); } }
if (!looked && !failed) { console.log('=== qrf-silent-check: NO VERDICT (no played run downed the whole shift before the team was called) ==='); process.exit(1); }
console.log(failed ? `=== qrf-silent-check: FAILED${off ? ' (the rule is off: expected)' : ''} ===` : '=== qrf-silent-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
