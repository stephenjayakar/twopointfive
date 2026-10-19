// EACH GUN ITS OWN LOOK, SOUND AND FLAME (src/game/gunlook.ts GUNLOOK; `GUNLOOK_BREAK=1` must fail). How each is FED is gunreload-check.ts's.
//   own     every row a pick of the two gun slots can hand out (gunslots.ts PICKS; + the big slot's pump gun) names, with the switch on, a MODEL, a VOICE, a
//           FLAME and a CASING row — and no two guns share a model, a voice or a flame: by name, and by what is in them (two models' part lists, two
//           voices' samples, two flames' numbers are never the same); the cases two guns may share a COLOUR and a calibre of are said in SAME_CASE below;
//           a model's muzzle is its own far face, its magazine is one of its parts, its support hand is on it
//   hands   a teammate staged with every pick and you with every pick: the figure is told which model is in his hands and which hangs or rides holstered,
//           his muzzle and his support hand are that model's, what is drawn for him is that gun's own boxes (no two guns draw the same), and a round fired
//           plays that gun's voice; with the switch off the same man is drawn and heard as the build before had him
//   off     the switch off, or on with nobody carrying one of the guns, is the same run by digest; the two stands' row, the registry, the page's flag, a
//           recording from before it
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch, the gun slots and the big slot itself. Nothing here looks at a picture or
// hears a sound (tools/qa/gunlook-sheet.ts and gunlook-plates.ts draw the pictures; the listening page plays the voices).
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';
import { sfxContext } from '../../src/audio/backend';

