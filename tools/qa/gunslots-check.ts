// A PRIMARY AND A SECONDARY FOR EVERY MAN (src/game/gunslots.ts GUNSLOTS; `GUNSLOTS_BREAK=1` must fail)
//   card    the card's one gun row is two rows — Primary and Secondary — on every member's card; `weapon` follows the primary; a card stored before the
//           slots reads into them; with the switch off the rows are the build before's, word for word
//   mate    a staged teammate carries both: the gun not in his hands is his card's other slot; dry on a man close in front of him the sidearm comes out
//           in less time than the reload, the long gun hangs on its sling; with nobody in front of him it goes back and the primary comes up full
//           (no checkpoint slice: a floor with a spawned unit on it — every teammate is one — takes no checkpoint, savestate.ts canSave)
//   fight   two teammates with a round each and three men five metres in front of them: the third is shot with a sidearm well inside the reload
//   off     the switch off = the run of the build before, by digest; the two stands' row, the registry, the page's flag, a recording from before it
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself. Nothing here looks at a picture.
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';

const { GUNSLOTS, GUNSLOTS_STATS, sideOut, sideLocked, sideHung, gunPicks } = await import(`${ROOT}/src/game/gunslots.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
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
const BREAK = process.env.GUNSLOTS_BREAK === '1';
/** the switch as the page has it, with the big slot it rides on (the frozen stand pins both off as it stands a game up: raised after) — and every card as
 *  the table writes it (kit.ts KITDEAL off: what a team of three or four is dealt is kitdeal-check.ts's to hold) */
const raise = (on = true) => { GUNSLOTS.on = on; K.BIGSLOT.on = true; K.KITDEAL.on = false; };
/** every table and card put back as found */
async function kept<T>(fn: () => Promise<T>): Promise<T> {
  const was = { ...GUNSLOTS }, big = K.BIGSLOT.on, deal = K.KITDEAL.on, kit = K.KIT.on, cards = JSON.stringify(K.KIT.members);
  try { return await fn(); } finally { Object.assign(GUNSLOTS, was); K.BIGSLOT.on = big; K.KITDEAL.on = deal; K.KIT.on = kit; K.KIT.members.splice(0, K.KIT.members.length, ...JSON.parse(cards)); }
}
const fields = (i: number) => K.kitRows(i).map((r: any) => r.field);
const row = (i: number, f: string) => K.kitRows(i).find((r: any) => r.field === f);

// ───────────────────────────────────────────────────────────── card
export async function gunslotsCard(): Promise<boolean> {
  const F = family('gunslots-card: two gun rows where the one stood, on every card');
  await kept(async () => {
    raise(false); const was = [0, 1, 2, 3, 4].map(i => K.kitRows(i).map((r: any) => `${r.field}:${r.label}:${J(r.values)}`));
    raise(true); const now = [0, 1, 2, 3, 4].map(fields);
    const two = now.every((f, i) => !f.includes('weapon') && f.indexOf('secondary') === f.indexOf('primary') + 1 && f.indexOf('primary') === was[i].findIndex((r: string) => r.startsWith('weapon:')));
    const rest = now.every((f, i) => J(K.kitRows(i).filter((r: any) => r.field !== 'primary' && r.field !== 'secondary').map((r: any) => `${r.field}:${r.label}:${J(r.values)}`)) === J(was[i].filter((r: string) => !r.startsWith('weapon:'))));
    F.verdict(two && rest, 'with the switch on every member\'s card has a Primary row and a Secondary row where its gun row stood, and every other row is as it was', `you: ${now[0].join(' ')}\n    a teammate: ${now[1].join(' ')}`);
    const P = row(1, 'primary'), S = row(1, 'secondary');
    F.verdict(!!P && !!S && P.label === 'Primary' && S.label === 'Secondary' && P.values.includes('none') && !S.values.includes('none') && J(P.values) === J(gunPicks('primary')) && P.values.every((v: string) => P.word(v).length > 0) && S.values.every((v: string) => S.word(v).length > 0), 'the primary may be left at home, the secondary may not; each row offers the table\'s picks under their own names', `primary: ${P?.values.map((v: string) => P.word(v)).join(' / ')} · secondary: ${S?.values.map((v: string) => S.word(v)).join(' / ')}`);
    // the legacy field follows, the gun in his hands is the slot's row, and a card from before the slots reads into them
    const m = K.kitDefault(1); const g0 = K.kitGun(m), s0 = K.kitSide(m); P.set(m, 'none'); const g1 = K.kitGun(m), s1 = K.kitSide(m), w1 = m.weapon; P.set(m, 'mk18'); const w2 = m.weapon;
    F.verdict(WEAPONS[g0].cls !== 'pistol' && !!s0 && WEAPONS[s0].cls === 'pistol' && WEAPONS[g1].cls === 'pistol' && s1 === null && w1 === 'pistol' && w2 === 'rifle', 'as issued his hands hold the primary and the sidearm is his second gun; no primary: the sidearm is his gun, nothing behind it, and the old gun field reads pistol', `issued: ${g0} + ${s0} · none: ${g1} + ${s1} (weapon ${w1}) · back: weapon ${w2}`);
    const old = K.kitSanitize(2, { weapon: 'pistol', suppressed: false }), both = K.kitSanitize(2, { weapon: 'rifle', suppressed: true, primary: 'mk18', secondary: 'g19' }), junk = K.kitSanitize(2, { primary: 'bazooka', secondary: 7 });
    const kept2 = K.kitSanitize(2, { weapon: 'pistol', suppressed: true, primary: 'mk18', secondary: 'g19' });   // (a card saved with the slots, its gun row then changed with them off)
    F.verdict(K.rowGet(P, old) === 'none' && old.weapon === 'pistol' && K.kitGun(old) === 'guard9mm' && WEAPONS[K.kitGun(kept2)].cls === 'pistol' && K.kitSide(kept2) === null && both.primary === 'mk18' && both.secondary === 'g19' && junk.primary === 'mk18' && junk.secondary === 'g19', 'a stored card from before the slots is its gun row in their words; a pick the table does not have is the issued one', `old pistol card → primary ${K.rowGet(P, old)}, in his hands ${K.kitGun(old)} · a pistol card that still names a long gun → ${K.kitGun(kept2)} · junk → ${junk.primary} + ${junk.secondary}`);
    { K.KIT.members[1] = K.kitDefault(1); K.KIT.members[2] = K.kitDefault(2); P.set(K.KIT.members[1], 'none'); const r = K.kitPaste(2, K.KIT.members[1]), got = K.KIT.members[2];
      F.verdict(r.ok && r.changed.includes('primary') && K.rowGet(P, got) === 'none' && got.weapon === 'pistol' && K.kitWears(2, K.KIT.members[1]), 'a copied card pasted onto another man carries its two guns across (and the old gun field with the primary)', `changed ${r.changed.join(' ')} · he now has primary ${K.rowGet(P, got)}, weapon ${got.weapon}`); }
    // every hand that still writes the one gun field is right: a set, a mission's issue card (a bare field write), a tool that names the old row
    { K.KIT.members[1] = K.kitDefault(1); K.KIT.members[3] = K.kitDefault(3); const q = K.kitPreset(1, 'quiet'), quiet = K.KIT.members[1], qg = K.kitGun(quiet), qs = K.kitSide(quiet);
      const iss = Object.assign(K.kitDefault(2), { weapon: 'pistol' }), ig = K.kitGun(iss);
      const set = K.kitSet(3, 'weapon', 'pistol'), sg = K.kitGun(K.KIT.members[3]), back = K.kitSet(3, 'weapon', 'rifle'), bg = K.kitGun(K.KIT.members[3]);
      F.verdict(q.ok && WEAPONS[qg].cls === 'pistol' && qs === null && K.rowGet(P, quiet) === 'none' && WEAPONS[ig].cls === 'pistol' && K.kitSide(iss) === null && set && WEAPONS[sg].cls === 'pistol' && back && WEAPONS[bg].cls !== 'pistol',
        'the Quiet set still hands a teammate his pistol alone; a card whose gun field alone is written (an issue card) is a pistol man; a tool that sets the old gun row is taken', `quiet set: ${qg} + ${qs} (tile ${K.rowGet(P, quiet)}) · gun field pistol: ${ig} · the old row set: ${set} → ${sg}, back ${back} → ${bg}`); }
    // the tile says the gun he is handed, and its note is that gun's
    { const can = K.kitDefault(1), bare = K.kitDefault(1); can.suppressed = true; bare.suppressed = false; const named = (m: any) => [P.word(m.primary, m), S.word(m.secondary, m)];
      const differ = K.kitGun(can) !== K.kitGun(bare) && WEAPONS[K.kitGun(can)].short !== WEAPONS[K.kitGun(bare)].short;
      F.verdict(!differ || named(can)[0] !== named(bare)[0], 'with the suppressor off the Primary tile names the gun he is then handed, not the suppressed one', `suppressed: ${named(can).join(' + ')} (${K.kitGun(can)}) · bare: ${named(bare).join(' + ')} (${K.kitGun(bare)})`); }
    raise(false); const off = [0, 1, 2, 3, 4].map(i => K.kitRows(i).map((r: any) => `${r.field}:${r.label}:${J(r.values)}`)); const m2 = K.kitDefault(1);
    F.verdict(J(off) === J(was) && K.kitSide(m2) === null && K.kitSecond(m2) === null, 'switched off again the rows are the build before\'s and a card has no second gun', `a teammate: ${fields(1).join(' ')}`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── mate
export async function gunslotsMate(): Promise<boolean> {
  const F = family('gunslots-mate: a teammate carries both guns and goes to his sidearm when the primary runs dry');
  await kept(async () => {
    const R: any = await hushed(() => rig(17, { stage: false })); raise(!BREAK); const g = R.game; K.KIT.on = true;
    // four teammates in the lot's open ground, the cards as issued, staged as a scenario stages them
    const at = g.player.char.pos, ops = [0, 1, 2, 3].map(k => spawnUnit(g, { team: 'operative', pos: [at[0] + 1 + k, 0, at[2] + 1], yaw: 0, name: `Op${k}`, light: false }));
    K.kitStage(g, ops);
    const second = ops.map((gd: any) => gd.second), prim = ops.map((gd: any) => gd.weapon.def.id);
    F.verdict(second.every((s: any, k: number) => s && !s.out && WEAPONS[s.id].cls === 'pistol' && WEAPONS[prim[k]].cls !== 'pistol'), 'each of the four is staged with his primary in his hands and his card\'s sidearm as his second gun', ops.map((gd: any, k: number) => `${gd.callsign ?? k}: ${prim[k]} + ${second[k]?.id ?? 'NONE'}`).join(' · '));
    const gd: any = ops[0], S = gd.second; if (!S) { F.verdict(false, 'the man has a second gun to go to', 'none staged'); return; }
    // dry: far, then near
    const primary = gd.weapon; primary.chamber = 0; primary.mag = 0; const t0 = g.time;
    const far = sideOut(g, gd, GUNSLOTS.near + 2), near = sideOut(g, gd, 4), again = sideOut(g, gd, 4);
    const inHand = gd.weapon.def.id, lock = sideLocked(g, gd), hung = sideHung(gd), route = gd.route.weapon;
    F.verdict(!far && near && !again && WEAPONS[inHand].cls === 'pistol' && route === inHand && lock && (hung === 'sc20k' || hung === 'carbine') && GUNSLOTS.out < primary.def.reload.dur, `dry with his man past ${GUNSLOTS.near} m he reloads; inside it the sidearm is in his hands (his route says so: the row is dealt off it), the long gun hangs on its sling, and his hands are busy ${f2(GUNSLOTS.out)} s where the reload is ${f2(primary.def.reload.dur)} s`, `far ${far} · near ${near} · again ${again} · in hand ${inHand} · hung ${hung} · locked ${lock}`);
    // the frames run: the row survives the game's own deal, the lock ends, a round goes from the sidearm
    let dealt = true, unlockedAt = -1; for (let i = 0; i < 90; i++) { gd.second.t = g.time; R.step(); if (gd.weapon.def.id !== inHand) dealt = false; if (unlockedAt < 0 && !sideLocked(g, gd)) unlockedAt = g.time - t0; }
    const fired = gd.weapon.fire();
    F.verdict(dealt && unlockedAt > GUNSLOTS.out - 0.05 && unlockedAt < GUNSLOTS.out + 0.1 && fired, 'a second and a half of frames with a man in front of him: the sidearm stays his gun, a round goes from it once his hands are on it', `still ${inHand}: ${dealt} · free after ${f2(unlockedAt)} s · fired ${fired}`);
    // nobody in front of him: back to the primary, full
    const side = gd.weapon; side.chamber = 0; side.mag = 0;   // (and he emptied it on them)
    const back0 = GUNSLOTS_STATS.back; let backAt = -1; const t1 = g.time; for (let i = 0; i < 60 * 4 && backAt < 0; i++) { R.step(); if (!gd.second.out) backAt = g.time - t1; }
    const full = gd.weapon === primary && primary.mag + primary.chamber >= primary.def.magCapacity && side.roundsReady > 0 && gd.second.gun === side && sideHung(gd) === null && sideLocked(g, gd);
    F.verdict(backAt > GUNSLOTS.lull - 0.1 && backAt < GUNSLOTS.lull + 0.2 && full && GUNSLOTS_STATS.back === back0 + 1 && gd.route.weapon === primary.def.id, `nobody in front of him for ${f2(GUNSLOTS.lull)} s: the sidearm goes back topped off, the primary is in his hands reloaded, and his hands are busy for the reload`, `back after ${f2(backAt)} s · in hand ${gd.weapon.def.id} ${primary.mag}+${primary.chamber} · sidearm ${side.roundsReady} · locked ${sideLocked(g, gd)}`);
    // a man whose card brings no long gun has nothing behind his pistol
    K.KIT.members[2].weapon = 'pistol'; K.kitStage(g, ops);
    F.verdict(WEAPONS[ops[1].weapon.def.id].cls === 'pistol' && ops[1].second === null && !sideOut(g, ops[1], 3), 'a man whose card leaves the primary at home carries his sidearm alone', `in hand ${ops[1].weapon.def.id} · second ${ops[1].second}`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── fight
export async function gunslotsFight(): Promise<boolean> {
  const F = family('gunslots-fight: dry in a fight at five metres, the sidearm finishes it');
  await kept(async () => {
    const run = async (on: boolean) => {
      const R: any = await hushed(() => rig(17, { stage: false })); raise(on); const g = R.game; K.KIT.on = true; g.guards.length = 0;
      const ops = [spawnUnit(g, { team: 'operative', pos: [14.2, 0, 13.35], yaw: Math.PI / 2, name: 'Archer' }), spawnUnit(g, { team: 'operative', pos: [14.0, 0, 12.65], yaw: Math.PI / 2, name: 'Bishop' })];
      K.kitStage(g, ops); const out0 = GUNSLOTS_STATS.out, back0 = GUNSLOTS_STATS.back;
      const hos = [0, 1, 2].map(k => spawnUnit(g, { team: 'hostile', pos: [19.5 + 0.3 * k, 0, 12.2 + 0.5 * k], yaw: -Math.PI / 2, name: `H${k}`, light: false })); for (const h of hos) h.hold = true;
      for (const o of ops) { o.weapon.mag = 0; o.weapon.chamber = 1; }   // (one round each: two men go down to the primaries, the third is left to dry guns)
      const shots: { t: number; w: string }[] = []; let dryAt = -1, lastDown = -1, n = 0;
      for (let i = 0; i < 60 * 12; i++) { R.step();
        for (; n < g.events.length; n++) { const e = g.events[n]; if (e.kind === 'shot' || e.kind === 'guardShot') shots.push({ t: e.time, w: String(e.weapon) }); }
        if (dryAt < 0 && ops.every((o: any) => o.weapon.def.cls === 'pistol' || o.weapon.roundsReady === 0)) dryAt = g.time;
        if (lastDown < 0 && hos.every((h: any) => h.state === 'dead')) lastDown = g.time; }
      return { dryAt, lastDown, out: GUNSLOTS_STATS.out - out0, back: GUNSLOTS_STATS.back - back0, side: shots.filter(x => WEAPONS[x.w as keyof typeof WEAPONS]?.cls === 'pistol').length, end: ops.map((o: any) => `${o.weapon.def.id} ${o.weapon.mag}+${o.weapon.chamber}`), reload: ops[0].second ? ops[0].second.gun.def.reload.dur : ops[0].weapon.def.reload.dur, up: ops.every((o: any) => o.state !== 'dead') };
    };
    const off = await run(false), on = await run(!BREAK);
    const gapOn = on.lastDown - on.dryAt, gapOff = off.lastDown < 0 ? Infinity : off.lastDown - off.dryAt;
    F.verdict(on.out >= 1 && on.side >= 1 && on.lastDown > 0 && gapOn < WEAPONS[K.kitGun(K.kitDefault(1))].reload.dur && gapOn < gapOff, 'with the switch on the last man is down to a sidearm round sooner after the guns ran dry than a magazine change takes; with it off no sidearm is fired and he stands longer', `on: dry at ${f2(on.dryAt)} s, last man down ${f2(on.lastDown)} s (${f2(gapOn)} s after), ${on.out} sidearms out, ${on.side} sidearm rounds\n    off: dry at ${f2(off.dryAt)} s, last man down ${off.lastDown < 0 ? 'never in twelve seconds' : f2(off.lastDown) + ' s (' + f2(gapOff) + ' s after)'}, ${off.side} sidearm rounds`);
    F.verdict(on.up && on.back === on.out && on.end.every((e: string) => !/fiveseven|guard9mm/.test(e) && !/ 0\+0$/.test(e)), 'the floor quiet again, every sidearm is back in its holster and the primaries are in their hands, loaded', `back ${on.back} of ${on.out} · in hand: ${on.end.join(' · ')}`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function gunslotsOff(): Promise<boolean> {
  const F = family('gunslots-off: the switch off, or on and nobody dry, is the same run');
  await kept(async () => {
    const run = async (on: boolean) => {
      const R: any = await hushed(() => rig(17, { stage: false })); raise(on); const g = R.game; R.RC.start(17); const hashes: string[] = [];   // (the big slot's card on in both: the slots ride on it)
      for (let i = 0; i < 600; i++) { R.step(); if (i % 150 === 149) hashes.push(hashDigest(digestGame(g, true))); }
      return { hashes, second: g.guards.filter((gd: any) => gd.second).length };
    };
    const off = await run(false), on = await run(!BREAK);
    F.verdict(J(off.hashes) === J(on.hashes) && off.second === 0 && on.second > 0, 'ten seconds of the staged room clear: nobody has a second gun with the switch off; on, the teammates carry one each and (no card changed, nobody dry) the run digests the same', `off: ${off.hashes.join(' ')} (${off.second} second guns)\n    on:  ${on.hashes.join(' ')} (${on.second} second guns)`);
    const reg = knobRegistry(), page = /GUNSLOTS\.on = !q\.has\('nogunslots'\)/.test(await Bun.file(`${ROOT}/src/host/profile.ts`).text());
    F.verdict('GUNSLOTS.on' in FROZEN_HOLDS && reg.GUNSLOTS === GUNSLOTS && page, 'the switch is one of the two stands\' rows, in the knob registry, and the page writes it on unless ?nogunslots', `frozen hold: ${FROZEN_HOLDS['GUNSLOTS.on']} · registered ${reg.GUNSLOTS === GUNSLOTS} · pageSwitches writes it: ${page}`);
    const R: any = await hushed(() => rig(17, { stage: false })); GUNSLOTS.on = true; const snap = knobsSnapshot(R.game); const has = !!snap.tables.GUNSLOTS; delete snap.tables.GUNSLOTS; applyKnobs(R.game, snap);
    F.verdict(has && GUNSLOTS.on === false, 'a recording carries the table, and one from before it replays with the switch off', `carried ${has} · after a file without it: on = ${GUNSLOTS.on}`);
  });
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2); const all: [string, () => Promise<boolean>][] = [['card', gunslotsCard], ['mate', gunslotsMate], ['fight', gunslotsFight], ['off', gunslotsOff]];
  const bad = want.filter(w => !all.some(([n]) => n === w)); if (bad.length) { console.error(`unknown: ${bad.join(' ')} (card mate fight off)`); process.exit(2); }
  let ok = true; for (const [n, fn] of all) if (!want.length || want.includes(n)) { try { ok = (await fn()) && ok; } catch (e) { ok = false; console.log(`- FAIL — gunslots-${n} threw\n    ${(e as Error).stack ?? (e as Error).message}`); } }
  console.log(`\n=== gunslots-check: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1);
}
