// The 'wxkinds' family (game/weatherKinds.ts + game/weather.ts — the weather a level can be STARTED in: ?weather=<kind>), run through probes.ts:
//   bun run tools/qa/probes.ts wxkinds | wxkinds-default | wxkinds-roofs | wxkinds-sight | wxkinds-hearing | wxkinds-save | wxkinds-journal | wxkinds-url
// PASS / FAIL each, all headless:
//   wxkinds-default   no kind picked = the game as it was: the office's two footprints, the frame's three weather words 0, hearPath() hands back propagate()'s own
//                     object, airTrans() is exactly 1 — and a seeded 20 s of the office digests the same after a kind was put on and taken off again
//   wxkinds-roofs     with a kind the roofs are the LEVEL's: every loud squad map's ceiling slabs (the compound's yard and the barracks' courtyard are open sky,
//                     their rooms are not), the third / fourth packed for the renderer within 0.1 m, the fog's 32 bits decoding to what the simulation uses
//   wxkinds-sight     fog cuts sight by the smoke's own thresholds: clear air at arm's length, under 0.3 (blind) past ~20 m outdoors, thinner under a roof, a
//                     crouched man deeper in it; the guards' line to Sam (Guard.smokeTrans) and a pair's (pairSmoke) carry exactly airTrans(); clear weather = 1
//   wxkinds-hearing   rain masks sound at the listener by the mixer's own bed: a footstep 6 m off outdoors reaches a calm man in clear weather and does not in a
//                     downpour, does again under a roof (a third of the bed); a gunshot is heard in anything; a thunderclap drowns more for WX_SIM.thunderSecs
//   wxkinds-save      the kind rides in the checkpoint: a fog run's file loaded into a game born in the level's own weather puts it in fog (roofs, fog, wind),
//                     and the other way about; a file from before kinds (no field) = none
//   wxkinds-journal   … and so in a session journal's frame 0: the scripted session (journal-probes.ts recordScripted: walk, crouch, whistle, canister, a light shot
//                     out, sprint) recorded in a DOWNPOUR replays identically into a fresh game born in the level's own weather — and the same recording's
//                     digests differ from one made with no kind picked (the weather really was in the simulation it journals)
//   wxkinds-url       ?weather= reads back, an unknown name is none, the mission list's links carry the pick and lose it to the character when it is taken off
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const K = await import(`${ROOT}/src/game/weatherKinds.ts`);
const WX = await import(`${ROOT}/src/game/weather.ts`);
const { hearingCheck } = await import(`${ROOT}/src/game/guards.ts`);
const { pairSmoke } = await import(`${ROOT}/src/game/roomfight.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { canLoad } = await import(`${ROOT}/src/game/savestate.ts`);
const { missionList, missionHref } = await import(`${ROOT}/src/ui/missions.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const levelOf = (name: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')));
async function born(kind: string | null, level?: string): Promise<any> {
  const log = console.log; console.log = () => {};
  K.WEATHER_BOOT.kind = kind;
  try { return await standUp(level ? { level: levelOf(level) } : {}); } finally { K.WEATHER_BOOT.kind = null; console.log = log; }
}
const SQUAD_MAPS = ['compound', 'block-squads', 'barracks', 'warehouse'];

// ---------------------------------------------------------------- wxkinds-default
export async function wxDefault() {
  const F = family('wxkinds-default: no kind picked = the game as it was (weather.ts kind null)');
  const W = await born(null); const g = W.game, w = g.weather; W.step(DT); W.step(DT);
  { const fr = g.engine.weather; const p = g.col.sound.propagate([10, 1, 10], [14, 1.5, 12]);
    const f: string[] = [];
    if (w.kind !== null) f.push(`kind ${w.kind}`);
    if (JSON.stringify(w.roofs) !== JSON.stringify([WX.INTERIOR, WX.ANNEX])) f.push(`roofs ${JSON.stringify(w.roofs)}`);
    if ((fr.roofC ?? 0) !== 0 || (fr.roofD ?? 0) !== 0 || (fr.fog ?? 0) !== 0) f.push(`frame words ${fr.roofC} ${fr.roofD} ${fr.fog}`);
    if (fr.interior !== WX.INTERIOR || fr.annex !== WX.ANNEX) f.push('the frame is not handed INTERIOR / ANNEX themselves');
    if (WX.airTrans(g, [1, 1.6, 1], [1, 1.1, 27]) !== 1) f.push('airTrans is not exactly 1');
    if (w.hearMask([1, 1.5, 1]) !== 1) f.push('hearMask is not exactly 1');
    const q = WX.hearPath(g, [10, 1, 10], [14, 1.5, 12]); if (q.pathLen !== p.pathLen || q.carry !== p.carry) f.push('hearPath differs from propagate');
    F.verdict(f.length === 0, "the office's two footprints, the frame's weather words 0, airTrans and hearMask exactly 1, hearPath = propagate", f.join('; ') || `roofs ${JSON.stringify(w.roofs)} · storm ${w.storm} rain ${w.rainRate} wind ${w.wind} · cloud ${w.cloud} (to read, not applied)`); }
  { const run = async (toggle: boolean) => { Math.random = seeded(4242); const A = await born(null); A.game.weather.seed(5); if (toggle) { A.game.weather.setKind('fog'); A.game.weather.setKind('downpour'); A.game.weather.setKind(null); A.game.weather.seed(5); }
      let h = ''; for (let i = 0; i < 20 / DT; i++) { A.step(DT); if (i % 60 === 59) h += hashDigest(digestGame(A.game, true)) + ' '; } return { h, r: Math.random(), wet: A.game.weather.wet, roofs: JSON.stringify(A.game.weather.roofs), storm: JSON.stringify(A.game.wind.all.find((s: any) => s.why === 'storm').interior) }; };
    const a = await run(false), b = await run(true);
    F.verdict(a.h === b.h && a.r === b.r && a.roofs === b.roofs && a.storm === b.storm, 'a seeded 20 s of the office digests the same after fog and a downpour were put on and taken off (setKind(null) puts everything back)', a.h === b.h ? `20 digests equal · Math.random() after both ${a.r.toFixed(6)} · storm record ${a.storm}` : `digests differ: ${a.h.slice(0, 80)} vs ${b.h.slice(0, 80)}`); }
  return F.done();
}

// ---------------------------------------------------------------- wxkinds-roofs
export async function wxRoofs() {
  const F = family("wxkinds-roofs: with a kind picked the no-rain footprints are the level's own ceiling slabs (weather.ts roofsOf)");
  const spots: Record<string, { open: [number, number][]; roofed: [number, number][]; n: number }> = {
    compound: { n: 4, open: [[11.5, 12], [22, 21.5], [2, 2]], roofed: [[20, 12], [7, 21], [6.5, 6], [28, 22.5]] },                 // the walled yard, the gate; the house and its three sheds
    barracks: { n: 3, open: [[20, 14], [30, 14], [2, 14]], roofed: [[20, 7], [20, 21], [8, 14]] },                                // the courtyard; both wings and the west link
    warehouse: { n: 1, open: [[2, 2], [38, 16]], roofed: [[20, 14]] },
    'block-squads': { n: 2, open: [[38, 13], [2, 2]], roofed: [[20, 14], [2.5, 11]] },
  };
  for (const name of SQUAD_MAPS) {
    const W = await born('rain', name); const g = W.game, w = g.weather; W.step(DT);
    const S = spots[name], f: string[] = [];
    if (w.roofs.length !== S.n) f.push(`${w.roofs.length} roofs (want ${S.n})`);
    for (const [x, z] of S.open) if (w.underRoof(x, z)) f.push(`(${x}, ${z}) reads roofed`);
    for (const [x, z] of S.roofed) if (!w.underRoof(x, z)) f.push(`(${x}, ${z}) reads open`);
    const fr = g.engine.weather; const want = WX.roofsOf(g.level.boxes);
    const got = [fr.interior, fr.annex, K.unpackRect(fr.roofC ?? 0), K.unpackRect(fr.roofD ?? 0)].slice(0, want.length);
    want.forEach((r: number[], i: number) => { const e = Math.max(...r.map((x, k) => Math.abs(x - got[i][k]))); if (e > (i < 2 ? 1e-9 : K.ROOF_Q + 1e-6)) f.push(`roof ${i} off by ${f3(e)} m on the frame`);
      if (got[i][0] > r[0] + 1e-6 || got[i][1] > r[1] + 1e-6 || got[i][2] < r[2] - 1e-6 || got[i][3] < r[3] - 1e-6) f.push(`roof ${i} is smaller on the frame than its slab`); });   // (packed outward: never a strip of rain inside a wall)
    if ((fr.roofC ?? 0) === 0 || (want.length < 3) !== (fr.roofC === 1)) f.push('roofC word wrong (never 0 under a kind: 1 = no third roof)'); if ((want.length < 4) !== ((fr.roofD ?? 0) === 0)) f.push('roofD word wrong');
    // legacy on this level, for the page: today's default keeps the office's footprint on every map
    const L = await born(null, name); const dryYard = S.open.filter(([x, z]) => L.game.weather.underRoof(x, z)).length;
    F.verdict(f.length === 0, `${name}: ${S.n} roof${S.n > 1 ? 's' : ''}, open sky and rooms where the level has them, the frame carries them`, f.join('; ') || `${w.roofs.map((r: number[]) => `[${r.map(x => +x.toFixed(1)).join(' ')}]`).join(' ')} · with no kind picked ${dryYard} of ${S.open.length} open spots read roofed (the office's rectangle)`);
  }
  { const f: string[] = [];
    for (const k of K.WEATHER_KINDS) { const P = K.WEATHER_PRESETS[k]; const w = K.packFog(P.fog), u = K.unpackFog(w);
      if (!P.fog) { if (w !== 0 || u !== null) f.push(`${k}: no fog but word ${w}`); continue; }
      if (!u || Math.abs(u.sigma - P.fog.sigma) > 0.0005 || Math.abs(u.H - P.fog.H) > 0.25 || Math.abs(u.leak - P.fog.leak) > 0.072 || Math.abs(u.gain - P.fog.gain) > 0.125 || u.tint.some((c: number, i: number) => Math.abs(c - P.fog.tint[i]) > 0.034)) f.push(`${k}: ${JSON.stringify(P.fog)} → ${JSON.stringify(u)}`);
      if (K.packFog(u) !== w) f.push(`${k}: the word does not survive a round trip`);
    }
    const W = await born('fog', 'compound'); if (JSON.stringify(W.game.weather.fog) !== JSON.stringify(K.unpackFog(K.packFog(K.WEATHER_PRESETS.fog.fog)))) f.push('the simulation does not use the decoded word');
    F.verdict(f.length === 0, "every kind's fog packs into 32 bits within a step of what was authored, and the simulation uses the decoded word (the renderer's numbers)", f.join('; ') || K.WEATHER_KINDS.map((k: string) => `${k} ${K.packFog(K.WEATHER_PRESETS[k].fog) ? '0x' + K.packFog(K.WEATHER_PRESETS[k].fog).toString(16) : '—'}`).join(' · ')); }
  return F.done();
}

// ---------------------------------------------------------------- wxkinds-sight
export async function wxSight() {
  const F = family("wxkinds-sight: fog stands between an eye and a man as smoke does (weather.ts airTrans → Guard.smokeTrans / pairSmoke)");
  const Wf = await born('fog'), Wc = await born('clear'); /* (the office: it has a shift of its own, and the lot north of it is open sky) */ const gf = Wf.game, gc = Wc.game; Wf.step(DT); Wc.step(DT);
  const out = (d: number, ya = 1.6, yb = 1.1): [Vec3, Vec3] => [[2, ya, 2], [2 + d, yb, 2]];   // along the north strip of the lot: open sky
  { const T = [2, 5, 10, 15, 20, 25, 30].map(d => gf.weather.airTrans(...out(d))); const f: string[] = [];
    if (!(T[0] > 0.85)) f.push(`2 m ${f3(T[0])}`); if (!T.every((t, i) => i === 0 || t < T[i - 1])) f.push('not falling with distance');
    const blind = [2, 5, 10, 15, 20, 25, 30][T.findIndex(t => t < 0.3)]; if (!(blind >= 15 && blind <= 25)) f.push(`blind from ${blind} m (want about 20)`);
    const crouch = gf.weather.airTrans(...out(15, 1.6, 0.6)), stand = gf.weather.airTrans(...out(15, 1.6, 1.1)); if (!(crouch < stand)) f.push('a crouched man is not deeper in it');
    const inT = gf.weather.airTrans([15, 1.6, 10], [30, 1.1, 10]); if (!(inT > 0.8)) f.push(`15 m under the roof ${f3(inT)}`);
    const clear = gc.weather.airTrans(...out(30)); if (clear !== 1) f.push(`clear weather ${clear}`);
    F.verdict(f.length === 0, 'outdoors the fog falls with distance to blind (< 0.3) near 20 m, lies deeper low down, barely stands under a roof; clear weather is exactly 1', f.join('; ') || `T at 2 5 10 15 20 25 30 m: ${T.map(f3).join(' ')} · crouched at 15 m ${f3(crouch)} vs ${f3(stand)} · 15 m indoors ${f3(inT)}`); }
  { // the seams: a guard's line to Sam, a pair's line
    const f: string[] = []; const d: string[] = [];
    for (const [g, W, name] of [[gf, Wf, 'fog'], [gc, Wc, 'clear']] as [any, any, string][]) {
      const gd = g.guards.find((x: any) => x.state !== 'dead'); if (!gd) { f.push('no guard on the level'); continue; }
      g.aiEnabled = false; g.teleportPlayer([2, 0, 2]); gd.char.pos = [27, 0, 2]; W.step(DT); W.step(DT);
      const eye = gd.char.bones.head ?? [gd.char.pos[0], 1.65, gd.char.pos[2]], chest = g.player.char.bones.chest ?? [2, 1.1, 2];
      const want = g.weather.airTrans(eye, chest);
      if (Math.abs(gd.smokeTrans - want) > 1e-9) f.push(`${name}: Guard.smokeTrans ${f3(gd.smokeTrans)} ≠ airTrans ${f3(want)}`);
      const o = g.guards.find((x: any) => x !== gd && x.state !== 'dead');
      if (o) { o.char.pos = [2, 0, 3]; W.step(DT); const ps = pairSmoke(g, gd.char, o.char); if (name === 'fog' ? !(ps < 0.3) : ps !== 1) f.push(`${name}: pairSmoke at 25 m ${f3(ps)}`); d.push(`${name}: to Sam ${f3(gd.smokeTrans)}, pair ${f3(ps)}`); }
      if (name === 'fog' && !(gd.smokeTrans < 0.3)) f.push(`fog: his line to Sam at 25 m is ${f3(gd.smokeTrans)} (not blind)`);
      if (name === 'clear' && gd.smokeTrans !== 1) f.push(`clear: ${gd.smokeTrans}`);
    }
    F.verdict(f.length === 0, "a man 25 m off across the lot: his line to Sam and a pair's line are blind in fog (< 0.3, the smoke's threshold) and exactly 1 in clear weather", f.join('; ') || d.join(' · ')); }
  return F.done();
}

// ---------------------------------------------------------------- wxkinds-hearing
export async function wxHearing() {
  const F = family("wxkinds-hearing: rain is noise at the listener — the path stretched by the mixer's own bed (weather.ts hearMask / hearPath)");
  // one staged test: a calm staff man, a noise `d` metres from him along a clear line; did it reach him?
  const heard = async (kind: string | null, at: Vec3, ev: any): Promise<{ aw: number; fix: boolean; mask: number; W: any }> => {
    Math.random = seeded(11); const W = await born(kind); const g = W.game; g.aiEnabled = false; W.step(DT);
    const gd = g.guards[0]; gd.char.pos = [at[0], 0, at[2]]; gd.awareness = 0; gd.lastKnown = null; gd.state = 'patrol';
    for (const e of g.events) e.id ??= ++g.eventSeq; gd.heardUpTo = g.eventSeq;
    g.events.push({ time: g.time, loud: false, ...ev });
    hearingCheck(g, gd);
    return { aw: gd.awareness, fix: !!gd.lastKnown, mask: g.weather.hearMask([at[0], 1.5, at[2]]), W };
  };
  const OUT: Vec3 = [20, 0, 2], IN: Vec3 = [20, 0, 14];   // the lot north of the office; the cubicle floor
  const step = (at: Vec3, d: number) => ({ kind: 'step', pos: [at[0] + d, 0, at[2]] as Vec3, level: 0.8 });
  { const c = await heard('clear', OUT, step(OUT, 6)), r = await heard('rain', OUT, step(OUT, 6)), p = await heard('downpour', OUT, step(OUT, 6)), n = await heard(null, OUT, step(OUT, 6));
    F.verdict(c.aw > 0 && c.fix && p.aw === 0 && !p.fix && r.aw === 0 && n.aw === c.aw && c.mask === 1 && n.mask === 1 && p.mask > r.mask, 'a hard footfall 6 m off in the open: heard in clear weather (and with no kind picked, the same), drowned in rain and in a downpour', `awareness clear ${f2(c.aw)} · none ${f2(n.aw)} · rain ${f2(r.aw)} (path × ${f2(r.mask)}) · downpour ${f2(p.aw)} (× ${f2(p.mask)})`); }
  { const c = await heard('clear', IN, step(IN, 5)), p = await heard('downpour', IN, step(IN, 5)); const near = await heard('downpour', OUT, step(OUT, 2.5));
    F.verdict(c.aw > 0 && p.aw > 0 && p.aw < c.aw && p.mask > 1 && p.mask < 1.5 && near.aw > 0, 'under a roof the downpour is a third of the bed: the same footfall 5 m off indoors still reaches him, fainter; and outdoors one right beside him (2.5 m) still does', `indoors clear ${f2(c.aw)} · downpour ${f2(p.aw)} (path × ${f2(p.mask)}) · outdoors at 2.5 m in the downpour ${f2(near.aw)}`); }
  { const shot = (at: Vec3) => ({ kind: 'shot', pos: [at[0] + 25, 0, at[2]] as Vec3, level: 1, who: 1 });
    const p = await heard('downpour', OUT, shot(OUT));
    F.verdict(p.aw >= 0.92 && p.fix, 'a gunshot 25 m off is heard in a downpour as in anything (the weather buys the small noises, never a report)', `awareness ${f2(p.aw)}`); }
  { const a = await heard('downpour', OUT, step(OUT, 2.5)); const g = a.W.game, w = g.weather; const m0 = w.hearMask([20, 1.5, 2]);
    w.thunders.push({ at: g.time, distKm: 0.4, bearing: 0, loud: 1 }); a.W.step(DT); const m1 = w.hearMask([20, 1.5, 2]);
    for (let i = 0; i < (WX.WX_SIM.thunderSecs + 0.2) / DT; i++) a.W.step(DT); const m2 = w.hearMask([20, 1.5, 2]);
    const far = await born('downpour'); far.step(DT); far.game.weather.thunders.push({ at: far.game.time, distKm: 4, bearing: 0, loud: 0.27 }); far.step(DT); const mf = far.game.weather.hearMask([20, 1.5, 2]);
    const none = await born(null); none.step(DT); none.game.weather.thunders.push({ at: none.game.time, distKm: 0.4, bearing: 0, loud: 1 }); none.step(DT);
    F.verdict(m1 > m0 + 1 && Math.abs(m2 - m0) < 1e-9 && Math.abs(mf - m0) < 1e-9 && none.game.weather.hearMask([20, 1.5, 2]) === 1, `a near thunderclap drowns more for ${WX.WX_SIM.thunderSecs} s and then it is the rain alone; a far roll does not; with no kind picked thunder masks nothing`, `path × ${f2(m0)} → ${f2(m1)} under the clap → ${f2(m2)} after · far roll ${f2(mf)}`); }
  return F.done();
}

// ---------------------------------------------------------------- wxkinds-save
export async function wxSave() {
  const F = family('wxkinds-save: the kind rides in the checkpoint (WeatherSnap.kind)');
  const A = await born('fog', 'compound'); A.game.aiEnabled = false; for (let i = 0; i < 30; i++) A.step(DT);
  const B = await born(null, 'compound'); B.game.aiEnabled = false; for (let i = 0; i < 30; i++) B.step(DT);
  let sa: any, sb: any, err = '';
  try { sa = A.snapshot('fog', true); sb = B.snapshot('none', true); } catch (e) { err = String(e); }
  if (err) { F.verdict(false, 'both games save', err); return F.done(); }
  const state = (W: any) => { const w = W.game.weather; return JSON.stringify({ kind: w.kind, roofs: w.roofs, fog: w.fog, storm: w.storm, rain: w.rainRate, wind: w.wind, rec: W.game.wind.all.find((s: any) => s.why === 'storm').interior }); };
  const a0 = state(A), b0 = state(B);
  B.restore(sa); B.step(DT); const b1 = state(B);
  A.restore(sb); A.step(DT); const a1 = state(A);
  F.verdict(sa.weather?.kind === 'fog' && (sb.weather?.kind ?? null) === null && b1 === a0 && a1 === b0, "a fog run's file puts a plain game in fog (kind, roofs, fog, wind, the storm's record) and a plain file takes a fog game out of it", b1 === a0 && a1 === b0 ? `fog file → ${JSON.parse(b1).kind}, ${JSON.parse(b1).roofs.length} roofs · plain file → ${JSON.parse(a1).kind}, ${JSON.parse(a1).roofs.length} footprints` : `after fog file: ${b1.slice(0, 120)} · after plain file: ${a1.slice(0, 120)}`);
  { const old = JSON.parse(JSON.stringify(sa)); delete old.weather.kind; delete old.weather.thunderUntil; old.weather.storm = 0.7; old.weather.rainRate = 0.55; old.weather.wind = [1.1, 0.45];
    const C = await born('dust', 'compound'); C.game.aiEnabled = false; C.step(DT); C.restore(old); C.step(DT);
    F.verdict(C.game.weather.kind === null && JSON.stringify(C.game.weather.roofs) === JSON.stringify(JSON.parse(b0).roofs) && C.game.engine.weather.fog === 0, 'a file from before kinds (no field) loads as the level as it was, whatever the page was booted in', `kind ${C.game.weather.kind} · rain ${C.game.weather.rainRate} · fog word ${C.game.engine.weather.fog} · ${C.game.weather.roofs.length} roofs, the plain game's ${JSON.stringify(C.game.weather.roofs) === JSON.stringify([WX.INTERIOR, WX.ANNEX]) ? "(the office's two)" : '(the level\'s own: WX_OWN.roofs)'}`); }   // (the roofs of a game born on this level with no kind: the office's two rectangles on the frozen stand, the level's own under WX_OWN.roofs — the shipped stand)
  return F.done();
}

// ---------------------------------------------------------------- wxkinds-journal
export async function wxJournal() {
  const F = family("wxkinds-journal: a session recorded in a picked weather replays identically into a game born without it (the kind is in frame 0's checkpoint)");
  const { recordScripted } = await import('./journal-probes.ts'); const { replaySession } = await import('./replay.ts');
  const log = console.log; const rec = async (kind: string | null) => { K.WEATHER_BOOT.kind = kind; console.log = () => {}; try { return await recordScripted(6011, false, 45); } finally { K.WEATHER_BOOT.kind = null; console.log = log; } };
  const A = await rec('downpour'), B = await rec(null);
  const kindIn = A.file.save?.weather?.kind ?? null;
  console.log = () => {}; let R: any; try { R = await replaySession(JSON.parse(JSON.stringify(A.file)), 'downpour', { invariants: true, quiet: true }); } finally { console.log = log; }
  const same = JSON.stringify(A.file.digests.map((d: any) => d[1])) === JSON.stringify(B.file.digests.map((d: any) => d[1]));
  F.verdict(kindIn === 'downpour' && R.ok && R.lastDigestOk && R.digestsChecked > 0, "45 s recorded in a downpour: the file's frame 0 says so, and it replays identically into a fresh game born in the level's own weather", `frame 0 kind ${kindIn} · ${R.replayed}/${R.frames} frames replayed, ${R.digestsChecked} digests checked${R.ok ? '' : ' · ' + (R.bad || (R.digestMismatch ? `digest mismatch after frame ${R.digestMismatch.f}: ${R.digestMismatch.diffs.slice(0, 3).join(' · ')}` : R.sensor.first ? `sensor ${R.sensor.first.kind} '${R.sensor.first.key}'` : 'violations'))}`);
  F.verdict(!same, 'the same script with no kind picked digests differently (the weather was in the simulation the journal carries, not beside it)', same ? 'every digest equal: the downpour changed nothing the digest sees' : `first differing digest: #${A.file.digests.findIndex((d: any, i: number) => d[1] !== B.file.digests[i]?.[1])} of ${A.file.digests.length}`);
  return F.done();
}

// ---------------------------------------------------------------- wxkinds-url
export async function wxUrl() {
  const F = family('wxkinds-url: ?weather= and the links of the mission list (weatherKinds.ts)');
  { const f: string[] = [];
    for (const k of K.WEATHER_KINDS) { if (K.weatherOfSearch(`?squad4&weather=${k}&mute`) !== k) f.push(`${k} not read`); if (K.initWeather(new URLSearchParams(`weather=${k}`)) !== k || K.WEATHER_BOOT.kind !== k) f.push(`${k} not booted`); }
    const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
    try { if (K.initWeather(new URLSearchParams('weather=snow')) !== null || K.WEATHER_BOOT.kind !== null) f.push('an unknown name booted something'); } finally { console.warn = warn; }
    if (warned !== 1) f.push(`an unknown name warned ${warned} times`);
    if (K.initWeather(new URLSearchParams('mute')) !== null) f.push('no flag booted something');
    if (K.weatherSearch('', null) !== '' || K.weatherSearch('?a&&b', null) !== '?a&&b' || K.weatherSearch('', 'fog') !== '?weather=fog') f.push('an empty / odd search is rewritten');
    F.verdict(f.length === 0, 'every kind reads back from the URL and boots; an unknown name says so once and boots the level as it is; no flag = none', f.join('; ') || K.WEATHER_KINDS.join(' · ')); }
  { const f: string[] = []; const L = missionList(); const FLAGS = '?quality=high&mute';
    for (const m of L) { const base = missionHref(m, FLAGS), fog = K.weatherSearch(base, 'fog');
      if (K.weatherSearch(base, null) !== base) f.push(`${m.id}: taking nothing off changed the link`);
      if (K.weatherOfSearch(fog) !== 'fog' || !fog.startsWith(base)) f.push(`${m.id}: ${fog}`);
      if (K.weatherSearch(K.weatherSearch(fog, 'dust'), null) !== base) f.push(`${m.id}: fog → dust → none is not the link it was`);
      const kept = missionHref(m, FLAGS + '&weather=rain'); if (K.weatherOfSearch(kept) !== 'rain') f.push(`${m.id}: a visitor's ?weather= does not ride along (${kept})`); }
    F.verdict(f.length === 0, `all ${L.length} missions: the pick goes on the link after the mission's own flags, comes off to the character, and a visitor's ?weather= rides along through a pick`, f.join('; ') || `${missionHref(L[L.length - 1], FLAGS)} → ${K.weatherSearch(missionHref(L[L.length - 1], FLAGS), 'fog')}`); }
  // THE PAGE's weather is its URL's (initWeather locks it: the renderer's half is compiled at boot): another kind is refused, and so is a checkpoint made in one
  { const f: string[] = []; const warn = console.warn; console.warn = () => {};
    try {
      const A = await born('fog', 'compound'); const fogFile = A.snapshot('wx', true);
      const B = await born(null, 'compound'); const plainFile = B.snapshot('wx', true);
      K.WEATHER_BOOT.locked = true; K.WEATHER_BOOT.kind = null;
      if (B.game.weather.setKind('fog') !== false || B.game.weather.kind !== null) f.push('a locked page took another kind');
      if (!canLoad(B.game, fogFile)) f.push('a fog file loads into a page opened in the level\'s own weather'); if (canLoad(B.game, plainFile)) f.push(`its own file refused: ${canLoad(B.game, plainFile)}`);
      K.WEATHER_BOOT.kind = 'fog';
      if (canLoad(A.game, fogFile)) f.push(`a fog page refuses a fog file: ${canLoad(A.game, fogFile)}`); if (!canLoad(A.game, plainFile)) f.push('a plain file loads into a fog page');
      A.game.weather.setEnabled(false); if (!A.game.weather.enabled) f.push('a picked weather was switched off under the simulation');
    } finally { K.WEATHER_BOOT.locked = false; K.WEATHER_BOOT.kind = null; console.warn = warn; }
    F.verdict(f.length === 0, 'in the page (locked) the weather is the URL\'s: another kind is refused, a checkpoint made in other weather is refused with the reason, its own loads, and a picked weather cannot be switched off', f.join('; ') || 'setKind → false · canLoad → "made in other weather…"'); }
  K.WEATHER_BOOT.kind = null; K.WEATHER_BOOT.locked = false;
  // a headless tool hands its query to scenarioRun.ts startFromQuery: ?weather= is read there too, and a query without it leaves the game as it stands
  { const f: string[] = []; const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const log = console.log; console.log = () => {};
    try {
      const A = await born(null, 'compound'); const a = startFromQuery(A.game, 'roomclear&squad4&weather=fog');
      if (a.why) f.push(`refused: ${a.why}`); if (A.game.weather.kind !== 'fog' || A.game.weather.roofs.length !== 4 || !A.game.weather.fog) f.push(`fog not put in (${A.game.weather.kind})`);
      const B = await born('dust', 'compound'); startFromQuery(B.game, 'roomclear&squad4'); if (B.game.weather.kind !== 'dust') f.push('a query without the key took the weather off');
      const C = await born(null, 'compound'); startFromQuery(C.game, 'roomclear&squad4'); if (C.game.weather.kind !== null) f.push('a query without the key picked one');
    } finally { console.log = log; }
    F.verdict(f.length === 0, 'startFromQuery (the measuring tools\' path) puts ?weather= in on a headless game; a query without it changes nothing', f.join('; ') || 'roomclear&squad4&weather=fog → fog, four roofs'); }
  return F.done();
}
