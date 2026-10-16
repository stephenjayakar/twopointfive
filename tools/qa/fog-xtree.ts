// The fog of war's CROSS-TREE identity (game/fogofwar.ts): the same seeded runs printed as digests + dice counts, to be run once on the base tree and once on a
// tree carrying the fog with its switch OFF (the default) and diffed — "off = the game exactly as it was" between two checkouts, which a probe inside one tree
// cannot hold:
//   bun run tools/qa/fog-xtree.ts <path to a checkout>   > a.log      (e.g. a worktree at the base commit)
//   bun run tools/qa/fog-xtree.ts <path to this checkout> > b.log ;  diff a.log b.log
// Four seeds of the default night breach fought to the end at chaos 0.5, and four minutes of the ordinary night floor (digested every ten seconds as well).
const root = process.argv[2]; if (!root) { console.error('usage: bun run tools/qa/fog-xtree.ts <path to a checkout>'); process.exit(2); }
const { standUp, ROOT } = await import(`${root}/tools/qa/headless.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { createHash } = await import('node:crypto');
function seeded(a: number) { let n = 0; const f = () => { n++; a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; (f as any).draws = () => n; return f; }
const sha = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const DT = 1 / 60;
for (const seed of [21, 22, 23, 24]) {
  const dice = seeded(seed); Math.random = dice; const W: any = await standUp(); const g = W.game; g.tune.chaos = 0.5; const NB = g.nightBreach; NB.start();
  const step = (n: number) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(40); NB.order(); step(420); NB.order(); step(840);
  const d = JSON.stringify(digestGame(g)); console.log(`nightbreach seed ${seed}: ${NB.state} dice ${(dice as any).draws()} digest ${sha(d)} (${d.length} B) boxes ${g.dynBoxes.length}`);
}
{
  const dice = seeded(31); Math.random = dice; const W: any = await standUp(); const g = W.game; const hs: string[] = [];
  for (let i = 0; i < 60 * 240; i++) { g.player.visibility = 0.05; W.step(DT); if (i % 600 === 599) hs.push(sha(JSON.stringify(digestGame(g, true)))); }
  const d = JSON.stringify(digestGame(g)); console.log(`night floor 240 s: dice ${(dice as any).draws()} digest ${sha(d)} (${d.length} B) · every-10-s chain ${sha(hs.join())} · boxes ${g.dynBoxes.length}`);
}
export {};   // (a module, so the top-level awaits and names above are this file's own)
