#!/usr/bin/env bun
// THE KNOB REGISTRY'S CHECK (src/game/knobs.ts) — `bun run tools/qa/knobs-check.ts`, and `probes.ts journal-knobs` (family journal):
//   1. what a recording carries (journal.ts knobTables) is JOURNAL_KNOBS, name for name and in order, every one a registry table;
//      … and every table journal.ts asks a FILE for (`k.tables.X`, the rules that put a key off for a recording from before it) is one a recording carries;
//   2. every table the squad's feel panel keeps (teamfeel.ts feelTables) is in the registry under the same name AND is the same object;
//   3. knobsCopy → scribble → knobsBack puts every table back exactly (every value changed at every depth, a key added to every object, an element to every
//      array), in place (every nested object and array is still the same object);
//   4. every exported ALL-CAPS table under src/game that carries a boolean `on` is in the registry, or in UNREGISTERED below with its reason — a NEW one that is
//      in neither is a failure (a table with no such switch is not seen by this scan: it joins the registry by hand).
// Exit 0 = all pass, 1 = a check failed.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

/** exported tables with an `on` switch that are NOT in the registry, each with why (the six there were when this check went red on a seventh). What that costs a
 *  table: `playthrough.ts --set` cannot reach it, the probe runner does not put it back between probes, a session recording does not carry it, the page's
 *  `__knobs` and tools/qa/shipped-page.cjs do not see it. A table that changes what a run DOES belongs in src/game/knobs.ts, not here. */
const UNREGISTERED: Record<string, string> = {
  'FEEL (blastFeel.ts)': 'a wall charge going off: the camera kick, picture and sound only',
  'BLAST (blastLook.ts)': 'a set charge and its blast: picture only',
  'EDGE (edgeLook.ts)': "a broken wall's edges: the look only",
  'FIXLOOK (fixtureBreak.ts)': 'a fixture seen to break: the look only (its `on` is for its own proofs)',
  'BLAST_PACE (destructionSwitch.ts)': "when the blast frame's picture-only work runs (reach masks, rain drip lines, the furniture index made ahead): play is the same either way — TPS_BLASTPACE=old in front of a headless tool is its off",
  'KIT (kit.ts)': "each man's kit card, kept per machine and written by kitLoad / the loadout screen: a stand reads it through kitLoad, never as a knob",
  'KIT_SOLO (kit.ts)': "raised by the start card's Start on the solo night (kitSolo): a flag of that visit, not a knob",
};

