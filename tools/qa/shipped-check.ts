#!/usr/bin/env bun
// THE TWO STANDS, CHECKED WITHOUT A PAGE (src/host/profile.ts) — `bun run tools/qa/shipped-check.ts`, and `probes.ts shipped-profile` (family shipped):
//   1. the harness stood up frozen and stood up shipped (TPS_PROFILE=shipped) differ in exactly the rows FROZEN_HOLDS names — a pin added to the harness and not
//      to that list, or a row listed that no longer differs, is red, and says which;
//   2. the same on a mission's own stand (a squad of four started on a level file), so a rule that only a staging writes is seen too;
//   3. the play-through's own as-shipped lines (playthrough.ts: the doors, the chaos) write what the shipped stand already has — under the shipped profile the
//      play-through adds nothing of its own.
// Each stand is its own bun (the pins run as headless.ts loads), with every word either stand reads cleared from its environment first.
// That the SHIPPED stand is the page's is the other half, and needs the page: `node tools/qa/shipped-page.cjs` (software adapter, ~3 minutes a boot).
// Exit 0 = all pass, 1 = a check failed.
import { resolve } from 'node:path';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dumpDiff, type StandDump } from './stand-dump.ts';
const ROOT = resolve(import.meta.dir, '../..');
const MISSION = 'levelFile=compound.json&roomclear&squad4';

async function stand(profile: 'frozen' | 'shipped', query: string, dir: string): Promise<StandDump> {
  const out = resolve(dir, `${profile}-${query ? 'mission' : 'plain'}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'stand-dump.ts'), '--profile', profile, '--query', query, '--out', out], { stdout: 'ignore', stderr: 'pipe' });   // (--profile clears the invoking shell's stand words in the child)
  const [err, code] = await Promise.all([new Response(pr.stderr).text(), pr.exited]);
  if (code !== 0) throw new Error(`stand-dump (${profile}${query ? `, ${query}` : ''}) failed: ${err.slice(-600)}`);
  return JSON.parse(readFileSync(out, 'utf8')) as StandDump;
}

export async function shippedCheck(): Promise<boolean> {
  const { FROZEN_HOLDS, STAND_ENV } = await import(`${ROOT}/src/host/profile.ts`) as { FROZEN_HOLDS: Record<string, string>; STAND_ENV: readonly string[] };
  let ok = true; const check = (pass: boolean, what: string) => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}`); if (!pass) ok = false; };
  const dir = mkdtempSync(resolve(tmpdir(), 'shipped-check-'));
  try {
    const listed = Object.keys(FROZEN_HOLDS).sort();
    for (const [name, query] of [['the plain stand', ''], ['a mission staged (the compound, four)', MISSION]] as const) {
      const [fr, sh] = await Promise.all([stand('frozen', query, dir), stand('shipped', query, dir)]);
      const rows = dumpDiff(fr, sh), got = rows.map(r => r[0]).sort();
      const unlisted = got.filter(k => !listed.includes(k)), stale = listed.filter(k => !got.includes(k));
      check(unlisted.length === 0 && stale.length === 0, `${name}: frozen and shipped differ in exactly FROZEN_HOLDS' ${listed.length} rows`
        + (unlisted.length ? ` — the harness holds these and the list does not name them: ${unlisted.map(k => { const r = rows.find(x => x[0] === k)!; return `${k} (${JSON.stringify(r[1])} frozen, ${JSON.stringify(r[2])} shipped)`; }).join(' · ')}` : '')
        + (stale.length ? ` — listed, and the two stands agree on them: ${stale.join(' · ')}` : ''));
      if (!query) {
        const T = sh.tables as Record<string, Record<string, unknown>>, tune = sh.tune as Record<string, unknown>;
        const want: [string, unknown, unknown][] = [['DOORWAY.oneWay', T.DOORWAY?.oneWay, true], ['DOORWAY.exitsOut', T.DOORWAY?.exitsOut, false], ['DOORWAY.frameHolds', T.DOORWAY?.frameHolds, true],
          ['DOORSTAY.on', T.DOORSTAY?.on, true], ['DOORMANNERS.on', T.DOORMANNERS?.on, true], ['DOORBLAST.on', T.DOORBLAST?.on, true], ['tune.chaos', tune.chaos, 0.5]];
        const off = want.filter(w => w[1] !== w[2]);
        check(off.length === 0, `the play-through's own as-shipped lines write what the shipped stand already has (${want.length} rows)${off.length ? ` — not so: ${off.map(w => `${w[0]} is ${JSON.stringify(w[1])}, the play-through writes ${JSON.stringify(w[2])}`).join(' · ')}` : ''}`);
      }
    }
    { // every word a harness pin answers to is on the list the comparisons clear (src/host/standEnv.ts) — else a stand compared here is the invoking shell's
      const words = new Set<string>(); for (const f of ['src/host/standup.ts', 'tools/qa/headless.ts', 'tools/qa/playthrough.ts']) for (const m of readFileSync(resolve(ROOT, f), 'utf8').matchAll(/pinned\('([A-Z_]+)'\)/g)) words.add(m[1]);
      const missing = [...words].filter(w => !STAND_ENV.includes(w));
      check(words.size > 0 && missing.length === 0, `every word a harness pin answers to (${words.size}: ${[...words].sort().join(' ')}) is in STAND_ENV${missing.length ? ` — missing: ${missing.join(' ')}` : ''}`); }
    console.log(`  (the rows, and the word that turns each on for a frozen run:\n${listed.map(k => `     ${k.padEnd(24)} ${FROZEN_HOLDS[k]}`).join('\n')})`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return ok;
}

if (import.meta.main) process.exit(await shippedCheck() ? 0 : 1);
