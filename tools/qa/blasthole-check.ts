// A HOLE A BLAST OPENS CAN BE WALKED THROUGH — the check behind FURN.mouth (src/game/furnblast.ts mouth(): on by default; off = whatever stood behind the wall
// stands in the hole). The flaw it was written against: a 40 mm into the records office's front-room partition opened the wall and left a chest of drawers
// standing in the hole (the wall shielded it from the burst, so neither the wall engine's cover rule nor the furniture's bands touched it).
//   bun run tools/qa/blasthole-check.ts [level …] [--max N] [--verbose] [--sheet]        (also `probes.ts blasthole`)
// Every level named (default: every mission level), with its lived-in furniture in and the destruction switches as the page has them: every inside partition the
// wall engine can open, up to three places along it, from both faces — a 40 mm's burst (frag.ts blast, the round's own stand-off) where a round could have flown
// to that place, then a body as wide as the player stood in the hole and pushed out through its far mouth with the player's own collision call.
//   FAIL = a hole opened and what keeps a body out of it, or stops it beyond, is a THING (not a wall, not structure, not a door frame's post, not glass).
//   counted, not failed: no hole (the burst opened a port only), a gap narrower than a body, structure in the way (a second wall, a pillar, a door frame),
//   a lit fixture in the way (a vending machine, a server rack: the lighting's own boxes, which no blast takes).
// --sheet = what the rule took that neither engine lists, per level (paint, size): read it for things that should not come apart.
// BLASTHOLE_BREAK=1 = the rule switched off and the same lines asked: must fail.   exit 0 = all hold · 1 = one does not
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type Vec3 = [number, number, number];
const LEVELS = ['office', 'records', 'depot', 'block', 'block-squads', 'warehouse', 'compound', 'barracks', 'registry', 'consulate', 'bazaar', 'police-post'];