export async function knobsCheck(): Promise<boolean> {
  await import('./headless.ts');   // the harness's module order (the game modules are one import cycle: enter it the way every probe does)
  const K: any = await import(`${ROOT}/src/game/knobs.ts`), J: any = await import(`${ROOT}/src/game/journal.ts`), F: any = await import(`${ROOT}/src/game/teamfeel.ts`);
  let ok = true; const check = (pass: boolean, what: string) => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}`); if (!pass) ok = false; };
  const R: Record<string, any> = K.knobRegistry(), names = Object.keys(R);

  const carried = Object.keys(J.knobTables()), want: string[] = [...K.JOURNAL_KNOBS];
  check(JSON.stringify(carried) === JSON.stringify(want), `a recording carries JOURNAL_KNOBS, name for name and in order (${carried.length} of ${want.length} tables; registry ${names.length})`);
  const lost = want.filter(n => !R[n]); check(lost.length === 0, `every JOURNAL_KNOBS name has a registry table${lost.length ? ` — missing: ${lost.join(' ')}` : ''}`);

  // 1b. a table the page's boot writes a key of (host/profile.ts pageSwitches) differs between the page and the stand a replay is stood on, so a recording
  //     has to carry it — or it is on PAGE_ONLY below with how a replay gets it (or why it need not)
  const PAGE_ONLY: Record<string, string> = {
    DESTRUCTION: "a recording's env.destruction", LIVED: "a recording's env.lived", LOOK: 'picture only', MUSIC: "the viewer's own score: a tape's player leaves it as the page has it (knobs.ts VISIT_OWN)",
    RECAP: 'reads only (the end card)', PLAN: 'picture only (marks on the floor)',
    FIXEDSTEP: "the page's frame loop, not a game rule: a recording replays the updates it holds whatever stepped them (knobs.ts VISIT_OWN)", TWEEN: 'picture only (what a frame between two ticks draws; knobs.ts VISIT_OWN)',
    SAVEPIC: "how this page takes a save's picture, set once at boot for the canvas: no run reads it (knobs.ts VISIT_OWN)",
    FINDTUNED: "which starts this machine's outline rows have, a picture setting: no run reads it (knobs.ts VISIT_OWN)",
  };
  const prof = readFileSync(`${ROOT}/src/host/profile.ts`, 'utf8'), body = prof.slice(prof.indexOf('export function pageSwitches'));
  const wrote = [...new Set([...body.slice(0, body.search(/^}/m)).matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z0-9_.]+ = /gm)].map(m => m[1]))];
  const uncarried = wrote.filter(n => !want.includes(n) && !(n in PAGE_ONLY));
  check(wrote.length > 20 && uncarried.length === 0, `every table the page's boot writes is carried by a recording or on PAGE_ONLY with its reason (${wrote.length} tables written)${uncarried.length ? ` — NOT CARRIED: ${uncarried.join(' ')} (add the name at the END of JOURNAL_KNOBS)` : ''}`);

  // 1c. a rule in journal.ts that asks a file for a table (`k.tables.X`: "a recording from before the key replays with it off") only works if a recording
  //     CARRIES that table. With X not in JOURNAL_KNOBS every file reads as one from before, and the key is put off whatever the run was recorded with
  //     (PAIR's four keys and ROOMFIGHT.doorEars stood so until 10-22: the rules were written, the names never joined the list)
  const asked = [...new Set([...readFileSync(`${ROOT}/src/game/journal.ts`, 'utf8').matchAll(/\bk\.tables\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]))], deaf = asked.filter(n => !want.includes(n));
  check(asked.length > 50 && deaf.length === 0, `every table journal.ts asks a file for (k.tables.X) is one a recording carries (${asked.length} asked)${deaf.length ? ` — NOT CARRIED, so its rule reads every file as one from before the key: ${deaf.join(' ')} (add the name at the END of JOURNAL_KNOBS)` : ''}`);

  const feel: Record<string, object> = F.feelTables(), strangers = Object.keys(feel).filter(n => R[n] !== feel[n]);
  check(strangers.length === 0, `the feel panel's ${Object.keys(feel).length} tables are the registry's own objects under the same names${strangers.length ? ` — not so: ${strangers.join(' ')}` : ''}`);

  // 3. the round trip, table by table: what the tables are now (a reference JSON with the non-JSON values spelled out), scribble, put back, compare — and the nested objects are still the same objects
  const { spell } = await import('./stand-dump.ts');
  const before = JSON.stringify(spell(R)), keep = K.knobsCopy(); const held: [string, object][] = []; let scribbled = 0;
  const isPlain = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
  /** every value under `o` changed, at every depth: a boolean flipped, a number moved, a string lengthened, a key added to every object, an element pushed on every
   *  array (and its own elements scribbled) — the objects and arrays met on the way remembered, to be found again in the same places afterwards */
  const scribble = (o: Record<string, any> | any[], path: string, skip?: readonly string[]) => {
    for (const k of Object.keys(o)) { if (skip?.includes(k)) continue;   // (data a table was loaded with — not a knob, never copied, never put back)
      const v = (o as any)[k], at = `${path}.${k}`;
      if (typeof v === 'boolean') { (o as any)[k] = !v; scribbled++; } else if (typeof v === 'number') { (o as any)[k] = Number.isFinite(v) ? v + 7 : 7; scribbled++; } else if (typeof v === 'string') { (o as any)[k] = v + '?'; scribbled++; }
      else if (Array.isArray(v) || isPlain(v)) { held.push([at, v]); scribble(v, at); } }
    if (Array.isArray(o)) o.push(-1); else (o as any).__added = 1;
  };
  for (const n of names) scribble(R[n], n, K.NOT_KNOBS[n]);
  const dirty = JSON.stringify(spell(R)) !== before; K.knobsBack(keep); const after = JSON.stringify(spell(R));
  if (after !== before) { const A = JSON.parse(before), B = JSON.parse(after); for (const n of names) if (JSON.stringify(A[n]) !== JSON.stringify(B[n])) for (const k of new Set([...Object.keys(A[n]), ...Object.keys(B[n])])) if (JSON.stringify(A[n][k]) !== JSON.stringify(B[n][k])) console.log(`    ${n}.${k}: ${JSON.stringify(A[n][k])?.slice(0, 80)} → ${JSON.stringify(B[n][k])?.slice(0, 80)}`); }
  check(dirty && after === before, `knobsCopy → ${scribbled} values scribbled at every depth (booleans, numbers, strings, array elements) + a key added to every object and an element to every array → knobsBack: every table reads as it did`);
  const at = (path: string): unknown => path.split('.').reduce((o: any, k) => o?.[k], R as any), moved = held.filter(([path, o]) => at(path) !== o);
  check(moved.length === 0, `put back IN PLACE: ${held.length} nested objects and arrays are still the same objects${moved.length ? ` — replaced: ${moved.slice(0, 12).map(m => m[0]).join(' ')}` : ''}`);

  // 4. tables with a switch that the registry does not hold
  const inReg = new Set<object>(Object.values(R)), cand: string[] = [];
  for (const f of readdirSync(`${ROOT}/src/game`).filter(f => f.endsWith('.ts')).sort()) {
    const src = readFileSync(`${ROOT}/src/game/${f}`, 'utf8'), found = [...src.matchAll(/^export const ([A-Z][A-Z0-9_]{2,})\b[^=\n]*=\s*\{/gm)].map(m => m[1]); if (!found.length) continue;
    const M: any = await import(`${ROOT}/src/game/${f}`).catch(() => null); if (!M) continue;
    for (const n of found) { const T = M[n]; if (T && typeof T === 'object' && typeof T.on === 'boolean' && !inReg.has(T) && !/_DEFAULTS$/.test(n)) cand.push(`${n} (${f})`); }
  }
  const fresh = cand.filter(c => !(c in UNREGISTERED)), gone = Object.keys(UNREGISTERED).filter(c => !cand.includes(c));
  check(fresh.length === 0, `every exported table with an \`on\` switch is in the registry or on this file's UNREGISTERED list with its reason (${cand.length} listed)${fresh.length ? ` — NEW: ${fresh.join(' · ')}: register it in src/game/knobs.ts or add it to UNREGISTERED in tools/qa/knobs-check.ts with a reason` : ''}`);
  if (gone.length) console.log(`  (a row of UNREGISTERED is no longer an unregistered table — registered, renamed or removed: ${gone.join(' · ')}: the row can come out)`);   // (never a failure: another change registering one of them must not turn this red)
  return ok;
}

if (import.meta.main) process.exit((await knobsCheck()) ? 0 : 1);
