// TUT-SKY-CHECK: the first tutorial mission's own floor (tools/levels/tut-sky.ts → levels/tut-sky.json: a tunnel station under snow). What this level is for,
// held as numbers:
//   1. THE FLOOR IS ITS OWN. Its generator imports no other level's generator (the kits, the snow paints and the level's types are everybody's).
//   2. ROOM FOR FOUR MEN SEEN FROM ABOVE. The road between the squad's trucks and the roadblock, the gateway, the yard, each room and the plain wall each
//      side of every door are at least what is written here.
//   3. THE LIGHT'S BEAT. The step that puts the mains out carries the card that says what the dark does to men, and the step after the goggles is the two
//      who come out with torches. The file has its emergency beacons, each a dome of group 'emergency' that the mains do not feed.
//   4. LIVE: staged as the page stages it, no beacon is lit while the mains are in; with the mains out every one of them is lit inside a second and a half,
//      every fixture the mains feed is dark, and the lamps that are not the mains' (stoves, lanterns, vehicles) still burn.
//   5. NO POCKETS: every free cell of the walk grid can be walked to from the yard (a man posted on a cut-off cell can be given no further order).
//   6. THE SQUAD'S OWN BLAST IS IN THE PICTURE: on the step that blows the wall charge, the wall's face is floor the picture shows live (the mission has no
//      fog of war; were it on, an eye of the fog's must have that floor). Twice played with the blast unseen before this line.
//   7. EVERY SMOKE CAN IS CALLED: on the cue that puts the squad's smoke out, and again when more goes out, each can's thrower has a line on the net with
//      'smoke' in it up over him from at least a third of a second before the can leaves his hand and a row under his name on the HUD's radio strip, his arm
//      throws it (where the stand has the toss: the frozen one holds that move off), and each of the two throwers calls his own
//      (the maintainer, playing: "guys should announce that they're throwing out a smoke grenade").
//   8. NOBODY IS LEFT STANDING IN THE YARD FOR GOOD: of the two who come out with flashlights, one is shot on the way. Inside twelve seconds the other is
//      back inside the bunkhouse's walls and let go there, the door is shut behind him and the mains are still out (he was let go where he stood, pinned to
//      a post he was not on and on no roster, and stood behind the lorry, alert, for the rest of the mission: a recorded play of the maintainer's).
//   bun run tools/qa/tut-sky-check.ts          and again with TPS_PROFILE=shipped in front (the stand the page opens on)
//   TUT_SKY_BREAK=1 …   the mains are never put out, the fog of war is put on as the mission had it and the squad's lines are taken off the men as they are said, the flashlight man is let go where he stands when his mate is shot: lines 4, 7 and 8 must be RED
//   (line 9, a flashlight man never left the script's, has no break: taking the `inside` beat's two releases out of the script fails it, tried 10-24)
//                       (LINE 6's BREAK NO LONGER BITES, and did not on the build before line 7 was written: the fog is put on, but the 'blow' step has since been
//                        given a lookout of its own (`eye`) that has the wall's face, so the line stays green under it. Not mended: taking the lookouts away
//                        as well read 'fog of war off'. On the frame's book)
// EXIT: 0 = every line holds · 1 = a fault, each a line.
// Headless: no GPU. Nothing here saw a picture: whether the red light reads in the snow is the page's to show.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.TPS_RAILS ??= '1';   // (the level has a lesson only on the frame: off on the frozen stand unless raised)

const ROOT = resolve(import.meta.dir, '../..'), BROKEN = process.env.TUT_SKY_BREAK === '1';
const faults: string[] = [];
const line = (ok: boolean, say: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${say}: ${got}`); if (!ok) faults.push(`${say} (${got})`); };

// 1 ---- its own generator
{ const src = readFileSync(resolve(ROOT, 'tools/levels/tut-sky.ts'), 'utf8');
  const local = [...src.matchAll(/(?:from|import|require)\s*\(?\s*['"`]\.\/([\w.-]+)['"`]/g)].map(m => m[1]);   // (any sibling of tools/levels/ is another level's generator or the exporter)
  line(local.length === 0 && !/DRESS_AS|kitView\(/.test(src), 'the generator imports no other level\'s generator and dresses as nothing else', local.length ? `imports ./${local.join(', ./')}` : 'none'); }

