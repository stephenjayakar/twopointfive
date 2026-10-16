// The rows, sets and squad counts of every member's card as a tree's game/kit.ts has them, as JSON on stdout: fixtures/kit-rows-base.json is this run in a
// checkout of the build BEFORE the pouches rule (a7ce1d6), and probes.ts pouch-table compares the rule switched off (?noslots) against it word for word.
//   git worktree add /tmp/base a7ce1d6 && bun run tools/qa/kit-rows-fixture.ts /tmp/base '' 'a7ce1d6 (the one build before the pouches rule)' > tools/qa/fixtures/kit-rows-base.json
//   bun run tools/qa/kit-rows-fixture.ts "$PWD" '?noslots'      (this tree with the rule off: the same JSON but for its "from" — and for a teammate's
//                                                                Smoke canisters row, added since: pouch-table takes it out of its side. Never re-freeze the fixture from this tree.)
const root = process.argv[2] ?? process.cwd();
const K = await import(`${root}/src/game/kit.ts`);
K.kitLoad(null, process.argv[3] ?? ''); K.kitReset();
const get = (r: any, m: any) => (K.rowGet ? K.rowGet(r, m) : m[r.field]);
const out: any = { from: process.argv[4] ?? '', members: [] };
for (let i = 0; i < K.KIT_MEMBERS; i++) out.members.push({ rows: K.kitRows(i).map((r: any) => ({ field: r.field, label: r.label, values: r.values, words: r.values.map((v: any) => r.word(v)), note: r.note(K.KIT.members[i]) })),
  sets: K.KIT_PRESETS.map((p: any) => { K.kitPreset(i, p.id); const w = K.kitWords(i), rows = K.kitRows(i).map((r: any) => get(r, K.KIT.members[i])); K.kitPreset(i, 'issued'); return { id: p.id, words: w, rows }; }) });
out.pool = [0, 1, 2, 3, 4].map(n => K.kitPool(n));
console.log(JSON.stringify(out, null, 1));
export {};   // (a module, so the top-level awaits and names above are this file's own)