const GL = await import(`${ROOT}/src/game/gunlook.ts`);
const { GUNLOOK, LONG_MODELS, PISTOL_MODELS, MODEL_POINTS } = GL;
const { GUNSLOTS, gunPicks, pickRow } = await import(`${ROOT}/src/game/gunslots.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const fx = await import(`${ROOT}/src/game/effects.ts`);
const { casingOf } = await import(`${ROOT}/src/game/particleFx.ts`);
const { buildOne, HEARD } = await import(`${ROOT}/src/audio/sfx.ts`);
const { fireWeapon, handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { modelGrip, modelMuzzleAhead, sc20kMuzzleAhead, RIG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const J = (o: unknown) => JSON.stringify(o), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
/** the switch as the page has it, with the two gun rows and the big slot they ride on (the frozen stand pins all three off as it stands a game up: raised
 *  after) — and every card as the table writes it */
const raise = (on = true) => { GUNLOOK.on = on; GUNSLOTS.on = true; K.BIGSLOT.on = true; K.KITDEAL.on = false; };
async function kept<T>(fn: () => Promise<T>): Promise<T> {
  const was = { ...GUNLOOK }, slots = { ...GUNSLOTS }, big = K.BIGSLOT.on, deal = K.KITDEAL.on, kit = K.KIT.on, cards = JSON.stringify(K.KIT.members);
  try { return await fn(); } finally { Object.assign(GUNLOOK, was); Object.assign(GUNSLOTS, slots); K.BIGSLOT.on = big; K.KITDEAL.on = deal; K.KIT.on = kit; K.KIT.members.splice(0, K.KIT.members.length, ...JSON.parse(cards)); }
}
/** THE ISSUE PAIR: the two picks every card is dealt, drawn and heard as the build has always had them (the carbine's and the pistol's own groups in
 *  rigProps.ts, their own voices and flames) — they name nothing of their `own` and are the two things every other gun is told apart FROM */
const ISSUE = ['mk18', 'g19'];
/** TWO GUNS, ONE KIND OF EMPTY — said why: the same cartridge leaves the same brass. Every other pair's casing rows differ in what they hold. */
const SAME_CASE: [string, string, string][] = [
  ['fn2000', 'mk18bare', 'the same gun with its suppressor off'],
  ['fiveseven', 'g19bare', 'the same gun with its suppressor off'],
  ['g18', 'guard9mm', 'both 9 mm: the same case out of the same slide'],
];
/** the rows the two slots can hand out, by pick: [pick, row] — the row with his can on where the pick has one, and the bare row where that is another */
function pickRows(): [string, any][] {
  const out: [string, any][] = [];
  for (const slot of ['primary', 'secondary'] as const) for (const id of gunPicks(slot)) { if (id === 'none') continue;
    for (const can of [true, false]) { const w = pickRow(id, can); if (w && !out.some(([, d]) => d.id === w)) out.push([id, (WEAPONS as any)[w]]); } }
  return out;
}
const partsOf = (m: string): unknown => LONG_MODELS[m]?.parts.map((p: any) => [p.s.l0, p.s.l1, p.s.thick, p.s.tall, p.s.adj ?? 0, p.col]) ?? (PISTOL_MODELS[m] ? [PISTOL_MODELS[m].slide, PISTOL_MODELS[m].grip, PISTOL_MODELS[m].can, PISTOL_MODELS[m].mag, PISTOL_MODELS[m].frame] : null);
const pairs = <T,>(xs: T[]): [T, T][] => xs.flatMap((a, i) => xs.slice(i + 1).map(b => [a, b] as [T, T]));

// ───────────────────────────────────────────────────────────── own
export async function gunlookOwn(): Promise<boolean> {
  const F = family('gunlook-own: every gun a slot hands out has a model, a voice, a flame and a casing row of its own');
  await kept(async () => {
    raise(true); K.KIT.on = true;
    const rows = pickRows(), mine = rows.filter(([id]) => !ISSUE.includes(id)), shot = (WEAPONS as any).m870;
    F.verdict(mine.length >= 6, 'the two rows hand out six guns beside the issue pair', rows.map(([id, d]) => `${id}→${d.id}`).join(' · '));
    // each names all four, and each name is a real thing
    const ctx = sfxContext(48000), bad: string[] = [], said: string[] = [];
    const own = [...mine.map(([, d]) => d), shot].map((d: any) => ({ d, o: GL.gunOwn(d), voice: GL.voiceOf(d), flame: GL.flameOf(d), cas: casingOf(d) }));
    for (const { d, o, voice, flame, cas } of own) {
      const model = o?.model, has = !!model && (!!LONG_MODELS[model] || !!PISTOL_MODELS[model]) && !!MODEL_POINTS[model], buf = buildOne(ctx, voice), lvl = (HEARD as any)[voice];
      const ok = has && !!buf && buf.getChannelData(0).length > 0 && typeof lvl === 'number' && !!(fx.muzzleFx as any)[flame] && (!!cas || d.id === 'm870');
      (ok ? said : bad).push(`${d.id}: model ${model ?? '—'} · voice ${voice}${buf ? '' : ' (NO SUCH VOICE)'} · flame ${flame} · case ${cas ? `${(cas.diameter * 1000).toFixed(1)} mm` : d.id === 'm870' ? 'none (a pump gun keeps its hull until it is worked)' : 'NONE'}`);
    }
    F.verdict(!bad.length, 'each row names a model that is laid out, a voice the sound table builds and levels, a flame row and a casing row', [...bad.map(b => 'WRONG ' + b), ...said].join('\n    '));
    // no two share: by name …
    const all = [...own.map(x => ({ id: x.d.id as string, model: x.o?.model as string | undefined, voice: x.voice as string, flame: x.flame as string })),
      ...ISSUE.flatMap(id => [true, false].map(can => pickRow(id, can)).filter((w, i, a) => w && a.indexOf(w) === i).map(w => { const d = (WEAPONS as any)[w!]; return { id: d.id as string, model: `(${d.rig})`, voice: GL.voiceOf(d) as string, flame: GL.flameOf(d) as string }; }))];
    const picks = all.filter(a => a.id !== 'm870');   // (the big slot's pump gun keeps the bare short rifle's flame: a tool on a lock, not a pick — it has its own model and voice all the same)
    const shareM = pairs(all).filter(([a, b]) => a.model === b.model && !(ISSUE.some(i => pickRow(i, true) === a.id || pickRow(i, false) === a.id) && ISSUE.some(i => pickRow(i, true) === b.id || pickRow(i, false) === b.id))), shareV = pairs(all).filter(([a, b]) => a.voice === b.voice), shareF = pairs(picks).filter(([a, b]) => a.flame === b.flame);
    F.verdict(!shareM.length && !shareV.length && !shareF.length, 'no two guns are the same model, speak with the same voice or show the same flame (the issue pistol with and without its can is one pistol)',
      shareM.length + shareV.length + shareF.length ? [...shareM.map(([a, b]) => `${a.id} and ${b.id} are both drawn as ${a.model}`), ...shareV.map(([a, b]) => `${a.id} and ${b.id} both speak as ${a.voice}`), ...shareF.map(([a, b]) => `${a.id} and ${b.id} both flash as ${a.flame}`)].join('\n    ') : `${all.length} rows · models ${[...new Set(all.map(a => a.model))].join(' ')} · voices ${all.map(a => a.voice).join(' ')}`);
    // … and by what is in them
    const ms = [...new Set(own.map(x => x.o?.model).filter(Boolean))] as string[], sameParts = pairs(ms).filter(([a, b]) => J(partsOf(a)) === J(partsOf(b)));
    const bufs = own.map(x => ({ v: x.voice, s: buildOne(ctx, x.voice)?.getChannelData(0) })).filter(x => x.s), near = pairs(bufs).filter(([a, b]) => { const n = Math.min(a.s!.length, b.s!.length, 4800); let d = 0, e = 0; for (let i = 0; i < n; i++) { d += (a.s![i] - b.s![i]) ** 2; e += a.s![i] ** 2; } return d < 0.01 * e; });
    const issueV = ISSUE.flatMap(id => [true, false].map(can => pickRow(id, can)).filter(Boolean)).map(w => (WEAPONS as any)[w!].report.voice as string), copy = bufs.filter(b => issueV.some(v => { const o = buildOne(ctx, v)?.getChannelData(0); if (!o) return false; const n = Math.min(o.length, b.s!.length, 4800); let d = 0, e = 0; for (let i = 0; i < n; i++) { d += (o[i] - b.s![i]) ** 2; e += o[i] ** 2; } return d < 0.01 * e; }));
    const flames = own.filter(x => x.d.id !== 'm870').map(x => ({ f: x.flame, r: J((fx.muzzleFx as any)[x.flame]) })), sameFlame = pairs(flames).filter(([a, b]) => a.r === b.r);
    F.verdict(!sameParts.length && !near.length && !copy.length && !sameFlame.length, 'two models never have the same parts, two voices never the same first tenth of a second (nor an issue gun\'s), two flames never the same numbers',
      [...sameParts.map(([a, b]) => `${a} = ${b} part for part`), ...near.map(([a, b]) => `${a.v} ≈ ${b.v}`), ...copy.map(c => `${c.v} is an issue gun's report under another name`), ...sameFlame.map(([a, b]) => `${a.f} = ${b.f}`)].join(' · ') || `${ms.length} models, ${bufs.length} voices, ${flames.length} flames, every pair apart`);
    const cases = [...own.filter(x => x.cas).map(x => ({ id: x.d.id as string, r: J(x.cas) })), ...ISSUE.flatMap(id => [true, false].map(can => pickRow(id, can)).filter((w, i, a) => w && a.indexOf(w) === i)).map(w => ({ id: w as string, r: J(casingOf((WEAPONS as any)[w!])) }))];
    const sameCase = pairs(cases).filter(([a, b]) => a.r === b.r && !SAME_CASE.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id)));
    F.verdict(!sameCase.length, 'two guns throw the same empty the same way only where this file says why', sameCase.length ? sameCase.map(([a, b]) => `${a.id} = ${b.id}`).join(' · ') : `${cases.length} casing rows; said: ${SAME_CASE.map(s => `${s[0]} = ${s[1]} (${s[2]})`).join('; ')}`);
    // a model holds together: its muzzle is its far face on the bore, a magazine is one of its parts, the support hand is under or on it, its feed point is on it
    const loose: string[] = [], held: string[] = [];
    for (const m of Object.keys(LONG_MODELS)) { const L = LONG_MODELS[m], bore = L.parts.filter((p: any) => Math.abs(p.s.adj?.off?.[1] ?? 0) < 0.012 && !(p.s.adj?.rot?.[0])), far = Math.max(...bore.map((p: any) => p.s.l1 + (p.s.adj?.off?.[2] ?? 0)));
      const z0 = Math.min(...L.parts.map((p: any) => p.s.l0)), mag = L.parts.some((p: any) => p.is === 'mag') || m === 'm1014' || m === 'm870', w = L.gripL.off, W = MODEL_POINTS[m].well;
      const ok = Math.abs(far - L.ahead) < 1e-6 && mag && w[2] > 0 && w[2] < L.ahead && Math.abs(w[1]) < 0.12 && W[2] > z0 && W[2] < L.ahead && L.ahead - z0 > 0.4 && L.ahead - z0 < 1.05;
      (ok ? held : loose).push(`${m}: ${f2(L.ahead - z0)} m end to end, muzzle ${f2(L.ahead)} (far face ${f2(far)}), hand at ${f2(w[2])}, fed at ${f2(W[2])}, ${L.parts.length} parts${mag ? '' : ', NO MAGAZINE'}`); }
    // (a model is drawn in the issue carbine's group in your hands and in the short rifle's in a defender's or a teammate's: its hand, its muzzle and
    //  gunreload.ts's stations are worked out from ONE origin — so the two groups' origins must stay the same point, and this goes red the day one is tuned alone)
    const adjS = RIG.sc20k.adj?.off, adjC = RIG.carbine.adj?.off, grp = /const GROUP: Vec3 = \[([^\]]+)\]/.exec(await Bun.file(`${ROOT}/src/game/gunreload.ts`).text())?.[1].split(',').map(Number);
    F.verdict(!!adjS && J(adjS) === J(adjC) && J(grp) === J(adjS), 'the two long-gun groups a model is laid out in have one origin, and the reload stations are worked out from the same one', `sc20k ${J(adjS)} · carbine ${J(adjC)} · gunreload.ts GROUP ${J(grp)}`);
    const lens = pairs(Object.keys(LONG_MODELS).filter(m => m !== 'm870')).filter(([a, b]) => Math.abs(LONG_MODELS[a].ahead - LONG_MODELS[b].ahead) < 0.03);
    F.verdict(!loose.length && !lens.length, 'every long model: its muzzle is its own far face, a magazine (or a tube) is part of it, the support hand and the feed are on it — and no two picks are a length',
      [...loose.map(l => 'WRONG ' + l), ...lens.map(([a, b]) => `${a} and ${b} end within 3 cm`), ...held].join('\n    '));
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── hands
/** what is drawn for one character this frame: his boxes' sizes, in order (where they are moves with him; what they ARE is the gun) */
function drawn(g: any, c: any): string { const out: any[] = []; handProps(g, out); return J(out.filter(b => b.owner === (c.id & 0xff)).map(b => b.h.map((x: number) => +x.toFixed(4)))); }
export async function gunlookHands(): Promise<boolean> {
  const F = family('gunlook-hands: a man with each gun is told, drawn and heard as that gun');
  await kept(async () => {
    K.KIT.on = true;
    const stage = async (on: boolean) => {
      const R: any = await hushed(() => rig(17, { stage: false })); raise(on); const g = R.game, at = g.player.char.pos;
      const op: any = spawnUnit(g, { team: 'operative', pos: [at[0] + 1.5, 0, at[2] + 1], yaw: 0, name: 'Op0', light: false });
      const longs = gunPicks('primary').filter((p: string) => p !== 'none'), sides = gunPicks('secondary'), seen: Record<string, any> = {};
      const look = (id: string, side: string, primary: boolean) => {
        K.KIT.members[1] = K.kitDefault(1); K.kitSet(1, 'primary', primary ? id : 'none'); K.kitSet(1, 'secondary', side); K.kitStage(g, [op]);
        for (let i = 0; i < 20; i++) R.step();
        const log: any[] = []; R.W.audioLog = log; const o = op.char.pos; fireWeapon(g, op.char, [o[0], 1.2, o[2] - 10], false, { weapon: op.weapon.def }); R.W.audioLog = null;
        const m = op.char.gunLook?.hand ?? null;
        seen[primary ? id : side] = { row: op.weapon.def.id, look: op.char.gunLook ? { ...op.char.gunLook } : null, ahead: op.char.muzzleAhead, grip: J(op.char.anim.longGrip), wantAhead: m ? modelMuzzleAhead(m) : null, wantGrip: m ? J(modelGrip(m)) : null, boxes: drawn(g, op.char), voice: log.find(c => c.name !== 'footstep' && /Report|Suppressed|rifle|pistol|shot|ak|carbine/i.test(c.name))?.name ?? log[0]?.name ?? '—' };
      };
      for (const id of longs) look(id, sides[longs.indexOf(id) % sides.length], true);
      for (const side of sides) look('none', side, false);
      // … and you, with each long gun in your hands
      const you: Record<string, any> = {};
      for (const id of longs) { K.KIT.members[0] = K.kitDefault(0); K.kitSet(0, 'primary', id); K.kitPlayer(g); const pl = g.player; pl.slot = 'rifle'; pl.holstered = false; for (let i = 0; i < 40; i++) R.step(); const m = pl.char.gunLook?.hand ?? null; you[id] = { hand: m, ahead: pl.char.muzzleAhead, want: m ? modelMuzzleAhead(m) : null, up: pl.rifleUp, inHands: pl.hasRifle && pl.rifle.def.id }; }
      K.KIT.members[0] = K.kitDefault(0); K.KIT.members[1] = K.kitDefault(1); K.kitPlayer(g);
      return { seen, you, longs, sides };
    };
    const On = await stage(true), Off = await stage(false);
    const ids = [...On.longs, ...On.sides], own = ids.filter(id => !ISSUE.includes(id));
    // told
    const told = own.filter(id => { const s = On.seen[id], d = (WEAPONS as any)[s.row]; return s.look?.hand === d.own?.model && !!d.own?.model; }), other = On.longs.filter((id: string) => On.seen[id].look?.side !== undefined && (On.seen[id].look.side !== null || ISSUE.includes(On.sides[On.longs.indexOf(id) % On.sides.length])));
    F.verdict(told.length === own.length && other.length === On.longs.length && ISSUE.every(id => On.seen[id].look && On.seen[id].look.hand === null), 'on: the figure of a teammate with each gun is told the model in his hands (none for the issue pair), and the sidearm behind a long gun rides holstered as its own model',
      ids.map(id => `${id}: in hands ${On.seen[id].look?.hand ?? '—'}${On.seen[id].look?.side ? `, holstered ${On.seen[id].look.side}` : ''}`).join(' · '));
    // muzzle and support hand
    const longOwn = On.longs.filter((id: string) => !ISSUE.includes(id)), mz = longOwn.map((id: string) => { const s = On.seen[id]; return { id, got: s.ahead, want: s.wantAhead, grip: !!s.wantGrip && s.grip === s.wantGrip, was: Off.seen[id].ahead }; });
    F.verdict(mz.every((x: any) => x.want !== null && Math.abs(x.got - x.want) < 1e-9 && x.grip) && new Set(mz.map((x: any) => x.got.toFixed(3))).size === mz.length, 'on: his muzzle is that model\'s far face and his support hand is where that model takes one; off, both are the stand-in\'s',
      mz.map((x: any) => `${x.id}: muzzle ${f2(x.got)} m ahead of the wrist (off ${f2(x.was)})${x.grip ? '' : ' HAND NOT ON THE MODEL'}`).join(' · ') + ` · the issue carbine's: ${f2(sc20kMuzzleAhead())}`);
    const youOk = longOwn.every((id: string) => { const y = On.you[id], m = (WEAPONS as any)[y.inHands]?.own?.model; return !!m && y.up && y.hand === m && y.want !== null && Math.abs(y.ahead - y.want) < 1e-9; }) && On.longs.every((id: string) => Off.you[id].hand === null && Math.abs(Off.you[id].ahead - sc20kMuzzleAhead()) < 1e-9);
    F.verdict(youOk, 'the same on you: each long gun in your hands is told to your figure and its muzzle is the model\'s; off, every one is the issue carbine\'s length', On.longs.map((id: string) => `${id}: ${On.you[id].hand ?? 'issue'} ${f2(On.you[id].ahead)} (off ${f2(Off.you[id].ahead)})`).join(' · '));
    // drawn
    const same = pairs(ids).filter(([a, b]) => On.seen[a].boxes === On.seen[b].boxes), unchanged = own.filter(id => On.seen[id].boxes === Off.seen[id].boxes), issueMoved = ISSUE.filter(id => On.seen[id].boxes !== Off.seen[id].boxes);
    const offSame = pairs(On.longs as string[]).filter(([a, b]) => Off.seen[a].boxes === Off.seen[b].boxes).length;
    F.verdict(!same.length && !unchanged.length && !issueMoved.length, 'on: no two guns are drawn as the same boxes, every gun of the six is drawn differently from its stand-in, and the issue pair is drawn as it was',
      [...same.map(([a, b]) => `${a} is drawn as ${b}`), ...unchanged.map(id => `${id} is still its stand-in`), ...issueMoved.map(id => `the issue ${id} changed`)].join(' · ') || `${ids.length} guns, ${ids.length} sets of boxes (off: ${offSame} pairs of long guns are drawn alike)`);
    // heard
    const voices = ids.map(id => ({ id, on: On.seen[id].voice, off: Off.seen[id].voice, want: (WEAPONS as any)[On.seen[id].row] })), wrong = voices.filter(v => { const d = v.want; return v.on !== (d.own?.voice ?? d.report.voice) || v.off !== d.report.voice; });
    F.verdict(!wrong.length && new Set(voices.map(v => v.on)).size === voices.length, 'on: a round from each plays that gun\'s own voice, no two the same; off, its stand-in\'s', voices.map(v => `${v.id}: ${v.on}${v.on !== v.off ? ` (off ${v.off})` : ''}`).join(' · '));
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function gunlookOff(): Promise<boolean> {
  const F = family('gunlook-off: the switch off, or on and nobody carrying one of the guns, is the same run');
  await kept(async () => {
    const run = async (on: boolean) => {
      const R: any = await hushed(() => rig(17, { stage: false })); raise(on); const g = R.game; R.RC.start(17); const hashes: string[] = [];
      for (let i = 0; i < 600; i++) { R.step(); if (i % 150 === 149) hashes.push(hashDigest(digestGame(g, true))); }
      return { hashes, told: g.guards.filter((gd: any) => gd.char.gunLook).length + (g.player.char.gunLook ? 1 : 0), own: g.guards.filter((gd: any) => gd.char.gunLook?.hand).length };
    };
    const off = await run(false), on = await run(true);
    F.verdict(J(off.hashes) === J(on.hashes) && off.told === 0 && on.told > 0 && on.own === 0, 'ten seconds of the staged room clear on the cards as issued: off, no figure is told a model; on, every figure is asked and none carries one of the guns — the run digests the same',
      `off: ${off.hashes.join(' ')} (${off.told} figures told)\n    on:  ${on.hashes.join(' ')} (${on.told} figures told, ${on.own} with a model in hand)`);
    const reg = knobRegistry(), page = /GUNLOOK\.on = !q\.has\('nogunlook'\)/.test(await Bun.file(`${ROOT}/src/host/profile.ts`).text());
    F.verdict('GUNLOOK.on' in FROZEN_HOLDS && reg.GUNLOOK === GUNLOOK && page, 'the switch is one of the two stands\' rows, in the knob registry, and the page writes it on unless ?nogunlook', `frozen hold: ${FROZEN_HOLDS['GUNLOOK.on']} · registered ${reg.GUNLOOK === GUNLOOK} · the page writes it: ${page}`);
    const R: any = await hushed(() => rig(17, { stage: false })); GUNLOOK.on = true; const snap = knobsSnapshot(R.game); const has = !!snap.tables.GUNLOOK; delete snap.tables.GUNLOOK; applyKnobs(R.game, snap);
    F.verdict(has && GUNLOOK.on === false, 'a recording carries the table, and one from before it replays with the switch off', `carried ${has} · after a file without it: on = ${GUNLOOK.on}`);
  });
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2); const all: [string, () => Promise<boolean>][] = [['own', gunlookOwn], ['hands', gunlookHands], ['off', gunlookOff]];
  const bad = want.filter(w => !all.some(([n]) => n === w)); if (bad.length) { console.error(`unknown: ${bad.join(' ')} (own hands off)`); process.exit(2); }
  let ok = true; for (const [n, fn] of all) if (!want.length || want.includes(n)) { try { ok = (await fn()) && ok; } catch (e) { ok = false; console.log(`- FAIL — gunlook-${n} threw\n    ${(e as Error).stack ?? (e as Error).message}`); } }
  console.log(`\n=== gunlook-check: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1);
}