// 2, 3 ---- the file
const L = JSON.parse(readFileSync(resolve(ROOT, 'levels/tut-sky.json'), 'utf8'));
{ const R = L.scenarios.roomClear, rooms: any[] = R.rooms, sizes = rooms.map(r => ({ id: r.id, w: r.bounds.x1 - r.bounds.x0, d: r.bounds.z1 - r.bounds.z0 }));
  const small = sizes.filter(s => Math.min(s.w, s.d) < 6.2 || s.w * s.d < 42);
  line(small.length === 0, 'every room is at least 6.2 m on its short side and 42 m² (four men and their fight fit under the camera)', sizes.map(s => `${s.id} ${s.w.toFixed(1)} × ${s.d.toFixed(1)}`).join(' · '));
  // the road: from the squad's start marks to the nearest thing of the roadblock (its gun truck's nose)
  const team: number[][] = [R.team.sam, ...(R.team.ops ?? [])], eastmost = Math.max(...team.map(p => p[0]));
  const block = L.boxes.filter((b: any) => b.group === 'road.block'), west = Math.min(...block.map((b: any) => b.c[0] - Math.hypot(b.h[0], b.h[2])));
  line(block.length > 0 && west - eastmost > 18, 'the road is long: more than 18 m from the squad\'s marks to the roadblock', `${(west - eastmost).toFixed(1)} m`);
  const yard = L.scenarios.places?.areas?.find((p: any) => /yard/.test(p.name)), yb = yard?.bounds, area = yb ? (yb.x1 - yb.x0) * (yb.z1 - yb.z0) : 0;
  line(area > 150, 'the yard is more than 150 m²', yb ? `${(yb.x1 - yb.x0).toFixed(1)} × ${(yb.z1 - yb.z0).toFixed(1)} m` : 'no place named the yard');
  // plain wall each side of every door: no other door's opening inside 2 m of its own along the same wall (a door's `hinge` is one jamb, the other is `width` on)
  const doors: any[] = L.doors, close: string[] = [], alongX = (d: any) => Math.abs(Math.sin(d.closedDir)) < 0.5;
  const span = (d: any) => { const k = alongX(d) ? 0 : 1, a = d.hinge[k], b = a + (alongX(d) ? Math.cos(d.closedDir) : Math.sin(d.closedDir)) * (d.width + 0.04); return { line: d.hinge[1 - k], a: Math.min(a, b), b: Math.max(a, b) }; };
  for (const a of doors) for (const b of doors) if (a.id < b.id && alongX(a) === alongX(b)) { const A = span(a), B = span(b);
    if (Math.abs(A.line - B.line) < 0.3 && Math.max(A.a, B.a) - Math.min(A.b, B.b) < 2) close.push(`${a.id}/${b.id}`); }
  line(close.length === 0, 'no two doors share 2 m of wall (a stack has a jamb each side to itself)', close.length ? close.join(', ') : `${doors.length} doors`);
}
{ const steps: any[] = L.scenarios.lesson.steps, ids = steps.map(s => s.id), b = steps.find(s => s.id === 'breaker'), t = steps[ids.indexOf('nv') + 1];
  const card = b?.explain, says = !!card && /dark/i.test(card.text) && /flashlight/i.test(card.text) && /night vision/i.test(card.text);
  line(says && t?.id === 'torches' && t.done?.is === 'cue', 'the mains\' step carries the card on light (the dark, their flashlights, the squad\'s night vision) and the step after the goggles is the flashlights\'', card ? `"${card.title}" · after 'nv': '${t?.id}'` : 'no card');
  const emergency = L.switchables.filter((s: any) => s.group === 'emergency'), owned = L.beacons.every((bc: any) => emergency.some((s: any) => s.boxes.includes(bc.box)));
  line(L.beacons.length >= 4 && owned && emergency.every((s: any) => s.on === false && s.mains === false), 'at least four emergency beacons, each a dome of group \'emergency\' off the mains and dark as authored', `${L.beacons.length} beacons, ${emergency.length} domes`);
}

