// A MAN NOBODY SEES LEAVES HIS TRACKS IN THE SNOW (src/game/fogofwar.ts FOG.tracks; src/game/snowTracks.ts SnowTracks.unseen). The maintainer, 10-23: "I won't
// see tracks forming in fog of war, right? but if an enemy off screen makes tracks and then I see snow, I'll see the tracks?" — yes to both.
//   bun run tools/qa/probes.ts fog-tracks        (families fog, snow; FOGTRACKS_BREAK=1 = the row is put off where the lines ask for it: they must go red)
//   kept      a man down where the fog hides him presses nothing into the map and his mark is kept off it; seen snow → it is there, whole, on that frame, with
//             no snow kicked and nothing left forming, byte for byte what the same man leaves in sight; the row off: nothing pressed, nothing kept (as it was)
//   watched   a hidden man on snow the team is LOOKING at (smoke, a low crate): his prints kept and not laid while they look; away and back: laid; his
//             hollow waits (nothing kept): shown, it is pressed in the open; looked away from, kept
//   paced     300 marks kept: out of every field no line is walked; in field, 64 lines a tick and every square its turn; seen, 16 laid a tick, and at that
//             pace with the fog off; six a square, 6000 in all; the row put off with marks kept: dropped
//   eyes      the game's own fog on the pass: ground a stride before Sam is seen and in a field, a hidden man's is not, the things' tally is left alone;
//             a mark kept at that man's feet is laid once Sam stands over it
//   played    the squad on the pass under the fog, sent at a man it hides (up to three more of the hidden stood on unseen snow), 30 s, two seeds, with the row and without: the same digests and dice (the picture
//             alone), marks kept or found with the row alone
//   switch    the address, the journal, the two stands, no row of the replay page's look
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function fogTracksCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { SNOW, SNOW_LOOK, WEATHER_BOOT } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const SF = await import(`${ROOT}/src/render/snowField.ts`);
  const ST = await import(`${ROOT}/src/game/snowTracks.ts`);
  const { FOG, fogFlags } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const BREAK = process.env.FOGTRACKS_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== fog-tracks: a man nobody sees leaves his tracks in the snow, found when the team sees it ===');
  const NAMES = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWTRACKS', 'TPS_SNOWMARKS'] as const, env = NAMES.map(n => process.env[n]);
  const was = { snow: SNOW.on, ...SNOW_LOOK }, tracksWas = FOG.tracks, bootWas = WEATHER_BOOT.kind, DT = 1 / 60, R = ST.TRACK_RES;
  let stood: boolean | null = null;
  /** a game stood up on the pass with the snow's look and prints on; `marks` = marks form over a moment and kick snow up (the page's way) */
  async function rig(seed: number, marks: boolean) {
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; process.env.TPS_SNOWTRACKS = '1'; process.env.TPS_SNOWMARKS = marks ? '1' : '0'; SNOW.on = false; SNOW_LOOK.on = false; SNOW_LOOK.tracks = false; SNOW_LOOK.marks = !marks; WEATHER_BOOT.kind = null as any;
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    let W: any; try { W = await quiet(() => standUp({ level: lvl, seed })); } finally { WEATHER_BOOT.kind = bootWas; }
    if (stood === null) stood = FOG.tracks;   // (what the stand left: read below, with the stands)
    const g = W.game as any; g.engine.gbuffer = { setSnowField() { }, setSnowCfg() { }, setSnowTracks() { } };
    return { W, g };
  }
  const near = (T: any, x: number, z: number, r: number) => { let n = 0; const x0 = Math.floor((x - r - WORLD.min[0]) * R), x1 = Math.ceil((x + r - WORLD.min[0]) * R), z0 = Math.floor((z - r - WORLD.min[2]) * R), z1 = Math.ceil((z + r - WORLD.min[2]) * R);
    for (let tz = Math.max(0, z0); tz <= Math.min(T.h - ST.TRACK_PAD - 1, z1); tz++) for (let tx = Math.max(0, x0); tx <= Math.min(T.w - 1, x1); tx++) if (T.data[tz * T.w + tx] > 0) n++; return n; };
  const lying = (x: number, z: number) => ({ alive: false, bodyYaw: 0, pos: [x, 0, z], vel: [0, 0, 0], bones: { hips: [x, 0.16, z], head: [x + 0.62, 0.12, z + 0.1], footL: [x - 0.8, 0.08, z - 0.12], footR: [x - 0.78, 0.08, z + 0.14] } });
  try {
    { // ---- kept, found, as in sight (stand-ins' bones: who is hidden and what is seen are the things on trial)
      const A = await rig(7, true); const g = A.g, F = g.snowField, T = g.snowTracks;
      if (!F || !T) verdict(false, 'kept — the pass, switches on: the game holds a field and a prints texture', `field ${F ? 'held' : F} · prints ${T ? 'held' : T}`);
      else {
        const X1 = WORLD.min[0] + WORLD.gridW * WORLD.gridCell - 3, Z1 = WORLD.min[2] + WORLD.gridH * WORLD.gridCell - 3, snow = (x: number, z: number) => SF.snowFieldAt(F, x, z).cover;
        const spots: [number, number][] = []; for (let z = WORLD.min[2] + 3; z < Z1 && spots.length < 320; z += 1.25) for (let x = WORLD.min[0] + 3; x < X1 && spots.length < 320; x += 1.25) {
          if ([[0, 0], [0.7, 0.1], [-0.8, -0.12], [-0.8, 0.14]].every(([dx, dz]) => snow(x + dx, z + dz) > 0.9)) spots.push([x, z]); }
        const [sx, sz] = spots[0] ?? [0, 0]; let see = false, field = true, lines = 0, hid = true; const asked = new Set<string>();
        const sam = { char: { alive: true, pos: [0, 0, 0], vel: [0, 0, 0], bones: {} } };
        const game = (men: { char: unknown }[], active = true) => ({ player: sam, guards: men, civilians: [], fogOfWar: { hidden: () => hid, active, groundLook: (x: number, z: number) => { if (!field) return 0; lines++; asked.add(`${x},${z}`); return see ? 2 : 1; } } });
        const frame = (Gx: any, n = 1) => { for (let i = 0; i < n; i++) { ST.updateSnowTracks(Gx, T, F, DT); ST.formSnowTracks(T, DT); } };
        const standing = (x: number, z: number) => ({ alive: true, bodyYaw: 0, pos: [x, 0, z], vel: [0, 0, 0], bones: { hips: [x, 0.95, z], head: [x, 1.6, z], footL: [x - 0.1, 0.04, z], footR: [x + 0.1, 0.04, z], toeL: [x - 0.1, 0.02, z + 0.2], toeR: [x + 0.1, 0.02, z + 0.2] } });
        const darks = () => [...T.unseen.values()].flatMap((q: any) => q.marks).map((u: any) => u.dark as boolean);
        let man = { char: lying(sx, sz) };
        // in sight, from the first: what he leaves, settled
        ST.clearSnowTracks(T); FOG.tracks = true; hid = false; const kA = T.kicked; frame(game([man]), 90); ST.settleSnowTracks(T); const inSight = T.data.slice(), kicksSeen = T.kicked - kA, nSight = near(T, sx, sz, 1.5);
        // hidden, the row on: counted, kept off the map
        ST.clearSnowTracks(T); FOG.tracks = !BREAK; man = { char: lying(sx, sz) }; hid = true; see = false; const k0 = T.kicked; frame(game([man]), 90);
        const kept = T.kept, hollows = T.hollows, onMap = near(T, sx, sz, 1.5), noKick = T.kicked === k0;
        // the team sees that snow: there, whole, that frame — nothing kicked, nothing left forming
        see = true; frame(game([man])); const found = T.found, left = T.kept, forming = T.forming.length, kicked = T.kicked - k0;
        let differ = 0; for (let i = 0; i < T.data.length; i++) if (T.data[i] !== inSight[i]) differ++;
        // the row off: a hidden man presses nothing and nothing is kept — as it was
        ST.clearSnowTracks(T); FOG.tracks = false; man = { char: lying(sx, sz) }; see = true; frame(game([man]), 90); const offMap = near(T, sx, sz, 1.5), offKept = T.kept, offHollows = T.hollows;
        verdict(spots.length > 0 && nSight > 250 && kicksSeen > 0 && kept === 1 && hollows === 1 && onMap === 0 && noKick && found === 1 && left === 0 && forming === 0 && kicked === 0 && differ === 0 && offMap === 0 && offKept === 0 && offHollows === 0,
          'kept — a man down on snow where the fog hides him: his hollow is counted and kept off the map, which stays clean, and no snow is kicked up; the frame the team sees that snow it is there whole — nothing forming, nothing kicked, byte for byte what the same man leaves in sight; with the row off a hidden man presses nothing and nothing is kept, as it was',
          `at (${sx.toFixed(1)}, ${sz.toFixed(1)}), marks forming and kicking as on the page · in sight: ${nSight} texels marked, ${kicksSeen} kick(s) · hidden: ${kept} kept, ${hollows} hollow counted, ${onMap} texels on the map, no kick ${noKick} · seen: ${found} found, ${left} left, ${forming} still forming, ${kicked} kicks, ${differ} bytes differ from in sight · row off: ${offMap} texels, ${offKept} kept, ${offHollows} hollows`);
        { // ---- watched: snow the team is looking at while a man it cannot see is on it
          // his boots: kept, not dark, not laid for as long as they look; they look away, and back: there
          ST.clearSnowTracks(T); FOG.tracks = !BREAK; let m = { char: standing(sx, sz) }; hid = true; see = true; field = true; frame(game([m]), 90);
          const kept = T.kept, d0 = darks(), onMap = near(T, sx, sz, 0.6), found0 = T.found;
          see = false; frame(game([m])); const d1 = darks(), found1 = T.found; see = true; frame(game([m])); const found2 = T.found, left = T.kept, laid = near(T, sx, sz, 0.6);
          // his body: nothing kept while they look (a hollow kept there would lie unlaid under the body the fog then shows) — shown: pressed in the open, kicking snow
          ST.clearSnowTracks(T); m = { char: lying(sx, sz) } as any; hid = true; see = true; frame(game([m]), 90); const bKept = T.kept, bHollows = T.hollows, bMap = near(T, sx, sz, 1.5), kB = T.kicked;
          hid = false; frame(game([m]), 90); const shown = near(T, sx, sz, 1.5), shownKicks = T.kicked - kB, shownHollows = T.hollows;
          // …or they look away first: kept then, and found on the look back
          ST.clearSnowTracks(T); m = { char: lying(sx, sz) } as any; hid = true; see = true; frame(game([m]), 90); see = false; frame(game([m]), 2); const awayKept = T.kept, awayDark = darks()[0]; see = true; frame(game([m])); const back = T.found, backMap = near(T, sx, sz, 1.5);
          verdict(kept === 2 && d0.every(d => d === false) && onMap === 0 && found0 === 0 && d1.length === 2 && d1.every(d => d) && found1 === 0 && found2 === 2 && left === 0 && laid > 20
            && bKept === 0 && bHollows === 0 && bMap === 0 && shown > 250 && shownKicks > 0 && shownHollows === 1 && awayKept === 1 && awayDark === true && back === 1 && backMap > 250,
            'watched — a man the fog hides stands on snow the team is looking at (smoke between, or a crate he is low behind): his prints are kept and NOT laid for as long as they look (a step shown as it is taken is him); they look away, and back: there. Down on such snow his hollow waits: nothing is kept; the fog shows him and it is pressed in the open, or they look away and it is kept, and found on the look back',
            `boots, 90 frames watched: ${kept} kept, dark ${d0.join(' ')}, ${onMap} texels, ${found0} found · a frame out of sight: dark ${d1.join(' ')}, ${found1} found · seen again: ${found2} found, ${left} left, ${laid} texels · a body watched: ${bKept} kept, ${bHollows} hollows, ${bMap} texels · shown: ${shown} texels, ${shownKicks} kick(s), ${shownHollows} hollow · or looked away from: ${awayKept} kept, dark ${awayDark} · and back: ${back} found, ${backMap} texels`);
        }
        { // ---- paced: sight lines a frame, marks laid a frame, a square's most, the list's most
          const N = 300, at = spots.slice(0, N);
          ST.clearSnowTracks(T); FOG.tracks = !BREAK; hid = true; see = false; field = true; let men = at.map(([x, z]) => ({ char: lying(x, z) }));
          frame(game(men), 90); const n0 = T.kept, squares = T.unseen.size; field = false; see = true; const l0 = lines; frame(game(men), 3); const backTurned = lines - l0, foundBack = T.found;
          field = true; see = false; asked.clear(); const l1 = lines; frame(game(men)); const unseenLines = lines - l1; frame(game(men), 4); const turns = asked.size;   // (five ticks of 64: all 300 squares have had their turn)
          see = true; const l2 = lines, steps: number[] = []; for (let i = 0; i < 2; i++) { frame(game(men)); steps.push(T.found); } const walked = lines - l2;
          let flush = 0; const first = T.found; frame(game(men, false)); const firstFlush = T.found - first; flush++; while (T.kept && flush < 50) { frame(game(men, false)); flush++; }
          const after = T.kept, all = T.found; let marked = 0; for (const [x, z] of at) if (near(T, x, z, 0.5) > 50) marked++;
          // eight men down in one place: the square keeps six
          ST.clearSnowTracks(T); see = false; men = Array.from({ length: 8 }, () => ({ char: lying(sx, sz) })); frame(game(men), 90); const sqKept = T.kept, sqLost = T.lost, sqN = T.unseen.size;
          FOG.tracks = false; see = true; frame(game(men), 3); const offKept = T.kept, offFound = T.found, offMap = near(T, sx, sz, 1.5); FOG.tracks = !BREAK; see = false;
          // 1001 places with six men down in each: the list keeps 6000
          const many: [number, number][] = []; for (let z = WORLD.min[2] + 2; z < Z1 + 1 && many.length < 1001; z += 0.5) for (let x = WORLD.min[0] + 2; x < X1 + 1 && many.length < 1001; x += 0.5) if (snow(x, z) > 0.6) many.push([x, z]);
          ST.clearSnowTracks(T); men = many.flatMap(([x, z]) => Array.from({ length: 6 }, () => ({ char: lying(x, z) }))); frame(game(men), 80); const capKept = T.kept, capLost = T.lost, capSquares = T.unseen.size;
          verdict(at.length === N && n0 === N && squares === N && backTurned === 0 && foundBack === 0 && unseenLines === 64 && turns === N && steps[0] === 16 && steps[1] === 32 && walked === 32 && firstFlush === 16 && flush === 17 && after === 0 && all === N && marked === N
            && sqKept === 6 && sqLost === 2 && sqN === 1 && offKept === 0 && offFound === 0 && offMap === 0 && many.length === 1001 && capKept === 6000 && capLost === 6 && capSquares >= 1000,
            'paced — 300 marks kept, a square each: with every one out of the eyes\' fields no sight line is walked and none is laid; in a field, 64 lines a tick and every square has its turn in five; seen at once, 16 laid a tick; the fog goes off and what is left is laid at the same pace (the map is the world\'s then); a square keeps six marks and the list 6000, the rest counted lost; the row put off with marks kept drops them unlaid',
            `${at.length} men down on snow, hidden: ${n0} kept in ${squares} squares · backs turned, three frames: ${backTurned} lines, ${foundBack} found · in field, unseen: ${unseenLines} lines a tick, ${turns} squares asked in five · seen: ${steps.join(', ')} found after one and two frames on ${walked} lines · fog off: ${firstFlush} laid the first frame, all ${all} after ${flush} frames, ${after} left, ${marked} of ${N} places marked · eight men in one place: ${sqKept} kept in ${sqN} square, ${sqLost} lost; the row put off: ${offKept} kept, ${offFound} found, ${offMap} texels · six men in each of ${many.length} places: ${capKept} kept in ${capSquares} squares, ${capLost} lost`);
        }
      }
    }
    { // ---- eyes: the game's own fog answers, and the game's own frame finds a kept mark
      const E = await rig(5, true), g = E.g, F = g.snowField, T = g.snowTracks, fog = g.fogOfWar; FOG.tracks = !BREAK;
      await quiet(() => startFromQuery(g, '?levelFile=pass.json&roomclear=0&squad4')); fog.on = true; for (let i = 0; i < 60; i++) E.W.step(DT);
      const open = (x: number, z: number) => [[0, 0], [0.7, 0.1], [-0.8, -0.12], [-0.8, 0.14]].every(([dx, dz]) => SF.snowFieldAt(F, x + dx, z + dz).cover > 0.9);
      const sp = g.player.char.pos, e0 = fog.eyes[0], L = Math.hypot(e0.look[0], e0.look[2]) || 1, ahead: [number, number] = [e0.at[0] + e0.look[0] / L, e0.at[2] + e0.look[2] / L];
      const t0 = fog.thingStats.tests, aheadLook = fog.groundLook(ahead[0], ahead[1]), aheadField = aheadLook > 0, aheadSeen = aheadLook === 2;
      // a place on open snow that no eye has, the farthest from Sam, with open snow a stride beside it for him to stand on later
      let at: [number, number] | null = null, stand: [number, number] = [0, 0], far = 0;
      for (let z = WORLD.min[2] + 3; z < WORLD.min[2] + WORLD.gridH * WORLD.gridCell - 3; z += 1.25) for (let x = WORLD.min[0] + 3; x < WORLD.min[0] + WORLD.gridW * WORLD.gridCell - 4.5; x += 1.25) {
        const d = Math.hypot(x - sp[0], z - sp[2]); if (d > far && open(x, z) && open(x + 1.25, z) && fog.groundLook(x, z) !== 2) {   /* (in a field or not: with no cone — the frozen stand — every place is in one) */ far = d; at = [x, z]; stand = [x + 1.25, z]; } }
      const tally = fog.thingStats.tests === t0, [ax, az] = at ?? [0, 0];
      const man = { char: lying(ax, az) }, G = { player: { char: { alive: true, pos: [0, 0, 0], vel: [0, 0, 0], bones: {} } }, guards: [man], civilians: [], fogOfWar: { hidden: () => true, active: true, groundLook: (x: number, z: number) => fog.groundLook(x, z) } };
      for (let i = 0; i < 90; i++) { ST.updateSnowTracks(G as any, T, F, DT); ST.formSnowTracks(T, DT); }   // (the stand-in lies there under the game's own eyes: his hollow is kept)
      const kept = T.kept, dark = ([...T.unseen.values()][0] as any)?.marks[0]?.dark, f0 = T.found; for (let i = 0; i < 30; i++) E.W.step(DT);   // (the game's own frames, nobody looking)
      const still = T.kept, f1 = T.found - f0, clean = near(T, ax, az, 1.2);
      g.teleportPlayer([stand[0], 0, stand[1]]); let frames = 0; for (let i = 0; i < 120 && T.kept; i++) { E.W.cursorAt([ax, 0.1, az]); E.W.step(DT); frames++; }   // (Sam is put a stride from it, looking at it)
      const f2 = T.found - f0, left = T.kept, laid = near(T, ax, az, 1.2);
      verdict(!!at && aheadField && aheadSeen && tally && kept === 1 && dark === true && still === 1 && f1 === 0 && clean === 0 && f2 === 1 && left === 0 && laid > 250,
        'eyes — the game\'s own fog on the pass, the squad staged: ground a stride before Sam is in a field and seen, the things\' tally is left alone; a hollow kept on open snow no eye has stays kept through the game\'s own frames; Sam is put a stride from it, and the game\'s own frame lays it',
        `a stride ahead of Sam (${sp[0].toFixed(1)}, ${sp[2].toFixed(1)}): in a field ${aheadField}, seen ${aheadSeen} · tally left alone ${tally} · the place (${ax.toFixed(1)}, ${az.toFixed(1)}), ${far.toFixed(0)} m off: ${kept} kept, dark ${dark} · 30 frames on: ${still} kept, ${f1} found, ${clean} texels · Sam beside it: ${f2} found after ${frames} frame(s), ${left} left, ${laid} texels`);
    }
    { // ---- played: the squad on the pass under the fog, with the row and without — the picture alone
      const SECS = 30; const play = async (seed: number, tracks: boolean) => { const P = await rig(seed, true); const g = P.g; FOG.tracks = tracks;
        await quiet(() => startFromQuery(g, '?levelFile=pass.json&roomclear=0&squad4')); g.fogOfWar.on = true; const T = g.snowTracks; const ds: string[] = []; let most = 0;
        let told = '';
        for (let i = 0; i < 60 * SECS; i++) { if (i === 40) { const hid = (g.guards as any[]).filter(x => x.char.alive && g.fogOfWar.hidden(x)), far = hid[0]; told = far ? String(g.orders.give('move', g.orders.targetAt([far.char.pos[0], 0, far.char.pos[2]])) ?? 'given') : 'nobody hidden';   // (the team is sent at a man the fog hides: the fight that follows is what moves the men nobody sees)
            // …and up to three of the others it hides are stood on open snow no eye has, well off Sam (both arms alike): whichever way the fight goes — a later build's went indoors, and nobody unseen crossed snow in 30 s — men nobody sees do stand on snow in this run
            const F = g.snowField, sp = g.player.char.pos, open = (x: number, z: number) => [[0, 0], [0.7, 0.1], [-0.8, -0.12], [-0.8, 0.14]].every(([dx, dz]) => SF.snowFieldAt(F, x + dx, z + dz).cover > 0.9), spots: [number, number][] = [];
            for (let z = WORLD.min[2] + 3; z < WORLD.min[2] + WORLD.gridH * WORLD.gridCell - 3 && spots.length < 3; z += 1.25) for (let x = WORLD.min[0] + 3; x < WORLD.min[0] + WORLD.gridW * WORLD.gridCell - 3 && spots.length < 3; x += 1.25)
              if (Math.hypot(x - sp[0], z - sp[2]) > 8 && open(x, z) && !g.col.nav.isBlocked(x, z) && g.fogOfWar.groundLook(x, z) !== 2 && spots.every(([a, b]) => Math.hypot(a - x, b - z) > 3)) spots.push([x, z]);
            hid.slice(1, 1 + spots.length).forEach((x, k) => { const c = x.char; c.pos[0] = spots[k][0]; c.pos[2] = spots[k][1]; c.vel[0] = 0; c.vel[2] = 0; }); }
          P.W.step(DT); if (i % 30 === 29) { ds.push(JSON.stringify(digestGame(g))); most = Math.max(most, T.kept); } }
        return { told, d: ds.join('|'), draws: g.dice?.n ?? -1, kept: T.kept as number, most, found: T.found as number, lost: T.lost as number, prints: T.prints as number, fog: g.fogOfWar.active === true, hidden: (g.guards as any[]).filter(x => g.fogOfWar.hidden(x)).length }; };
      const rows: string[] = []; let same = true, some = 0, none = true, fog = true;
      for (const seed of [3, 4]) { const a = await play(seed, false), b = await play(seed, !BREAK); same &&= a.d === b.d && a.draws === b.draws; some += b.most + b.found; none &&= a.most === 0 && a.found === 0; fog &&= a.fog && b.fog;
        rows.push(`seed ${seed} (the order: ${b.told}): ${a.d === b.d ? `the same ${SECS * 2} digests` : 'digests differ'}, dice ${a.draws} / ${b.draws} · with the row: ${b.kept} kept at the end (most ${b.most}), ${b.found} found, ${b.lost} lost, ${b.prints} prints counted, ${b.hidden} men hidden · without: ${a.most} kept, ${a.found} found, ${a.prints} prints`); }
      verdict(fog && same && some > 0 && none, 'played — the squad on the pass under the fog, sent at a man it hides with up to three more of the hidden stood on open snow no eye has, 30 s, two seeds, without the row and with it: the same run by its digest every half second and its dice (the picture alone); with the row the men nobody sees leave marks that are kept or found, without it none',
        rows.join(' ·· '));
    }
    { // ---- the switch
      const g = globalThis as any, had = 'location' in g, locWas = g.location;
      const at = (search: string, from: boolean) => { FOG.tracks = from; g.location = { search }; fogFlags(); return FOG.tracks; };
      const zero = at('?fogtracks=0', true), bare = at('?fogtracks', false), one = at('?fogtracks=1', false), none = at('', true), noneOff = at('', false);
      if (had) g.location = locWas; else delete g.location;
      const JR = await import(`${ROOT}/src/game/journal.ts`), PR = await import(`${ROOT}/src/host/profile.ts`), { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
      const W2: any = await quiet(() => standUp({}));
      FOG.tracks = true; const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W2.game))), old = JSON.parse(JSON.stringify(snap)); const rides = snap.tables.FOG?.tracks === true;
      FOG.tracks = false; JR.applyKnobs(W2.game, snap); const applied = FOG.tracks; delete old.tables.FOG.tracks; FOG.tracks = true; JR.applyKnobs(W2.game, old); const beforeKey = FOG.tracks;
      const text = readFileSync(resolve(ROOT, 'src/game/fogofwar.ts'), 'utf8'), pageRows = /const FOG_PAGE = \{([^}]*)\}/.exec(text)?.[1] ?? 'tracks', page = !/tracks/.test(pageRows), moduleOn = /\n  tracks: true,\n/.test(text);
      const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_FOGTRACKS, want = word !== undefined ? word === '1' : shipped;
      verdict(zero === false && bare === true && one === true && none === true && noneOff === false && moduleOn && rides && applied === true && beforeKey === false && page && (STAND_ENV as string[]).includes('TPS_FOGTRACKS') && PR.FROZEN_HOLDS['FOG.tracks'] === 'TPS_FOGTRACKS=1' && stood === want,
        'switch — on in the module, ?fogtracks=0 puts it off and a bare or =1 word on, no word leaves it; it rides a recording\'s tables and a recording from before the key replays with it off; no row of the replay page\'s fog look; a row of the two stands\' list with its word; up on the shipped stand, down on the frozen one unless its word raises it',
        `?fogtracks=0 → ${zero} · bare → ${bare} · =1 → ${one} · no word → ${none} / ${noneOff} · the module's on: ${moduleOn} · rides the tables ${rides}, applied ${applied}, before the key ${beforeKey} · the page look without it: ${page} · ${shipped ? 'shipped' : 'frozen'} stand${word !== undefined ? ` with TPS_FOGTRACKS=${word}` : ''}: stood up ${stood}`);
    }
  } finally {
    NAMES.forEach((n, i) => { if (env[i] === undefined) delete process.env[n]; else process.env[n] = env[i]; });
    FOG.tracks = stood ?? tracksWas;   // (as the stand left it: the probes after this one in the process run on the stand they were asked for)
    SNOW.on = was.snow; Object.assign(SNOW_LOOK, { on: was.on, tracks: was.tracks, marks: was.marks }); WEATHER_BOOT.kind = bootWas;
  }
  console.log(`=== fog-tracks: ${fails ? `${fails} FAIL` : 'ALL PASS'} ===`);
  return fails === 0;
}