export async function blastholeCheck(names: string[] = LEVELS, opts: { max?: number; verbose?: boolean; sheet?: boolean } = {}): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`);
  const { blast, FRAG } = await import(`${ROOT}/src/game/frag.ts`); const { HE40 } = await import(`${ROOT}/src/game/he40.ts`);
  const { FURN } = await import(`${ROOT}/src/game/furnblast.ts`);
  const { DESTRUCTION, FURNBLAST } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { paletteName } = await import(`${ROOT}/src/game/particleFx.ts`); const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const BREAK = process.env.BLASTHOLE_BREAK === '1'; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const was = { lived: LIVED.on, d: DESTRUCTION.on, f: FURNBLAST.on, m: FURN.mouth.on, rnd: Math.random };
  const STRUCT = new Set(['carpet', 'carpetBlue', 'carpetRed', 'lino', 'stone', 'asphalt', 'grass', 'wall', 'wallDark', 'concrete', 'ceiling', 'glassFrame', 'glass', 'glassExt', 'partRed', 'partBlue', 'partTan']);
  const R = 0.3, Y0 = 0.2, Y1 = 1.7, standoff: number = HE40?.standoff ?? 0.15;
  console.log(`\n=== blasthole: a hole a blast opens can be walked through${BREAK ? ' (BREAK: the rule off)' : ''} ===`);
  try {
    LIVED.on = true; DESTRUCTION.on = true; FURNBLAST.on = true; FURN.mouth.on = !BREAK;
    let grand = { asked: 0, holes: 0, through: 0, stuck: 0 };
    let ck: { name: string; at: Vec3; wall: number } | null = null;   // the first burst where the rule took a thing of neither engine's list: the checkpoint lines' site
    for (const name of names) {
      const file = resolve(ROOT, 'levels', `${name}.json`); if (!existsSync(file)) { line(false, `${name}: no such level file`); continue; }
      let seed = 12345; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(file, 'utf8'))) }); const g = W.game, col = g.col, walls = g.destr.walls;
      FURN.mouth.on = !BREAK;   // (the frozen stand holds it off at every stand-up)
      g.godMode = true; g.aiEnabled = false; g.tune.chaos = 0.5; for (let i = 0; i < 4; i++) W.step(1 / 60);
      const boxes = col.boxes, n: number = walls.authored;
      // a light's or a fixture's own box (a vending machine, a server rack) and what one stands on: the lighting's to break, never the blast's — counted apart
      const fixture = new Set<number>(g.level.breaker?.boxes ?? []); for (const t of g.targets) for (const bi of t.boxes) fixture.add(bi);
      for (const l of g.level.lights) { const fb = (l as any).fixtureBox; if (fb !== undefined && fb >= 0) fixture.add(fb); }
      for (const j of [...fixture]) { const o = boxes[j]; if (!o) continue; for (let i = 0; i < n; i++) { const u = boxes[i]; if (Math.abs(o.c[1] - o.h[1] - (u.c[1] + u.h[1])) <= 0.04 && Math.abs(o.c[0] - u.c[0]) < o.h[0] + u.h[0] && Math.abs(o.c[2] - u.c[2]) < o.h[2] + u.h[2]) fixture.add(i); } }
      const sites: { i: number; at: Vec3; s: number; ax: number }[] = [];
      for (let i = 0; i < n; i++) {
        const br = walls.breakableAt(i); if (!br || br.id !== i || br.kind !== 'wall' || br.hard) continue;
        const b = boxes[i]; if (Math.abs(b.yaw ?? 0) > 1e-3) continue;
        const ax = b.h[0] < b.h[2] ? 0 : 2, lx = ax === 0 ? 2 : 0, L = b.h[lx] * 2;
        for (const f of L > 2 ? [0.25, 0.5, 0.75] : [0.5]) for (const s of [-1, 1]) {
          const p: Vec3 = [b.c[0], 1.0, b.c[2]]; p[lx] = b.c[lx] - b.h[lx] + L * f; p[ax] = b.c[ax] - s * (b.h[ax] + standoff);
          const back: Vec3 = [p[0], 1.0, p[2]]; back[ax] -= s * 1.0;
          if (col.solidBlocked(back, p)) continue;   // (no round could have flown here)
          sites.push({ i, at: p, s, ax });
        }
      }
      const step = opts.max && sites.length > opts.max ? sites.length / opts.max : 1; const tally = { asked: 0, noHole: 0, narrow: 0, structure: 0, fixture: 0, through: 0, stuck: 0 };
      const fails = new Map<string, { n: number; first: string }>(); const taken = new Map<number, string>();
      for (let k = 0; k < sites.length; k += step) {
        const S = sites[Math.floor(k)]; const b = boxes[S.i], { ax, s } = S, lx = ax === 0 ? 2 : 0; tally.asked++;
        g.restartEncounter(); g.godMode = true; g.aiEnabled = false; W.step(1 / 60);
        const t0 = g.time; blast(g, [S.at[0], S.at[1] - FRAG.lift, S.at[2]], { who: g.player.char.id, name: '40 mm grenade' }); for (let f = 0; f < 3; f++) W.step(1 / 60);
        const took: number[] = g.destr.furn.snapshot()?.m ?? []; if (took.length && !ck) ck = { name, at: [S.at[0], S.at[1], S.at[2]], wall: S.i };
        for (const j of took) if (!taken.has(j)) { const o = boxes[j]; taken.set(j, `#${j} ${paletteName(o.albedo) ?? 'unnamed'} ${(o.h[0] * 2).toFixed(2)}×${(o.h[1] * 2).toFixed(2)}×${(o.h[2] * 2).toFixed(2)} top ${(o.c[1] + o.h[1]).toFixed(2)}`); }
        const rows = walls.changes.filter((c: any) => c.kind === 'hole' && c.id === S.i && c.t >= t0); if (!rows.length) { tally.noHole++; continue; }
        const u0 = Math.min(...rows.map((c: any) => c.rect[lx === 0 ? 0 : 1])), u1 = Math.max(...rows.map((c: any) => c.rect[lx === 0 ? 2 : 3]));
        const face = b.c[ax] + s * b.h[ax], goal = face + s * (R + 0.3);
        const lanes: number[] = []; if (u1 - u0 < 2 * R + 0.1) lanes.push((u0 + u1) / 2); else for (let u = u0 + R; u <= u1 - R + 1e-6; u += 0.1) lanes.push(u);
        let entered = false, best = -1e9, bestP: Vec3 | null = null, ok = false;
        for (const u of lanes) {
          const p: Vec3 = [0, 0, 0]; p[lx] = u; p[ax] = b.c[ax]; const q: Vec3 = [p[0], 0, p[2]]; col.collideCircle(q, R, Y0, Y1, 4);
          if (Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.02) continue; entered = true;
          for (let d = 0; d < 80 && (goal - p[ax]) * s > 0; d++) { p[ax] += s * 0.02; col.collideCircle(p, R, Y0, Y1, 4); }
          const got = (p[ax] - face) * s; if (got > best) { best = got; bestP = [p[0], 0, p[2]]; }
          if ((goal - p[ax]) * s <= 0.05 && Math.abs(p[lx] - u) <= 0.3) { ok = true; break; }
        }
        if (ok) { tally.through++; continue; }
        // what stops him: everything solid in his band within a body of a step on from where the best lane ended
        // (a body that does not even fit in the wall's own gap: asked at every lane's start — a thing hard against the far face is in its way there already)
        const at: Vec3[] = []; if (entered) { const c: Vec3 = [bestP![0], 0, bestP![2]]; c[ax] += s * 0.06; at.push(c); } else for (const u of lanes) { const c: Vec3 = [0, 0, 0]; c[lx] = u; c[ax] = b.c[ax]; at.push(c); }
        // (a lane the WALL itself shuts — a column that only lost its upper half — is nobody's fault: only a lane that things alone shut counts)
        const things: string[] = []; let structure = false, fixt = false;
        for (const c of at) {
          const mine: string[] = []; let st = false, fx = false;
          for (let j = 0; j < boxes.length; j++) {
            const o = boxes[j]; if (o.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Dynamic)) continue; if (o.c[1] - o.h[1] >= Y1 || o.c[1] + o.h[1] <= Y0) continue;
            const dx = Math.max(o.c[0] - o.h[0] - c[0], 0, c[0] - o.c[0] - o.h[0]), dz = Math.max(o.c[2] - o.h[2] - c[2], 0, c[2] - o.c[2] - o.h[2]); if (Math.hypot(dx, dz) >= R) continue;
            const nm = paletteName(o.albedo), br = walls.breakableAt(j);
            const post = Math.min(o.h[0], o.h[2]) < 0.1 && o.c[1] + o.h[1] > 1.5;   // (a door frame's jamb)
            if (o.flags & BoxFlag.Glass || br?.kind === 'wall' || j >= n && !br || post || (nm && STRUCT.has(nm))) { st = true; continue; }
            if (fixture.has(j)) { fx = true; continue; }
            mine.push(`#${j} ${nm ?? 'unnamed'}${br ? ' (cover)' : ''} ${(o.h[0] * 2).toFixed(2)}×${(o.h[1] * 2).toFixed(2)}×${(o.h[2] * 2).toFixed(2)} top ${(o.c[1] + o.h[1]).toFixed(2)} vol ${(o.h[0] * o.h[1] * o.h[2] * 8).toFixed(2)}`);
          }
          if (st) { structure = true; continue; } if (fx) { fixt = true; continue; }
          for (const row of mine) if (!things.includes(row)) things.push(row);
        }
        if (!things.length) { if (fixt) tally.fixture++; else if (structure) tally.structure++; else tally.narrow++; continue; }
        tally.stuck++; const key = things.join(' + '); const e = fails.get(key); const where = `wall #${S.i} burst at (${S.at[0].toFixed(2)}, ${S.at[2].toFixed(2)}), ${entered ? `${best.toFixed(2)} m past the far face` : 'no room in the gap itself'}`;
        if (e) e.n++; else fails.set(key, { n: 1, first: where });
      }
      grand.asked += tally.asked; grand.holes += tally.asked - tally.noHole; grand.through += tally.through; grand.stuck += tally.stuck;
      line(tally.stuck === 0, `${name}: ${tally.asked} bursts on inside walls · ${tally.through} holes walked through · ${tally.stuck} blocked by a thing (no hole ${tally.noHole}, gap too narrow ${tally.narrow}, structure in the way ${tally.structure}, a lit fixture in the way ${tally.fixture})`,
        [...fails].slice(0, opts.verbose ? 99 : 6).map(([k, v]) => `${v.n}× ${k} — ${v.first}`).join('\n    '));
      if (opts.sheet && taken.size) console.log(`    took, of neither engine's list (${taken.size}):\n      ${[...taken.values()].join('\n      ')}`);
    }
    if (!BREAK && ck) {   // a checkpoint carries what the rule took of neither engine's list, and a restart gives it back
      const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${ck.name}.json`), 'utf8'))) }); const g = W.game, boxes = g.col.boxes;
      FURN.mouth.on = !BREAK;   // (the frozen stand holds it off at every stand-up)
      g.godMode = true; g.aiEnabled = false; g.tune.chaos = 0.5; for (let i = 0; i < 4; i++) W.step(1 / 60);
      blast(g, [ck.at[0], ck.at[1] - FRAG.lift, ck.at[2]], { who: g.player.char.id, name: '40 mm grenade' }); for (let f = 0; f < 30; f++) W.step(1 / 60);
      const file = JSON.parse(JSON.stringify(W.snapshot('hole', true))); const m: number[] = file.furn?.m ?? [];
      const gone = (i: number) => (boxes[i].flags & BoxFlag.NoPrimary) !== 0;
      g.restartEncounter(); const back = m.length > 0 && m.every(i => !gone(i)) && g.destr.furn.snapshot() === undefined;
      W.restore(file); W.step(1 / 60); const again = g.destr.furn.snapshot();
      line(m.length > 0 && back && m.every(gone) && JSON.stringify(again) === JSON.stringify(file.furn), `${ck.name}: a checkpoint files what the rule took of neither list (${m.join(', ')}), a restart stands it up again, a load takes it again`,
        `restart gave it back ${back} · gone after the load ${m.every(gone)} · slice equal ${JSON.stringify(again) === JSON.stringify(file.furn)}`);
      const bad = JSON.parse(JSON.stringify(file)); bad.furn.m = [ck.wall];
      line(typeof g.destr.furn.check(bad.furn) === 'string' && g.destr.furn.check(file.furn) === null, 'a slice that names a wall is refused, the real one is taken');
    }
    if (BREAK) console.log(all ? '  BREAK: nothing failed with the rule off — these lines hold nothing' : `  BREAK: with the rule off ${grand.stuck} holes are blocked by a thing, as they should be`);
    else line(grand.through > 0, `${grand.asked} bursts, ${grand.holes} holes, ${grand.through} walked through, ${grand.stuck} blocked by a thing`);
  } finally { LIVED.on = was.lived; DESTRUCTION.on = was.d; FURNBLAST.on = was.f; FURN.mouth.on = was.m; Math.random = was.rnd; }
  return all;
}

if (import.meta.main) {
  const a = process.argv.slice(2); const flag = (f: string) => a.includes(f); const val = (f: string) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  const names = a.filter((x, i) => !x.startsWith('--') && a[i - 1] !== '--max');
  const ok = await blastholeCheck(names.length ? names : LEVELS, { max: val('--max') ? Number(val('--max')) : undefined, verbose: flag('--verbose'), sheet: flag('--sheet') });
  process.exit(ok ? 0 : 1);
}