/** the mission stood up as the page stages it and run thirty frames, then `fn` on it, the console muted meanwhile. Answers the fault ('' = none) */
const live = async (fn: (W: any, g: any) => void): Promise<string> => {
  const { standUp } = await import('./headless');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const log = console.log, warn = console.warn, err = console.error;
  try { console.log = console.warn = console.error = () => { };
    const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/tut-sky.json'), 'utf8'))), seed: 1 }), g = W.game;
    const r = startFromQuery(g, '?levelFile=tut-sky.json&roomclear=1&squad4'); if (r.why) return String(r.why);
    for (let i = 0; i < 30; i++) W.step(1 / 60);
    fn(W, g); return '';
  } catch (x) { return String((x as Error).message); } finally { console.log = log; console.warn = warn; console.error = err; }
};
// 4 ---- live
{ let before = -1, after = -1, mainsLit = -1, mainsWere = -1, othersLit = -1, n = 0, fogOn = true, wallSeen = false, eyes = 0; const cut: string[] = [];
  const why = await live((W, g) => {
    n = g.beacons.length;
    const fed = g.targets.filter((t: any) => t.mains !== false && t.group !== 'emergency'), lit = (l: any[]) => l.filter(t => t.factor > 0.05).length;
    const others = () => lit(g.targets.filter((t: any) => t.mains === false && t.group !== 'emergency'));
    before = g.beacons.filter((b: any) => b.light.enabled).length; mainsWere = lit(fed);
    if (!BROKEN) g.setBlackout(86400, 'hand');
    for (let i = 0; i < 90; i++) W.step(1 / 60);
    after = g.beacons.filter((b: any) => b.light.enabled && b.target.on).length;
    mainsLit = lit(fed); othersLit = others();
    // 5: a flood over the walk grid from the yard's own mark
    const N = g.col.nav, c = N.cell, from: number[] = L.scenarios.lesson.steps.find((s: any) => s.id === 'move').at, seen = new Uint8Array(N.W * N.H), q = [Math.floor(from[2] / c) * N.W + Math.floor(from[0] / c)]; seen[q[0]] = 1;
    while (q.length) { const i = q.pop()!, x = i % N.W, z = (i / N.W) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= N.W || nz >= N.H) continue; const j = nz * N.W + nx; if (!seen[j] && !N.blocked[j]) { seen[j] = 1; q.push(j); } } }
    for (let z = 1; z < N.H - 1; z++) for (let x = 1; x < N.W - 1; x++) if (!N.blocked[z * N.W + x] && !seen[z * N.W + x]) cut.push(`(${((x + 0.5) * c).toFixed(2)}, ${((z + 0.5) * c).toFixed(2)})`);
    // 6: the step that blows the charge, and the floor at the foot of the wall's kitchen face (the step's own mark is on that wall)
    const steps: any[] = L.scenarios.lesson.steps, k = steps.findIndex(s => s.id === 'blow'), wm: number[] = steps[k].at; if (BROKEN) g.level.scenarios.lesson.rails.fog = true; g.lesson.i = k; for (let i = 0; i < 12; i++) W.step(1 / 60);
    fogOn = !!g.fogOfWar.active; eyes = g.fogOfWar.eyes.length; wallSeen = !fogOn || g.fogOfWar.spotSeen(wm[0] - 0.4, wm[2]);
  });
  line(!why && n >= 4 && before === 0 && after === n && mainsWere > 0 && mainsLit === 0 && othersLit > 0,
    'with the mains in no beacon is lit; a second and a half after they go out every beacon is, nothing the mains feed is, and the lamps that are not the mains\' still burn',
    why || `beacons lit ${before} → ${after} of ${n} · mains fixtures lit ${mainsWere} → ${mainsLit} · other lamps still burning ${othersLit}`);
  line(!why && cut.length === 0, 'no free cell of the walk grid is cut off from the yard', why || (cut.length ? `${cut.length} cut off: ${cut.slice(0, 8).join(' ')}` : 'none'));
  line(!why && wallSeen, 'on the step that blows the wall charge the wall\'s face is in the live picture', why || `fog of war ${fogOn ? `on, ${eyes} eyes` : 'off'} · the wall's face ${wallSeen ? 'shown live' : 'HIDDEN'}`);
}
// 7 ---- every smoke can is called by the man who throws it
{ const { MOVES } = await import(`${ROOT}/src/game/character.ts`), { stripRows } = await import(`${ROOT}/src/game/cues.ts`);
  let arms = false; const cans: { t: number; who: string; said: string; lead: number; arm: boolean; drawn: boolean }[] = [];
  const why = await live((W, g) => {
    g.director.signal('lesson:ambush'); for (let i = 0; i < 240; i++) W.step(1 / 60);
    const seen = new Set<number>(); arms = MOVES.on > 0.5 && MOVES.toss > 0.5;   // (the toss is a move of the page's stand: held off on the frozen one, where the arm is not asked)
    const frame = () => { W.step(1 / 60);
      if (BROKEN) for (const gd of g.guards) if (gd.unit && gd.bubble && /smoke/i.test(gd.bubble.text)) gd.bubble = null;
      for (const it of g.items.items) { if (it.kind !== 'smoke' || seen.has(it.serial)) continue; seen.add(it.serial);
        const gd = g.guards.find((x: any) => x.char.id === it.who), b = gd?.bubble, up = !!b && g.time - b.t < b.dur && /smoke/i.test(b.text) && !!b.radio;
        cans.push({ t: g.time, who: gd?.callsign ?? '?', said: up ? b.text : '', lead: up ? g.time - b.t : 0, arm: !!gd?.char.anim.tossing, drawn: up && g.cues.bubbleOf(gd) === b && stripRows(g).some((r: any) => r.text.includes(gd.callsign) && r.text.includes(b.text)) }); } };   // (bubbleOf: the line the page draws over him; stripRows: the HUD's radio strip)
    g.director.signal('lesson:smoke'); for (let i = 0; i < 180; i++) frame();
    const first = cans.length; for (let i = 0; i < 60 * 30 && cans.length < first + 2; i++) frame();
  });
  const bad = cans.filter(c => !c.said || c.lead < 0.33 || (arms && !c.arm) || !c.drawn), who = new Set(cans.map(c => c.who));
  line(!why && cans.length >= 4 && bad.length === 0 && who.size >= 2,
    'every smoke can, the first two and the two that go out after them, is called on the net by its thrower before it leaves his hand, and his arm throws it',
    why || (cans.length ? cans.map(c => `${c.who} ${c.said ? `"${c.said}" ${c.lead.toFixed(2)} s before` : 'SAID NOTHING'}${c.arm ? '' : arms ? ' (NO ARM THROWS IT)' : ' (the toss is held off on this stand)'}${c.said && !c.drawn ? ' (NOT DRAWN: another line is over him, or no row under his name on the radio strip)' : ''}`).join(' · ') : 'no can went out'));
}
// 8 ---- the flashlights' beat leaves nobody standing in the yard for good
{ const { killGuard } = await import(`${ROOT}/src/game/combat.ts`), { endGuardScript } = await import(`${ROOT}/src/game/squad.ts`);
  let at = [0, 0], free = false, door = 9, dark = false, state = '';
  const why = await live((W, g) => {
    const a = g.guards.find((x: any) => x.callsign === 'Tango 5'), b = g.guards.find((x: any) => x.callsign === 'Tango 6'); if (!a || !b) throw new Error('no Tango 5 / Tango 6 on the floor');
    for (const x of g.guards) if (x.team === 'hostile' && x.state !== 'dead' && !['Tango 5', 'Tango 6', 'Tango 7'].includes(x.callsign)) killGuard(g, x, [1, 0, 0], true);   // (the floor as the mission has it by this beat: every room before the bunkhouse taken — a party of theirs left alive goes and puts the mains back itself)
    for (let i = 0; i < 30; i++) W.step(1 / 60);
    g.setBlackout(86400, 'hand'); g.director.signal('lesson:torches');
    for (let i = 0; i < 360; i++) W.step(1 / 60);   // (six seconds: both are out of their door and on the way)
    if (!b.script) throw new Error('Tango 6 is not the beat\'s man six seconds into it');
    killGuard(g, a, [1, 0, 0]);
    for (let i = 0; i < 60 * 12; i++) { W.step(1 / 60); if (BROKEN && b.script) endGuardScript(b, 'alert'); }   // (the break: let go where he stands, as the beat let him go)
    at = [b.char.pos[0], b.char.pos[2]]; free = !b.script; door = Math.abs(g.doors.byName('bunk').angle); dark = !!g.blackout.active; state = b.state;
  });
  const B = L.scenarios.roomClear.rooms.find((r: any) => r.id === 'bunk')?.bounds, inside = !!B && at[0] > B.x0 && at[0] < B.x1 && at[1] > B.z0 && at[1] < B.z1;   // (the bunkhouse's own floor, by the level file)
  line(!why && inside && free && door < 0.1 && dark, 'with one of the two flashlight men shot on the way, the other is back inside his room and let go there inside twelve seconds, the door shut behind him and the mains still out',
    why || `twelve seconds after his mate was shot: at ${at[0].toFixed(1)}, ${at[1].toFixed(1)} (${inside ? 'inside' : 'OUT IN THE YARD'}) · ${free ? 'let go' : 'STILL THE SCRIPT\'S'} · ${state} · the door ${door < 0.1 ? 'shut' : `OPEN ${door.toFixed(2)} rad`} · the mains ${dark ? 'out' : 'BACK IN'}`);
}
// 9 ---- … and where the run back is not taken the man left is let go at once (a review's read of the `inside` beat: its two early ways out returned on him
//        without a word, and the `torches` beat lets nobody go once one of them is down — he stayed the script's, walking to the breaker box and fighting
//        nobody). No break of its own: what it asks is that a man is not the script's.
{ const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const arm = async (squadIn: boolean) => { let free = false, secs = -1, where = '';
    const why = await live((W, g) => {
      const a = g.guards.find((x: any) => x.callsign === 'Tango 5'), b = g.guards.find((x: any) => x.callsign === 'Tango 6'); if (!a || !b) throw new Error('no Tango 5 / Tango 6 on the floor');
      for (const x of g.guards) if (x.team === 'hostile' && x.state !== 'dead' && !['Tango 5', 'Tango 6', 'Tango 7'].includes(x.callsign)) killGuard(g, x, [1, 0, 0], true);
      for (let i = 0; i < 30; i++) W.step(1 / 60);
      g.setBlackout(86400, 'hand'); g.director.signal('lesson:torches');
      const B = L.scenarios.roomClear.rooms.find((r: any) => r.id === 'bunk').bounds, mate = g.guards.find((x: any) => x.unit && x.team === 'operative'), mid = [(B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2];
      const hold = () => { if (squadIn) { mate.char.pos[0] = mid[0]; mate.char.pos[2] = mid[1]; } };
      // (shot before either has left: half a second in, both still stand in their room. The squad at the bunkhouse: six seconds in, a teammate stood in the room)
      for (let i = 0; i < (squadIn ? 360 : 30); i++) { W.step(1 / 60); if (i >= 340) hold(); }
      if (!b.script) throw new Error('Tango 6 is not the beat\'s man when his mate is shot');
      const t0 = g.time; killGuard(g, a, [1, 0, 0]);
      for (let i = 0; i < 180 && b.script && b.state !== 'dead'; i++) { W.step(1 / 60); hold(); }
      free = !b.script || b.state === 'dead'; secs = g.time - t0; where = `${b.char.pos[0].toFixed(1)}, ${b.char.pos[2].toFixed(1)}`;
    });
    return { why, free, secs, where }; };
  const early = await arm(false), taken = await arm(true);
  line(!early.why && !taken.why && early.free && taken.free, 'a flashlight man whose mate is shot is never left the script\'s: shot before either has left their room, and shot with the squad already in the bunkhouse, the other is let go inside three seconds',
    `before either had left: ${early.why || `${early.free ? `let go ${early.secs.toFixed(1)} s after the round` : 'STILL THE SCRIPT\'S after 3 s'} at ${early.where}`} · the squad in the bunkhouse: ${taken.why || `${taken.free ? `let go ${taken.secs.toFixed(1)} s after the round` : 'STILL THE SCRIPT\'S after 3 s'} at ${taken.where}`}`);
}
console.log(faults.length ? `=== tut-sky-check: FAIL (${faults.length}) ===\n${faults.map(f => '  ' + f).join('\n')}` : '=== tut-sky-check: ALL PASS ===');
process.exit(faults.length ? 1 : 0);
