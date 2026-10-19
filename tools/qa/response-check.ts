// THE RESPONSE TEAM IS THE LEVEL'S OWN — the check behind qrf.ts `RESPONSE` (scenarios.response in a level's file; scene/scenarios.ts ResponseData).
//   bun run tools/qa/response-check.ts   (`probes.ts response`, in the `qrf` family)     exit 0 = all hold · 1 = one does not
// The switch (and the picture's, which the net's word reads) is raised here, so the lines hold on BOTH stands (run it plain and under TPS_PROFILE=shipped).
// Headless: nothing here has been seen on a GPU, and nobody has played a run with a team on any of these levels.
//   (1) the files: exactly the levels chosen carry a block, each with its reason; the validator refuses a block with three muster marks, five men, a door
//       the level has not got
//   (2) the floor: every block stands on its built floor (checkResponse: free marks, a walk in for each man, posts that can be reached); a mark moved into
//       a wall is caught. The office's block is the old constant, mark for mark
//   (3) a level with no block has no team: the same gunfire on a locked-down floor calls nobody, and the panel's own call is refused
//   (4) a quiet mission gone loud calls ITS team: asked for on the net in the level's words (no 'two-six', no stairwell), the men stood up on the dealt
//       way's muster marks, as many as dealt, the way in thrown when the dealt time is up, and in on the level's fan
//   (5) no two calls alike: over sixteen calls on one level more than one way, more than one size, several times, all inside the block's ranges; the same
//       seed deals the same calls; RESPONSE.deal off is the block's first answer every time
//   (6) staging: a way whose muster an enemy stands at is never dealt; one he walks up to before they are stood there is given up for another, and
//       control says so
//   (7) with no word on the net the team walks the level's named places; where Sam really stands (unseen) changes nothing of it
//   (8) a man on the net sees him: that place is the net's word, control briefs the team on it, the team goes THERE — not to where he has since gone; the
//       man who said it dead and unfound, the word stands
//   (9) a man in an arm says nothing: what he saw reaches the net only when he is back on it
//   (10) the word is in a save: out and back, the same places at the same ages
//   (11) whoever is against them is their enemy: the partner in view of the element is contact, and he is the one they turn on
//   (12) never more of theirs up than the level's most: a man down, the second lift stands up only what the block has left
//   (13) the switch off: the quiet level has no team (as it was)
//   (14) a way with no door is open ground: men stood up there with an enemy in view go to the fight, they do not stand out the ten seconds
//   (15) a raid on a level whose block says so (RESPONSE.raid): gunfire heard at the set, and the man there alive `callSecs` later asks for the team in the
//        level's words; it comes on the DEFENDERS' side, by a way no squad man stands at, never more than eleven enemies with the garrison; it and the
//        squad fight
//   (16) the men at the set down before they can say it: nobody calls, however long the fight goes on
//   (17) the place is not taken while the team it called is up: the last defender down, the run goes on; the team down, it ends
//   (18) the raid rule off, or a block that does not say `raid` (the office under a room clear, or under a hostage rescue): the same gunfire calls nobody
//   (19) a restage mid-response: the team's men are gone with the cast, nothing is owed from the run before
//   (20) a team still on the road when the last defender falls never arrives: the place is taken and the call is called off
//   (21) the records office's raid: the way in decides it — from the lot the desk is the first man met (a call, or the desk down inside its six seconds); from the
//        other way in the desk calls the patrol. With it every level on the WITH list has a call played through by its own mission
// RESPONSE_BREAK=1 = the switch left off for the 'on' lines (and on for the 'off' lines): every line but (1) and (2), which read files and floors, must fail.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const Qm = await import(`${ROOT}/src/game/qrf.ts`);
const { RESPONSE, QRF_MARKS, requestQrf, resetQrf, checkResponse, hasResponse, responseWordSnapshot, responseWordRestore } = Qm;
const { PICTURE, ideasOf } = await import(`${ROOT}/src/game/picture.ts`);
const { fireWeapon, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { raiseEscalation } = await import(`${ROOT}/src/game/guards.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, BREAK = process.env.RESPONSE_BREAK === '1';
/** the levels that have a team, and nobody else (a level added to this list has its reason in its file's `why` and in docs/agents/enemies.md) */
const WITH = ['bazaar.json', 'crossing.json', 'depot-gwot.json', 'depot.json', 'police-post.json', 'records-gwot.json', 'records.json'];
/** …of them, the ones whose team answers a squad's raid (ResponseData.raid), with the mission that raids them */
const RAIDS: Record<string, string> = { 'depot.json': '?roomclear&squad=4', 'depot-gwot.json': '?roomclear&squad=4', 'records.json': '?roomclear&squad=2', 'records-gwot.json': '?roomclear&squad=2' };
const f1 = (x: number) => x.toFixed(1), flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: number[]) => `${f1(p[0])},${f1(p[2])}`;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function hushed<T>(f: () => T | Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } }
const text = (file: string) => readFileSync(resolve(ROOT, 'levels', file), 'utf8');
/** a level stood up with the switch as the line wants it; `q` starts its mission */
async function stand(file: string | null, seed: number, on: boolean, q: string | null = '?quiet=1', way = 0) {
  Math.random = seeded(0x7e5 + seed * 7919);
  const W: any = await hushed(() => standUp({ uploadEvery: 4, seed, ...(file ? { level: loadLevel(parseLevelData(text(file))) } : {}) }));
  const g = W.game; RESPONSE.on = on; RESPONSE.deal = true; RESPONSE.net = true; RESPONSE.raid = true; PICTURE.on = true;
  if (way) ROOMCLEAR.way = way;   // (the room clear's way in: 2 = the level's first other start)
  if (q && (g.level.scenarios?.quiet || /roomclear|rescue/.test(q))) await hushed(() => startFromQuery(g, q));
  g.godMode = true; g.aiEnabled = true; g.tune.qrf = true; g.tune.perimeter = false;
  for (let i = 0; i < 20; i++) W.step(DT);
  return W;
}
const steps = (W: any, secs: number, until?: () => boolean, each?: () => void) => { for (let i = 0; i < Math.round(secs * 60); i++) { each?.(); W.step(DT); if (until?.()) return true; } return !!until?.(); };
function tapRadio(g: any) { const lines: { t: number; text: string }[] = []; const orig = g.msg.bind(g); g.msg = (t: string) => { if (t.startsWith('radio: ')) lines.push({ t: g.time, text: t.slice(7) }); return orig(t); }; return lines; }
const notes = (g: any): string[] => g.qrf.log.map((l: any) => l.what);
const dealOf = (g: any) => { const n = [...notes(g)].reverse().find(x => x.startsWith('dealt:')); const m = n?.match(/way (\d+):men (\d+):eta (\d+)/); return m ? { way: +m[1], men: +m[2], eta: +m[3] } : null; };
/** Sam out of it: where `p` says (or the world's far corner), dark, invisible to the AI */
function hideSam(g: any, p: Vec3 = [39.2, 0, 0.8]) { g.teleportPlayer(p); g.player.visibility = 0.02; g.playerInvisible = true; }
/** Sam goes loud where he stands: three rifle rounds at the sky's edge, then the floor locked down by hand */
function goLoud(W: any) { const g = W.game, p = g.player.char.pos; g.player.slot = 'rifle'; g.player.holstered = false; for (let k = 0; k < 3; k++) { fireWeapon(g, g.player.char, [p[0] + 6, 1.2, p[2]], true); for (let i = 0; i < 10; i++) W.step(DT); } raiseEscalation(g, 2); }
/** a man of the shift with free floor in his view, and that floor */
function sighting(g: any, d: number): { seer: any; spot: Vec3 } { for (const m of staff(g)) { const spot = inFrontOf(g, m, d); if (spot) return { seer: m, spot }; } throw new Error('no man of the shift has free floor in his view'); }
const staff = (g: any) => g.guards.filter((x: any) => !x.unit && x.team === 'guard' && !x.civ && x.state !== 'dead');
/** free floor about `d` metres in front of a man, in his view */
function inFrontOf(g: any, m: any, d: number): Vec3 | null { const f = m.char.forward(); for (const k of [d, d - 1, d + 1, d - 2, d - 2.5]) for (const s of [0, 0.5, -0.5, 1, -1]) { const p: Vec3 = [m.char.pos[0] + f[0] * k - f[2] * s, 0, m.char.pos[2] + f[2] * k + f[0] * s]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.segmentBlocked([m.char.pos[0], 1.5, m.char.pos[2]], [p[0], 1.2, p[2]])) return p; } return null; }

export async function responseCheck(): Promise<boolean> {
  let all = true; const was = { ...RESPONSE }, picWas = PICTURE.on;   // (put back at the end: a runner that goes on in this process finds its stand as it left it)
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ON = !BREAK;
  console.log(`\n=== response-check: the response team is the level's own — where it comes in, who it is, what it was told (RESPONSE)${BREAK ? ' · RESPONSE_BREAK: the switch left off' : ''} ===`);

  // ---- (1) the files
  { const files = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).sort();
    const have = files.filter(f => { try { return !!JSON.parse(text(f)).scenarios?.response; } catch { return false; } });
    const whys = have.map(f => String(JSON.parse(text(f)).scenarios.response.why ?? ''));
    const errs = have.flatMap(f => (validateLevelData(JSON.parse(text(f))) as string[]).filter(e => /response/.test(e)));
    const broke = (edit: (R: any) => void) => { const d = JSON.parse(text('police-post.json')); edit(d.scenarios.response); return (validateLevelData(d) as string[]).filter(e => /response/.test(e)).length; };
    const b = [broke(R => R.ways[0].muster.pop()), broke(R => { R.men = [2, 5]; }), broke(R => { R.ways[1].door = 'no_such_gate'; }), broke(R => { delete R.why; }), broke(R => { R.men = [2.5, 3.5]; })];
    line(JSON.stringify(have) === JSON.stringify(WITH) && whys.every(w => w.length > 40) && !errs.length && b.every(n => n > 0),
      '(1) the chosen levels carry a block with its reason, nobody else does; a block short a mark, five strong, by a door the level has not got, with no reason, or half a man is refused',
      `${files.length} level files · with a block: ${have.join(' ')} · validator on them: ${errs.length ? errs.slice(0, 3).join(' · ') : 'clean'} · five broken edits refused: ${b.map(n => n > 0).join(' ')}`); }

  // ---- (2) the floor
  { const out: string[] = []; let caught = 0, clean = true;
    for (const f of [null, ...WITH]) { const W = await stand(f, 2, true, f ? RAIDS[f] ?? null : null); const g = W.game; const c: string[] = checkResponse(g); clean &&= c.length === 0 && !!g.level.scenarios?.response; out.push(`${f ?? 'office'}: ${c.length ? c.slice(0, 2).join(' / ') : 'stands'}`);
      if (f === 'police-post.json') { const R = g.level.scenarios.response, keep = R.ways[0].muster[0]; let wall: Vec3 | null = null; for (let x = 5; x < 35 && !wall; x += 0.5) for (let z = 5; z < 23 && !wall; z += 0.5) if (g.col.nav.isBlocked(x, z)) wall = [x, 0, z];
        R.ways[0].muster[0] = wall!; caught = checkResponse(g).length; R.ways[0].muster[0] = keep; } }
    const W = await stand(null, 2, true, null), R = W.game.level.scenarios.response, y = R.ways[0];
    const same = JSON.stringify(y.muster) === JSON.stringify(QRF_MARKS.landing) && JSON.stringify(y.entry) === JSON.stringify(QRF_MARKS.entry) && JSON.stringify(y.entryFace) === JSON.stringify(QRF_MARKS.entryFace) && y.door === QRF_MARKS.door && JSON.stringify(R.posts) === JSON.stringify(QRF_MARKS.posts) && JSON.stringify(R.outside) === JSON.stringify(QRF_MARKS.outsideSpawn);
    line(clean && caught > 0 && same, '(2) every block stands on its built floor; a muster mark moved into a wall is caught; the office\'s block is the old constant mark for mark', `${out.join(' · ')} · a mark in a wall: ${caught} fault(s) · office block = constant ${same}`); }

  // ---- (3) no block, no team
  { const out: string[] = []; let ok = true;
    for (const f of ['quiet-yard.json', 'quiet-relay.json']) { const W = await stand(f, 3, ON); const g = W.game; goLoud(W); steps(W, 12);
      const idle = g.qrf.state === 'idle', heard = g.qrf.loudT > -1e8, panel = requestQrf(g, 'panel'), none = !g.guards.some((x: any) => g.qrf.owns(x));
      ok &&= idle && heard && !panel && none && !hasResponse(g) && notes(g).some(n => n === 'no-team:this level has none'); out.push(`${f}: gunfire heard ${heard} · locked down ${g.escalation} · ${g.qrf.state} · panel call ${panel ? 'taken' : 'refused'}`); }
    line(ok, '(3) a level with no block has no team: the same gunfire on a locked-down floor calls nobody, and the panel\'s own call is refused', out.join(' · ')); }

  // ---- (4) a quiet mission gone loud calls its own team
  { const W = await stand('police-post.json', 4, ON); const g = W.game, Q = g.qrf, rx = tapRadio(g), R = g.level.scenarios.response;
    g.teleportPlayer(sighting(g, 7).spot); goLoud(W); steps(W, 4, () => Q.state !== 'idle');
    const asked = Q.state !== 'idle' && Q.reason === 'gunfire', D = dealOf(g), t0 = Q.requestedAt; hideSam(g);
    steps(W, 130, () => notes(g).includes('fan'), () => hideSam(g));
    const y = D ? R.ways[D.way] : null, men = Q.men as any[], tDoor = Q.deployedAt - t0;
    const stood = !!y && men.length === D!.men && men.every(m => m.callsign.startsWith(R.tag + '-'));
    const ten = Q.log.find((l: any) => l.what.startsWith('ten:')), fan = notes(g).includes('fan');
    const onFan = !!y && men.every((m, i) => flat(m.char.pos, y.entry[i]) < 2.5);
    const said = rx.map(l => l.text).join(' | '), own = /the post/.test(said) && /the picket/.test(said) && !!y && said.includes(y.name) && !/two-six|stairwell|QRF|response team/.test(said);
    line(asked && stood && !!ten && Math.abs(tDoor - D!.eta) < 1.5 && fan && onFan && own, '(4) the police post gone loud calls its own team: asked for in the level\'s words, stood up on the dealt way\'s marks, in when the dealt time is up, on the level\'s fan',
      `${Q.state}/${Q.reason} · dealt ${D ? `way ${D.way + 1} '${y!.name}', ${D.men} men, ${D.eta} s` : 'nothing'} · stood up ${men.map(m => m.callsign).join(' ')} · way in thrown at ${f1(tDoor)} s · on the fan ${onFan} (${men.map(m => at(m.char.pos)).join(' ')}) · the level's words ${own}: “${(rx.find(l => /send the picket/.test(l.text))?.text ?? '').slice(0, 90)}” “${(rx.find(l => /rolling/.test(l.text))?.text ?? '').slice(0, 130)}”`); }

  // ---- (5) no two calls alike
  { const deals = async (seed: number, n: number, deal = true) => { const W = await stand('bazaar.json', seed, ON); const g = W.game; hideSam(g); RESPONSE.deal = deal; const out: string[] = [];
      for (let i = 0; i < n; i++) { requestQrf(g, 'gunfire'); const D = dealOf(g); out.push(D ? `${D.way}/${D.men}/${D.eta}` : '-'); resetQrf(g); } RESPONSE.deal = true; return { out, R: g.level.scenarios.response }; };
    const A = await deals(5, 16), B = await deals(5, 6), C = await deals(6, 6), F = await deals(5, 6, false), R = A.R;
    const P = A.out.map(s => s.split('/').map(Number)), ways = new Set(P.map(p => p[0])), sizes = new Set(P.map(p => p[1])), etas = new Set(P.map(p => p[2]));
    const inside = P.every(p => p[0] >= 0 && p[0] < R.ways.length && p[1] >= R.men[0] && p[1] <= R.men[1] && p[2] >= R.eta[0] && p[2] <= R.eta[1] && p[2] % RESPONSE.etaStep === 0);
    const first = `0/${R.men[1]}/${(R.eta[0] + R.eta[1]) / 2}`;
    line(ways.size >= 2 && sizes.size >= 2 && etas.size >= 3 && inside && A.out.slice(0, 6).join() === B.out.join() && C.out.join() !== B.out.join() && F.out.every(s => s === first),
      '(5) sixteen calls on the bazaar: more than one way, more than one size, several times, all inside the block\'s ranges; one seed deals the same calls, another seed others; the deal off is the block\'s first answer every time',
      `way/men/secs: ${A.out.join(' ')} · ${ways.size} ways, ${sizes.size} sizes, ${etas.size} times · seed 5 again: ${B.out.join(' ')} · seed 6: ${C.out.join(' ')} · deal off: ${F.out.join(' ')}`); }

  // ---- (6) staging
  { const W = await stand('bazaar.json', 7, ON); const g = W.game, Q = g.qrf, R = g.level.scenarios.response, rx = tapRadio(g); const got = new Set<number>();
    hideSam(g, R.ways[1].muster[0]); for (let i = 0; i < 12; i++) { requestQrf(g, 'gunfire'); const D = dealOf(g); if (D) got.add(D.way); resetQrf(g); }
    hideSam(g); requestQrf(g, 'gunfire'); const D = dealOf(g); const w0 = D?.way ?? -1;
    steps(W, 4); if (w0 >= 0) hideSam(g, R.ways[w0].muster[0]);
    steps(W, 100, () => notes(g).some(n => n.startsWith('ten:')), () => { if (w0 >= 0) hideSam(g, R.ways[w0].muster[0]); });
    const re = notes(g).find(n => n.startsWith('re-dealt:')), w1 = Q.way, men = Q.men as any[];
    const moved = !!re && w1 !== w0 && men.length > 0 && men.every((m, i) => flat(m.char.pos, R.ways[w1].muster[i]) < 1.6) && rx.some(l => /change of plan/.test(l.text));
    line(got.size > 0 && !got.has(1) && moved, '(6) a way an enemy stands at the muster of is never dealt; one he walks up to before they are stood there is given up for another, and control says so',
      `Sam on way 2's muster, twelve calls: ways dealt ${[...got].map(w => w + 1).join(' ') || 'none'} · then dealt way ${w0 + 1}, Sam walks onto its muster: ${re ?? 'no re-deal'} · stood up at way ${w1 + 1}'s marks ${moved} · “${rx.find(l => /change of plan/.test(l.text))?.text ?? ''}”`); }

  // ---- (7) no word: the level's named places, wherever Sam really is
  { const run = async (sam: Vec3) => { const W = await stand('police-post.json', 8, ON); const g = W.game, rx = tapRadio(g); RESPONSE.deal = false; hideSam(g, sam); requestQrf(g, 'gunfire'); RESPONSE.deal = true;
      steps(W, 110, undefined, () => hideSam(g, sam)); return { targets: notes(g).filter(n => n.startsWith('target:')), word: g.qrf.word.size, fix: g.qrf.fix, rx, brief: rx.find(l => /rolling/.test(l.text))?.text ?? '' }; };
    const A = await run([39.2, 0, 0.8]), B = await run([24.5, 0, 10.0]);   // (B: stood in the radio room, in the dark, unseen)
    const sweeps = A.targets.filter(t => t.endsWith(':sweep'));
    line(sweeps.length >= 4 && A.targets.join() === B.targets.join() && A.word === 0 && B.word === 0 && !B.fix && /no word on where/.test(A.brief) && A.rx.some(l => /nothing on the net/.test(l.text)),
      '(7) nothing said on the net: control has no word for them, the team walks the level\'s named places, and where Sam really stands (unseen, in the radio room) changes nothing of it',
      `“${A.brief.slice(0, 110)}” · places walked: ${sweeps.map(t => t.split(':')[2]).join(', ')} · with Sam in the radio room: ${A.targets.join() === B.targets.join() ? 'the same walk' : B.targets.map(t => t.split(':')[2]).join(', ')} · the net's word ${A.word}/${B.word}`); }

  // ---- (8) (10) a man on the net sees him
  { const W = await stand('police-post.json', 9, ON); const g = W.game, Q = g.qrf, rx = tapRadio(g);
    const { seer, spot } = sighting(g, 4); g.playerInvisible = false;
    steps(W, 6, () => Q.word.has('player'), () => { g.teleportPlayer(spot); g.player.visibility = 1; });
    const seenAt: Vec3 = [...(Q.word.get('player')?.at ?? [0, 0, 0])] as Vec3, had = Q.word.has('player');
    // (the alarm's own place is the other thing said on the net, and the later of the two is what they go on: held down from here so the word alone is read)
    const away = () => { hideSam(g); g.alarm.placed = false; };
    away(); steps(W, 3, undefined, away);
    // (10) the word out to a save's rows and back
    const rows = responseWordSnapshot(g), before = JSON.stringify(rows); Q.word.clear(); responseWordRestore(g, rows); const back = JSON.stringify(responseWordSnapshot(g)) === before && rows.length > 0;
    if (Q.state !== 'idle') resetQrf(g);
    away(); RESPONSE.deal = false; requestQrf(g, 'gunfire'); RESPONSE.deal = true;
    steps(W, 120, () => notes(g).some(n => n.startsWith('target:')), away);
    const T = Q.target, brief = rx.find(l => /rolling/.test(l.text))?.text ?? '', samNow = g.player.char.pos;
    killGuard(g, seer, [1, 0, 0], true); steps(W, 3, undefined, away); const kept = Q.word.has('player') && !seer.found;   // (he is down and nobody has found him: what he said is still what control has)
    const there = !!T && had && flat(T.pos, seenAt) < 6 && flat(T.pos, samNow) > 10 && !notes(g).some(n => n.endsWith(':sweep'));
    line(had && kept && /last word: one man, /.test(brief) && there, '(8) a man on the net sees him: that place is the net\'s word, control briefs the team on it and the team goes there, not to where he has since gone; the man who said it dead and unfound, the word stands',
      `seen at ${at(seenAt)} by ${seer.callsign} · word kept past him ${kept} · “${brief.slice(0, 130)}” · first target ${T ? `${T.room} ${at(T.pos)}` : 'none'} · ${T ? f1(flat(T.pos, seenAt)) : '?'} m from the word, ${T ? f1(flat(T.pos, samNow)) : '?'} m from Sam`);
    line(back, '(10) the net\'s word goes into a save\'s rows and comes back the same: who, where, how old', `${rows.length} row(s) · ${before.slice(0, 120)}`); }

  // ---- (9) a man in an arm says nothing
  { const W = await stand('police-post.json', 10, ON); const g = W.game, Q = g.qrf;
    const { seer, spot } = sighting(g, 4); g.playerInvisible = false;
    const sawIt = steps(W, 4, () => ideasOf(g, seer).some((I: any) => I.who === 'player'), () => { g.teleportPlayer(spot); g.player.visibility = 1; });
    const early = Q.word.has('player');   // (inside the picture's tellSecs he has not said it yet)
    seer.held = true; hideSam(g); steps(W, 4, undefined, () => { hideSam(g); seer.held = true; });
    const silent = !Q.word.has('player'), still = ideasOf(g, seer).some((I: any) => I.who === 'player' && !I.lost);
    seer.held = false; steps(W, 2, () => Q.word.has('player'), () => hideSam(g));
    line(sawIt && !early && silent && (!still || Q.word.has('player')), '(9) a man in an arm says nothing: what he saw is not the net\'s word while he is held; back on the net, it is',
      `saw him ${sawIt} · on the net before he could say it ${early} · held four seconds: word ${silent ? 'none' : 'there'} · he still holds the idea ${still} · let go: word ${Q.word.has('player') ? 'there' : 'none'}`); }

  // ---- (11) whoever is against them is their enemy
  { const W = await stand('crossing.json', 11, ON, '?quiet=1&squad=1'); const g = W.game, Q = g.qrf; const mate = g.guards.find((x: any) => x.team === 'operative');
    hideSam(g); RESPONSE.deal = false; requestQrf(g, 'gunfire'); RESPONSE.deal = true;
    const far: Vec3 = [38.8, 0, 26.6]; if (mate) { mate.char.pos[0] = far[0]; mate.char.pos[2] = far[2]; }
    steps(W, 110, () => notes(g).includes('fan'), () => { hideSam(g); if (mate) { mate.char.pos[0] = far[0]; mate.char.pos[2] = far[2]; } });
    const lead = (Q.men as any[])[0]; const p = lead ? inFrontOf(g, lead, 5) : null;
    const contact = !!mate && !!p && steps(W, 8, () => notes(g).some(n => n.startsWith('contact:')), () => { hideSam(g); mate.char.pos[0] = p[0]; mate.char.pos[2] = p[2]; mate.visibility = 1; });
    const on = (Q.men as any[]).filter(m => m.foe === mate).length;
    line(!!mate && contact && on > 0, '(11) the partner in view of the element is contact, and he is the one they turn on (Sam is out of it, unseen)', `partner ${mate ? 'staged' : 'missing'} · element in ${notes(g).includes('fan')} · contact ${contact} · men whose enemy is the partner ${on}/${Q.men.length}`); }

  // ---- (12) never more of theirs up than the level's most
  { const W = await stand('police-post.json', 12, ON); const g = W.game, Q = g.qrf, R = g.level.scenarios.response; g.tune.perimeter = true; g.tune.perimeterEta = 6; g.tune.perimeterSize = 2;
    hideSam(g); RESPONSE.deal = false; requestQrf(g, 'gunfire'); RESPONSE.deal = true; let most = 0; const up = () => g.guards.filter((x: any) => Q.owns(x) && x.state !== 'dead').length;
    steps(W, 110, () => notes(g).includes('fan'), () => hideSam(g)); const came = Q.men.length;
    if (Q.men[3]) killGuard(g, Q.men[3], [1, 0, 0], false);
    steps(W, 40, undefined, () => { hideSam(g); most = Math.max(most, up()); });
    const per = notes(g).find(n => n.startsWith('perimeter:')) ?? '', posted = (Q.perim?.men ?? []).filter((p: any) => flat(p.gd.char.pos, p.post.pos) < 1.5).length;
    line(came === R.men[1] && !!per && most <= R.men[1] && posted >= 1, '(12) a man of theirs down: the second lift stands up only what the level\'s most leaves room for, and its men take the posts outside the gates',
      `${came} came · ${per || 'no second lift'} · most of theirs up at once ${most} (the level's most ${R.men[1]}) · on their posts ${posted}/${Q.perim?.men.length ?? 0}`); }

  // ---- (13) the switch off
  { const W = await stand('police-post.json', 4, !ON); const g = W.game; g.teleportPlayer(sighting(g, 7).spot); goLoud(W); steps(W, 12);
    line(g.qrf.state === 'idle' && !hasResponse(g) && !requestQrf(g, 'panel'), '(13) the switch off: the police post has no team, as it was — the same gunfire calls nobody', `${g.qrf.state} · gunfire heard ${g.qrf.loudT > -1e8} · locked down ${g.escalation} · has a team ${hasResponse(g)}`); }

  // ---- (14) stood up on open ground in an enemy's view
  { const W = await stand('bazaar.json', 14, ON); const g = W.game, Q = g.qrf, R = g.level.scenarios.response; hideSam(g); RESPONSE.deal = false; requestQrf(g, 'gunfire'); RESPONSE.deal = true;
    steps(W, 100, () => Q.state === 'arriving', () => hideSam(g));
    const m0 = R.ways[0].muster[0], spot: Vec3 = [m0[0] + 6.5, 0, m0[2] + 0.5]; g.playerInvisible = false; const t0 = g.time;   // (he walks into the street's open end once they are stood there)
    const seen = steps(W, 9, () => notes(g).some(n => n.startsWith('contact:')), () => { g.teleportPlayer(spot); g.player.visibility = 1; });
    line(seen && notes(g).includes('seen-at-the-muster') && Q.phase === 'fight', '(14) a way with no door: men stood up at the muster when an enemy walks into plain view up the street do not stand out their ten seconds — contact, and the fight',
      `Sam lit ${f1(flat(spot, m0))} m up the street from the muster · ${seen ? `contact after ${f1(g.time - t0)} s` : 'no contact in nine seconds'} · ${Q.state}/${Q.phase}`); }

  // ---- (15) a raid brings the level's team, on the defenders' side
  const hutOf = (g: any) => g.roomClear.rooms.find((r: any) => r.def.id === g.level.scenarios.response.raid.room).defenders as any[];
  const squadOf = (g: any) => [g.player.char.pos, ...g.nightBreach.ops.filter((o: any) => o.state !== 'dead').map((o: any) => o.char.pos)] as Vec3[];
  { const W = await stand('depot.json', 15, ON, RAIDS['depot.json']); const g = W.game, Q = g.qrf, rx = tapRadio(g), R = g.level.scenarios.response;
    const hut = hutOf(g).map((h: any) => h.callsign); goLoud(W); const heardAt = Q.raidT;
    const asked = steps(W, 14, () => Q.state !== 'idle'), beat = Q.requestedAt - heardAt, ask = rx.find(l => /we are being hit/.test(l.text))?.text ?? '';
    steps(W, 120, () => Q.state === 'arriving'); const D = dealOf(g), men = Q.men as any[], y = D ? R.ways[D.way] : null;
    const side = men.length > 0 && men.every(m => m.team === 'hostile' && m.callsign.startsWith(R.tag + '-')), eleven = g.nightBreach.hostiles.length + men.length;
    const apart = y ? Math.min(...squadOf(g).map(p => flat(p, y.muster[0]))) : 0;
    const fought = steps(W, 90, () => notes(g).some(n => n.startsWith('contact:') || n.startsWith('man-down:')));
    const said = rx.map(l => l.text).join(' | ');
    line(asked && beat >= RESPONSE.callSecs - 0.05 && beat < RESPONSE.callSecs + 1 && hut.some((c: string) => ask.startsWith(c)) && /the depot/.test(ask) && /the convoy escort/.test(ask) && !/two-six|QRF|response team/.test(said) && side && eleven <= 11 && apart >= RESPONSE.clearM && fought,
      '(15) a raid on the depot: gunfire heard in the signals hut, and a man of it asks for the escort once he has lived to say it; it comes on the defenders\' side by a gate no squad man stands at, inside the eleven, and it and the squad fight',
      `heard in the hut at ${f1(heardAt)} s · asked ${asked ? `${f1(beat)} s later` : 'never'}: "${ask.slice(0, 70)}" · ${men.length} came (${men.map(m => `${m.callsign} ${m.team}`).join(', ') || 'nobody'}) by ${y?.name ?? '—'}, ${f1(apart)} m from the nearest of the squad · enemies in all ${eleven} · ${fought ? 'they met' : 'never met in ninety seconds'}`); }

  // ---- (16) the set taken first: nobody calls
  { const W = await stand('depot.json', 16, ON, RAIDS['depot.json']); const g = W.game, Q = g.qrf, rx = tapRadio(g);
    goLoud(W); const heard = Q.raidT > -1e8; for (const h of hutOf(g)) killGuard(g, h, 'player');   // (inside the six seconds)
    steps(W, 20); goLoud(W); steps(W, 25);
    const W2 = await stand('depot.json', 16, ON, RAIDS['depot.json']); const g2 = W2.game; goLoud(W2); const called = steps(W2, 14, () => g2.qrf.state !== 'idle');
    line(heard && Q.state === 'idle' && !rx.some(l => /CONTROL/.test(l.text)) && called, '(16) the hut\'s men down before they can say it: nobody calls, the gunfire going on; the same start with them alive is a call',
      `hut down inside the ${RESPONSE.callSecs} s: ${Q.state}, control ${rx.some(l => /CONTROL/.test(l.text)) ? 'spoke' : 'silent'}, ${g.nightBreach.hostiles.filter((h: any) => h.state !== 'dead').length} defenders still up and shooting · hut alive: ${called ? 'called' : 'no call'}`); }

  // ---- (17) not taken while the team is up
  { const W = await stand('depot.json', 17, ON, RAIDS['depot.json']); const g = W.game, Q = g.qrf; goLoud(W);
    steps(W, 14, () => Q.state !== 'idle'); steps(W, 120, () => Q.state === 'arriving'); const came = Q.men.length;
    for (const h of g.nightBreach.hostiles) if (h.state !== 'dead') killGuard(g, h, 'player'); steps(W, 2);
    const open = !g.roomClear.end && g.roomClear.active, told = g.roomClear.log?.some?.((l: any) => l.what === 'team-up') ?? false;
    for (const m of [...Q.men]) killGuard(g, m, 'player'); steps(W, 2);
    line(came > 0 && open && told && g.roomClear.end === 'taken', '(17) the depot is not taken while the escort it called is up: the last defender down, the run goes on; the escort down, it is taken',
      `${came} of the escort stood up · every defender down: ${open ? 'the run goes on' : `ended (${g.roomClear.end})`}${told ? ', and says who is left' : ''} · the escort down: ${g.roomClear.end ?? 'still going'}`); }

  // ---- (18) the raid rule off, and a block with no `raid`
  { const W = await stand('depot.json', 15, true, RAIDS['depot.json']); const g = W.game; RESPONSE.raid = BREAK; goLoud(W); steps(W, 14); const st = g.qrf.state, has = hasResponse(g);
    const W2 = await stand(null, 18, true, '?roomclear'); const g2 = W2.game; RESPONSE.raid = !BREAK; goLoud(W2); steps(W2, 14);
    const W3 = await stand(null, 18, true, '?rescue'); const g3 = W3.game; goLoud(W3); steps(W3, 14); const asked3 = requestQrf(g3, 'gunfire');
    line(st === 'idle' && !has && g2.qrf.state === 'idle' && g2.nightBreach.active && g3.qrf.state === 'idle' && !asked3 && !!g3.rescue?.active, '(18) the raid rule off: the same raid on the depot calls nobody; and the office, whose block answers a quiet night, sends nobody to a room clear or to a hostage rescue (a rescue ends on its own cast: no team is ever on its way to one)',
      `depot, rule off: ${st}, has a team ${has} · the office under a room clear: ${g2.qrf.state} (raid on ${g2.nightBreach.active}) · under a rescue: ${g3.qrf.state}, a call on gunfire taken ${asked3} (rescue on ${!!g3.rescue?.active})`); RESPONSE.raid = true; }

  // ---- (19) a restage mid-response
  { const W = await stand('depot.json', 19, ON, RAIDS['depot.json']); const g = W.game, Q = g.qrf; goLoud(W);
    steps(W, 14, () => Q.state !== 'idle'); steps(W, 120, () => Q.state === 'arriving'); const came = Q.men.length, tag = g.level.scenarios.response.tag;
    await hushed(() => g.roomClear.restage()); steps(W, 3);
    const left = g.guards.filter((x: any) => String(x.callsign).startsWith(tag + '-')).length;
    line(came > 0 && left === 0 && g.qrf.state === 'idle' && g.qrf.raidT < -1e8 && g.roomClear.active && !g.roomClear.end, '(19) a restage with the escort stood at its gate: its men go with the cast, the next run owes nothing',
      `${came} stood up · after the restage: ${left} of them on the floor, the response ${g.qrf.state}, gunfire remembered ${g.qrf.raidT > -1e8}`); }

  // ---- (20) the last defender down with the team still on the road
  { const W = await stand('depot.json', 20, ON, RAIDS['depot.json']); const g = W.game, Q = g.qrf; goLoud(W);
    const asked = steps(W, 14, () => Q.state !== 'idle'); steps(W, 3);
    for (const h of g.nightBreach.hostiles) if (h.state !== 'dead') killGuard(g, h, 'player'); steps(W, 2);
    const end = g.roomClear.end, off = notes(g).some(n => n.startsWith('called-off')); steps(W, 100);
    line(asked && end === 'taken' && off && Q.state === 'idle' && Q.men.length === 0, '(20) the escort still on the road when the last defender falls: the depot is taken, the call is called off, and nobody walks in afterwards',
      `${asked ? 'called' : 'never called'} · every defender down three seconds later: ${end ?? 'still going'} · ${off ? 'called off' : 'not called off'} · a hundred seconds on: the response ${Q.state}, ${Q.men.length} of them on the floor`); }

  // ---- (21) the records office: the way in decides it (every level with a block has a call played by its own mission)
  { const tale: string[] = []; let honest = true, ok = false, got = 'never called';
    // from the dark lot the desk is the first man the pair meets: each start is a call, or the desk down inside its six seconds and nobody called
    for (const seed of [21, 22, 23]) { const W = await stand('records.json', seed, ON, RAIDS['records.json']); const g = W.game, Q = g.qrf, desk = hutOf(g); goLoud(W);
      const asked = steps(W, 14, () => Q.state !== 'idle'), up = desk.filter((h: any) => h.state !== 'dead').length;
      tale.push(`the lot, start ${seed}: ${asked ? 'the desk called' : up ? 'no call, a desk man still up' : 'the desk down inside its six seconds, nobody called'}`); if (!asked && up) honest = false; }
    // from the other way in (the dark west side, on the records room's own door) the desk hears it and lives to say so
    { const W = await stand('records.json', 21, ON, RAIDS['records.json'], 2); const g = W.game, Q = g.qrf, rx = tapRadio(g), R = g.level.scenarios.response; goLoud(W);
      const asked = steps(W, 14, () => Q.state !== 'idle'), ask = rx.find(l => /we are being hit/.test(l.text))?.text ?? ''; steps(W, 120, () => Q.state === 'arriving');
      const D = dealOf(g), men = Q.men as any[], y = D ? R.ways[D.way] : null;
      const side = men.length > 0 && men.every(m => m.team === 'hostile' && m.callsign.startsWith(R.tag + '-')), eleven = g.nightBreach.hostiles.length + men.length;
      const apart = y ? Math.min(...squadOf(g).map(p => flat(p, y.muster[0]))) : 0;
      ok = asked && g.roomClear.way === 1 && /the records office/.test(ask) && /the night patrol/.test(ask) && side && men.length >= R.men[0] && men.length <= R.men[1] && eleven <= 11 && apart >= RESPONSE.clearM;
      if (asked) got = `"${ask.slice(0, 70)}" · ${men.length} came (${men.map(m => `${m.callsign} ${m.team}`).join(', ') || 'nobody'}) by ${y?.name ?? '—'}, ${f1(apart)} m from the nearest of the pair · enemies in all ${eleven}`; }
    ROOMCLEAR.way = 0;
    line(honest && ok, '(21) a raid on the records office: from the lot the night desk is the first man met, and a start is a call or the desk down inside its six seconds; from the other way in a man of the desk asks for the patrol, and it comes on the defenders\' side, two men, by a way neither of the pair stands at, inside the eleven',
      `${tale.join(' · ')} · the other way in: ${got}`); }

  Object.assign(RESPONSE, was); PICTURE.on = picWas;
  console.log(`\n=== response-check: ${all ? 'ALL PASS' : 'SOME FAILED'} ===`);
  return all;
}
if (import.meta.main) process.exit(await responseCheck() ? 0 : 1);
