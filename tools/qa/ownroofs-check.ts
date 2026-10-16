// A LEVEL'S OWN STORM RAINS BY THAT LEVEL'S OWN ROOFS (src/game/weather.ts syncRoofs, weatherKinds.ts WX_OWN.roofs).
//
// The maintainer on the records office at night, 10-11: "rain is busted on records office". With no weather picked, the night storm was cut by the OFFICE's two
// rectangles (INTERIOR 4‥36 × 4‥24, the stair tower) on every level: the records office's whole car park lies inside the first, so no rain was drawn on it, nobody
// standing there got wet, no storm wind blew there — and the rain showed only on the strip of ground outside the office's footprint. The rule now: a level whose
// roofs are not the office's two has its storm cut by its own ceiling slabs, as a picked weather's always was.
//
//   bun run tools/qa/ownroofs-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   OWNROOFS_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts ownroofs      (also under `weather`)
//
//   open      every lattice point of a level's ground with open sky over it (an upward ray meets nothing solid; half a metre of slack at a roof's edge) is rained on, and every point under a ceiling
//             slab is not: the share the footprints get wrong is ~0 with the rule and large without it (the records office, the compound, the barracks)
//   frame     what the renderer is handed: the first two roofs as the two rectangles, the third and fourth packed, the rain rate as ever, no fog
//   wet       a man stood on the records office's car park is soaked with the rule, dry without it; under the building's roof he stays dry either way
//   wind      the storm's wind is cut by the same roofs
//   gust      an outside door the office's stair-tower rule kept still (the warehouse's fire exit) blows in when it stands open, like every other door onto open air
//   same      the office, and the level built in its shell (the block), keep the office's two rectangles to the bit, rule on or off
//   quiet     a quiet level keeps its dry, still night
//   kind      a picked weather takes over and hands back; the switch thrown on a running game follows inside a frame
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function ownRoofsCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { WX_OWN } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { INTERIOR, ANNEX } = await import(`${ROOT}/src/game/weather.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const BREAK = process.env.OWNROOFS_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = WX_OWN.roofs;
  const eq = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

  async function rig(file: string, rule: boolean) {
    WX_OWN.roofs = rule && !BREAK;
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl })); const g = W.game; g.godMode = true; g.aiEnabled = false;
    WX_OWN.roofs = rule && !BREAK;   // (the stand-up pins it off on the frozen stand: this check raises it itself, on either stand)
    const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
    step(3);
    // (the switch is one table for the process: every step of a rig is made under that rig's own setting, and a frame is handed back as a COPY — the engine's is written in place)
    const set = () => { WX_OWN.roofs = rule && !BREAK; };
    return { W, g, set, step: (n = 1) => { set(); step(n); }, wx: g.weather as any, frame: () => { const F = (g.engine as any).weather; return { ...F, interior: [...F.interior], annex: [...F.annex] } as any; } };
  }
  /** the ground's lattice (1 m, a metre in from the world's edge): open sky / under a ceiling slab by an upward ray, against what the footprints say */
  function tally(R: Awaited<ReturnType<typeof rig>>) {
    const { g, wx } = R; let open = 0, openDry = 0, roofed = 0, roofedRain = 0; let first: number[] | null = null; const dry: string[] = [];
    for (let x = WORLD.min[0] + 1.5; x < WORLD.max[0] - 1; x += 1) for (let z = WORLD.min[2] + 1.5; z < WORLD.max[2] - 1; z += 1) {
      const sky = !g.col.solidBlocked([x, 0.3, z], [x, WORLD.ceilingY + 6, z]);
      const slab = !sky && !g.col.solidBlocked([x, 0.3, z], [x, WORLD.ceilingY - 0.4, z]) && [-0.45, 0.45].every(d => g.col.solidBlocked([x + d, WORLD.ceilingY - 0.4, z + d], [x + d, WORLD.ceilingY + 0.6, z + d]));
      const under = wx.underRoof(x, z);
      // (a footprint is its slab padded 0.16 m, the third and fourth packed outward to 0.2 m: an open point counts as kept dry only half a metre inside one)
      const deep = under && [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]].every(d => wx.underRoof(x + d[0], z + d[1]));
      if (sky) { open++; if (deep) { openDry++; dry.push(`${x},${z}`); if (x > 5 && !first) first = [x, z]; } } else if (slab) { roofed++; if (!under) roofedRain++; }
    }
    return { open, openDry, roofed, roofedRain, first, dry };
  }

  try {
    // ---- open / frame / wet / wind: three levels of their own shape
    for (const file of ['records.json', 'compound.json', 'barracks.json', 'depot.json']) {   // (the depot was built in the office's shell until its floor was rebuilt, 10-13: it is a level of its own shape now)
      const off = await rig(file, false); const tOff = tally(off); const offOwn = off.wx.ownStorm; const offF = off.frame();
      const on = await rig(file, true); const t = tally(on); const F = on.frame(); const roofs = on.wx.roofs as number[][];
      if (o.verbose && t.dry.length) console.log(`    ${file}: open points the level's roofs keep dry: ${t.dry.join(' · ')}`);
      verdict(on.wx.ownStorm === true && offOwn === false && t.openDry === 0 && t.roofedRain <= Math.ceil(t.roofed * 0.02) && tOff.openDry > 0,
        `open — ${file}: rain over all open ground, none under its roofs`,
        `with the rule: ${t.openDry} of ${t.open} open-sky points kept dry, ${t.roofedRain} of ${t.roofed} roofed points rained on · without: ${tOff.openDry} of ${tOff.open} open-sky points kept dry (first at ${tOff.first?.map(v => v.toFixed(1)).join(', ') ?? '—'}), ${tOff.roofedRain} of ${tOff.roofed} roofed rained on`);
      verdict(F.rain > 0 && F.rain === offF.rain && eq(F.interior, roofs[0]) && eq(F.annex, roofs[1]) && F.roofC !== 0 && (roofs.length > 2) === (F.roofC !== 1) && (roofs.length > 3) === (F.roofD !== 0) && F.fog === 0 && eq(offF.interior, INTERIOR) && offF.roofC === 0,
        `frame — ${file}: the renderer is handed the level's ${roofs.length} roofs, the storm's own rain, no fog`,
        `rain ${F.rain} (without: ${offF.rain}) · rect 1 ${F.interior.map((v: number) => v.toFixed(2)).join(', ')} · rect 2 ${F.annex.map((v: number) => v.toFixed(2)).join(', ')} · packed ${F.roofC} / ${F.roofD} · fog ${F.fog} · without: rect 1 ${offF.interior.join(', ')}, packed ${offF.roofC}`);
      const S = (on.g.wind as any).storm, So = (off.g.wind as any).storm;
      const want = roofs.length <= 2 ? roofs[0] : [Math.min(...roofs.map(r => r[0])), Math.min(...roofs.map(r => r[1])), Math.max(...roofs.map(r => r[2])), Math.max(...roofs.map(r => r[3]))];
      verdict(on.wx.ownStorm === true && eq(S.interior, want) && !eq(S.interior, INTERIOR) && eq(So.interior, INTERIOR) && eq(So.annex, ANNEX),
        `wind — ${file}: the storm's air is kept out by the same roofs`, `storm record ${S.interior.map((v: number) => v.toFixed(2)).join(', ')} · without: ${So.interior.join(', ')}`);
      if (file === 'records.json' && tOff.first) {
        // a man on the car park (the first open point the old footprints kept dry), then a man under the building's own roof
        const soak = (R: typeof on, p: number[]) => { const c = R.g.player.char; c.wet = 0; c.beads = 0; R.g.teleportPlayer([p[0], 0, p[1]]); R.step(240); return c.wet as number; };
        const lot = tOff.first; const r0 = roofs[0]; const inside = [(r0[0] + r0[2]) / 2, (r0[1] + r0[3]) / 2];
        const wOn = soak(on, lot), wOff = soak(off, lot);
        verdict(wOn > 0.3 && wOff === 0, `wet — a man on the records office's car park is rained on`, `four seconds at (${lot.map(v => v.toFixed(1)).join(', ')}): coat ${wOn.toFixed(2)} with the rule, ${wOff.toFixed(2)} without`);
        const dOn = soak(on, inside);
        verdict(dOn === 0, `wet — under the building's roof he stays dry`, `four seconds at (${inside.map(v => v.toFixed(1)).join(', ')}): coat ${dOn.toFixed(2)}`);
        // kind: a picked weather takes over and hands back; the switch thrown live
        const wx = on.wx; on.set(); const k1 = wx.setKind('rain'); const own1 = wx.ownStorm, n1 = wx.roofs.length; wx.setKind(null); on.step(1); const own2 = wx.ownStorm, F2 = on.frame();
        WX_OWN.roofs = false; on.W.step(DT); const own3 = wx.ownStorm, r3 = eq(wx.roofs[0], INTERIOR), F3 = on.frame(); on.step(1); const own4 = wx.ownStorm;
        verdict(k1 && !own1 && n1 === roofs.length && own2 && eq(F2.interior, roofs[0]) && !own3 && r3 && eq(F3.interior, INTERIOR) && F3.roofC === 0 && own4,
          `kind — a picked weather takes over and hands back; the switch thrown on a running game follows`,
          `rain picked: own ${own1}, ${n1} roofs · unpicked: own ${own2} · switch off: own ${own3}, the office's rectangle ${r3}, packed ${F3.roofC} · on again: own ${own4}`);
      }
    }
    // ---- gust: an outside door the office's stair tower rule left without a gust has one under the level's own roofs
    { const gusts = (R: Awaited<ReturnType<typeof rig>>) => ((R.g.wind as any).all as { why: string; name: string }[]).filter(s => s.why === 'door').map(s => s.name);
      const off = await rig('warehouse.json', false); const a = gusts(off); const on = await rig('warehouse.json', true); const b = gusts(on);
      // at real size the fire exit's 0.9 m doorway no longer faces the office's stair-tower rectangle (its middle moved from z 9.40 to 9.25, the rectangle starts at 9.33), so it has its gust without the rule too: the line holds that no door loses one and the fire exit has its own, not that the rule added it
      verdict(b.length >= a.length && a.every(n => b.includes(n)) && b.includes('door:fire_exit'), `gust — warehouse.json: the fire exit's gust is there under the level's own roofs`, `doors with a gust: ${b.join(', ')} · without the rule: ${a.join(', ') || 'none'}`); }
    // ---- same: the office and the levels in its shell
    for (const file of ['office.json', 'block.json']) {
      const on = await rig(file, true); const F = on.frame(); const t = tally(on);
      verdict(on.wx.ownStorm === false && on.wx.roofs[0] === INTERIOR && on.wx.roofs[1] === ANNEX && eq(F.interior, INTERIOR) && eq(F.annex, ANNEX) && F.roofC === 0 && F.roofD === 0,
        `same — ${file}: the office's two rectangles, as ever`, `own ${on.wx.ownStorm} · rect 1 ${F.interior.join(', ')} · packed ${F.roofC} · ${t.openDry} of ${t.open} open points dry, ${t.roofedRain} of ${t.roofed} roofed rained on`);
    }
    // ---- quiet: a quiet level's night stays dry and still
    { const on = await rig('bazaar.json', true); const F = on.frame();
      verdict(on.wx.ownStorm === false && F.rain === 0 && on.wx.storm === 0, `quiet — bazaar.json keeps its dry, still night`, `own ${on.wx.ownStorm} · rain ${F.rain} · storm ${on.wx.storm}`); }
  } finally { WX_OWN.roofs = was; }
  console.log(fails ? `ownroofs: ${fails} of ${checks} FAILED` : `ownroofs: ALL PASS (${checks} checks)`);
  return fails === 0;
}

if (import.meta.main) { const ok = await ownRoofsCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
