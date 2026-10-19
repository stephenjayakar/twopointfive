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

const { GUNSLOTS, GUNSLOTS_STATS, sideOut, sideLocked, sideHung, gunPicks, pickRow, pickWord } = await import(`${ROOT}/src/game/gunslots.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { KITTREE } = await import(`${ROOT}/src/game/kittree.ts`);
const { WEAPONS, Rifle, Firearm, handlingOf } = await import(`${ROOT}/src/game/weapons.ts`);
const { rifleSpread } = await import(`${ROOT}/src/game/player.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { hearPath } = await import(`${ROOT}/src/game/weather.ts`);
const LOAD = await import(`${ROOT}/src/game/kitload.ts`);
const { GUNLOOK } = await import(`${ROOT}/src/game/gunlook.ts`);
const GR = await import(`${ROOT}/src/game/gunreload.ts`);
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
const raise = (on = true) => { GUNSLOTS.on = on; K.BIGSLOT.on = true; K.KITDEAL.on = false; KITTREE.on = false; };   // (… and the card's rows as the two slots wrote them: laid out as a tree — kittree.ts — they are kittree-check.ts's to hold)
/** every table and card put back as found */
async function kept<T>(fn: () => Promise<T>): Promise<T> {
  const was = { ...GUNSLOTS }, big = K.BIGSLOT.on, deal = K.KITDEAL.on, kit = K.KIT.on, tree = KITTREE.on, cards = JSON.stringify(K.KIT.members);
  try { return await fn(); } finally { Object.assign(GUNSLOTS, was); KITTREE.on = tree; K.BIGSLOT.on = big; K.KITDEAL.on = deal; K.KIT.on = kit; K.KIT.members.splice(0, K.KIT.members.length, ...JSON.parse(cards)); }
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
    F.verdict(K.rowGet(P, old) === 'none' && old.weapon === 'pistol' && K.kitGun(old) === 'g19bare' && WEAPONS[K.kitGun(kept2)].cls === 'pistol' && K.kitSide(kept2) === null && both.primary === 'mk18' && both.secondary === 'g19' && junk.primary === 'mk18' && junk.secondary === 'g19', 'a stored card from before the slots is its gun row in their words; a pick the table does not have is the issued one', `old pistol card → primary ${K.rowGet(P, old)}, in his hands ${K.kitGun(old)} · a pistol card that still names a long gun → ${K.kitGun(kept2)} · junk → ${junk.primary} + ${junk.secondary}`);
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
    // a belt-fed gun taken up again is HEARD fed, every sound of it on the beat his hands are busy for (gunreload.ts under gunlook.ts; a magazine gun's is one clack)
    { const look0 = GUNLOOK.on, m: any = ops[1], heard = (on: boolean) => {
        GUNLOOK.on = on; m.route.weapon = 'mk46'; m.weapon = new Firearm(WEAPONS.mk46); m.reloadT = -1; m.second.out = false; m.second.lock = -100; m.weapon.chamber = 0; m.weapon.mag = 0;
        if (!sideOut(g, m, 4)) return null; for (let i = 0; i < 60 * 4 && m.second.out; i++) R.step();
        const a: any[] = []; R.W.audioLog = a; for (let i = 0; i < 60 * 9 && sideLocked(g, m); i++) R.step(); R.W.audioLog = null;
        return a.map((e: any) => e.name as string); };
      const def = WEAPONS.mk46, on = heard(true), cues = (GR.feedCues(def, GR.beatOf(def.reload, true), def.magCapacity, true) ?? []).map((c: any) => c.sfx as string), off = heard(false); GUNLOOK.on = look0;
      const count = (a: string[], n: string) => a.filter(x => x === n).length, all = !!on && cues.length >= 3 && ([...new Set(cues)] as string[]).every(n => count(on, n) >= count(cues as string[], n));
      F.verdict(all && !!off && !off.some(n => cues.includes(n) && n !== 'magOut'), 'a belt-fed gun taken up again after the sidearm is heard fed: each of its own sounds comes on the beat (with the guns\' own looks off, the one clack as before)', `its feed: ${cues.join(' ')} · heard while his hands were busy: ${on ? on.filter(n => cues.includes(n)).join(' ') || 'NONE' : 'no swap'} · looks off: ${off ? off.filter(n => n !== 'footstep').join(' ') || 'none of them' : 'no swap'}`); }
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
    GUNSLOTS.on = true; GUNSLOTS.heard = true; GUNSLOTS.bare = true; const snap2 = knobsSnapshot(R.game); delete (snap2.tables.GUNSLOTS as any).heard; delete (snap2.tables.GUNSLOTS as any).bare; applyKnobs(R.game, snap2);
    F.verdict(GUNSLOTS.on === true && GUNSLOTS.heard === false && GUNSLOTS.bare === false, 'a recording from before a key replays without it: a teammate\'s quiet round unheard, a bare carbine the AKS-74U row', `on ${GUNSLOTS.on} · heard ${GUNSLOTS.heard} · bare ${GUNSLOTS.bare}`); GUNSLOTS.heard = true; GUNSLOTS.bare = true;
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── guns
/** the row a pick is in your hands / a teammate's with his suppressor on */
const rowOfPick = (id: string) => (WEAPONS as any)[(K.kitGun({ ...K.kitDefault(1), weapon: gunPicks('primary').includes(id) ? 'rifle' : 'pistol', primary: gunPicks('primary').includes(id) ? id : 'mk18', secondary: gunPicks('secondary').includes(id) ? id : 'g19', suppressed: true }))];
export async function gunslotsGuns(): Promise<boolean> {
  const F = family('gunslots-guns: more guns, each set apart by something measured');
  await kept(async () => {
    raise(!BREAK); K.KIT.on = true;
    const longs = gunPicks('primary').filter((p: string) => p !== 'none'), sides = gunPicks('secondary');
    F.verdict(longs.length >= 5 && sides.length >= 3, 'the two rows offer a handful of guns each', `primary: ${longs.join(' ')} (or none) · secondary: ${sides.join(' ')}`);
    if (longs.length < 5 || sides.length < 3) return;
    const D = Object.fromEntries([...longs, ...sides].map((id: string) => [id, rowOfPick(id)])) as Record<string, any>;
    // every pick: on a teammate's card he is staged with it and his sidearm; on yours the Player carries the two rows
    { const R: any = await hushed(() => rig(17, { stage: false })); raise(!BREAK); const g = R.game; const at = g.player.char.pos, bad: string[] = [], seen: string[] = [];
      const ops = [0, 1].map(k => spawnUnit(g, { team: 'operative', pos: [at[0] + 1 + k, 0, at[2] + 1], yaw: 0, name: `Op${k}`, light: false }));
      for (const id of longs) for (const side of sides) {
        K.KIT.members[1] = K.kitDefault(1); const a = K.kitSet(1, 'primary', id), b = K.kitSet(1, 'secondary', side); K.kitStage(g, ops);
        const gd: any = ops[0], want = D[id].id, wantSide = (WEAPONS as any)[K.kitSide(K.KIT.members[1])]?.id;
        if (!a || !b || gd.weapon.def.id !== want || gd.second?.id !== wantSide || gd.route.weapon !== want) bad.push(`${id}+${side}: ${gd.weapon.def.id}+${gd.second?.id}`); else if (side === sides[0]) seen.push(`${id}→${want}`);
      }
      K.KIT.members[1] = K.kitDefault(1);
      F.verdict(!bad.length, 'every primary with every secondary: a teammate is staged with that gun in his hands and that sidearm behind it', bad.length ? bad.join(' · ') : seen.join(' · '));
      const mine: string[] = [], wrong: string[] = [];
      for (const id of longs) { const side = sides[longs.indexOf(id) % sides.length]; K.KIT.members[0] = K.kitDefault(0); K.kitSet(0, 'primary', id); K.kitSet(0, 'secondary', side); K.kitPlayer(g);
        const pl = g.player, tube = pl.rifle.attachments.length > 0; (pl.hasRifle && pl.rifle.def.id === D[id].id && pl.pistol.def.id === D[side].id && tube === (D[id].launcher !== false && !D[id].pellets) ? mine : wrong).push(`${id}+${side}: ${pl.rifle.def.id}+${pl.pistol.def.id}${tube ? ' (launcher)' : ''}`); }
      K.KIT.members[0] = K.kitDefault(0); K.kitPlayer(g);
      const backTo = `${g.player.rifle.def.id}+${g.player.pistol.def.id}`;
      F.verdict(!wrong.length && mine.filter(x => x.includes('(launcher)')).length === 1 && backTo === `${D[longs[0]].id}+${D[sides[0]].id}`, 'your card: slot 2 is the primary you picked and slot 1 the secondary; only the issue carbine has the launcher under it; the card as issued again is the pair you were built with', `${[...mine, ...wrong.map(x => 'WRONG ' + x)].join(' · ')} · as issued: ${backTo}`);
      // REACH — your hands (the cone standing still, as a group's radius at 25 m) and a teammate's (the row's own spread at 25 m, his man standing)
      const pl = g.player, was = pl.rifle, crouch = pl.crouch; pl.crouch = false;
      const hands = Object.fromEntries(longs.filter((id: string) => !D[id].pellets).map((id: string) => { pl.rifle = new Rifle(D[id]); const still = rifleSpread(g, 0) * 25, moving = rifleSpread(g, 3) * 25; pl.crouch = true; const knelt = rifleSpread(g, 0) * 25; pl.crouch = false; return [id, { still, moving, knelt }]; })) as Record<string, { still: number; moving: number; knelt: number }>;
      pl.rifle = was; pl.crouch = crouch;
      const ai = (id: string, m: number) => { const A = D[id].aiSpread; return (A.base + Math.max(0, m - A.rangeFrom) * A.rangeK) * m; };
      F.verdict(hands.mk12.still < hands.mk18.still * 0.6 && hands.mp7.still > hands.mk18.still * 1.3 && hands.mp7.moving < hands.mk18.moving && hands.mk46.moving > hands.mk18.moving * 2 && hands.mk46.knelt < hands.mk46.still * 0.5 && ai('mk12', 25) < ai('mk18', 25) * 0.6 && ai('mp7', 25) > ai('mk18', 25) * 1.5 && ai('mp7', 5) < ai('mk18', 5) * 1.5,
        'REACH: at 25 m the Mk 12 holds a group well under the carbine\'s, in your hands and a teammate\'s; the MP7\'s is gone at that range but it is the steadiest on the move; the Mk 46 is wide on the feet and closes kneeling',
        `your group at 25 m, still / moving / knelt (m): ${Object.entries(hands).map(([id, h]) => `${id} ${f2(h.still)} / ${f2(h.moving)} / ${f2(h.knelt)}`).join(' · ')}\n    a teammate's at 25 m (m): ${longs.filter((id: string) => !D[id].pellets).map((id: string) => `${id} ${f2(ai(id, 25))}`).join(' · ')}`);
    }
    // WHO HEARS IT — one round from your hands, a listener every metre down a clear line: the farthest one it turned, and whether the floor took it for gunfire
    { const heard: Record<string, { far: number; gunfire: boolean }> = {}; let line = '';
      for (const id of [...sides, ...longs]) {
        const R: any = await hushed(() => rig(17, { stage: false })); raise(!BREAK); const g = R.game; g.guards.length = 0; const at = g.player.char.pos;
        let dir: [number, number] | null = null; for (let k = 0; k < 16 && !dir; k++) { const a = k * Math.PI / 8, u: [number, number] = [Math.cos(a), Math.sin(a)]; if ([5, 8, 11].every(m => hearPath(g, [at[0], 1, at[2]], [at[0] + u[0] * m, 1.5, at[2] + u[1] * m]).direct)) dir = u; }
        if (!dir) { F.verdict(false, 'a clear line of eleven metres from where you stand', 'none found on this floor'); return; }
        const M = [5, 6, 7, 8, 9, 10, 11], ls = M.map((m, k) => spawnUnit(g, { team: 'guard', pos: [at[0] + dir![0] * m, 0, at[2] + dir![1] * m], yaw: Math.atan2(dir![0], dir![1]), name: `L${k}`, light: false }));
        for (let i = 0; i < 5; i++) R.step();
        fireWeapon(g, g.player.char, [at[0] - dir[0] * 10, 1.2, at[2] - dir[1] * 10], true, { weapon: D[id] });
        for (let i = 0; i < 30; i++) R.step();
        const turned = M.filter((_, k) => (ls[k] as any).witness.heard.small > 0 || (ls[k] as any).witness.heard.shots > 0);
        heard[id] = { far: turned.length ? Math.max(...turned) : 0, gunfire: ls.some((l: any) => l.witness.heard.shots > 0) }; line = `along ${dir.map(f2).join(',')}`;
      }
      // … and the same round from a TEAMMATE's gun beside you (GUNSLOTS.heard): the same heads turn; with that off, as it always was, nobody's
      const mate = async (on: boolean) => { const R: any = await hushed(() => rig(17, { stage: false })); raise(!BREAK); GUNSLOTS.heard = on; const g = R.game; g.guards.length = 0; const at = g.player.char.pos;
        let dir: [number, number] | null = null; for (let k = 0; k < 16 && !dir; k++) { const a = k * Math.PI / 8, u: [number, number] = [Math.cos(a), Math.sin(a)]; if ([5, 8, 11].every(m => hearPath(g, [at[0], 1, at[2]], [at[0] + u[0] * m, 1.5, at[2] + u[1] * m]).direct)) dir = u; }
        if (!dir) return -1;
        const op = spawnUnit(g, { team: 'operative', pos: [at[0], 0, at[2]], yaw: 0, name: 'Archer', light: false }), o = (op as any).char.pos;
        const M = [6, 8, 9, 10, 11], ls = M.map((m, k) => spawnUnit(g, { team: 'hostile', pos: [o[0] + dir![0] * m, 0, o[2] + dir![1] * m], yaw: Math.atan2(dir![0], dir![1]), name: `L${k}`, light: false }));
        for (let i = 0; i < 5; i++) R.step();
        fireWeapon(g, (op as any).char, [o[0] - dir[0] * 10, 1.2, o[2] - dir[1] * 10], false, { weapon: D.mp7 });
        for (let i = 0; i < 30; i++) R.step();
        const turned = M.filter((_, k) => (ls[k] as any).witness.heard.small > 0); return turned.length ? Math.max(...turned) : 0; };
      const mateOn = await mate(true), mateOff = await mate(false); GUNSLOTS.heard = true;
      F.verdict(mateOn === heard.mp7.far && mateOff === 0, 'a teammate\'s MP7 round beside you turns the same heads yours does; with that key off it reaches nobody, as a teammate\'s quiet round always had', `farthest listener turned by a teammate's round: ${mateOn} m (yours ${heard.mp7.far} m) · key off: ${mateOff} m`);
      const quiet = ['hk45', 'g19', 'mp7'], loud = [...longs, ...sides].filter(id => !quiet.includes(id));
      F.verdict(quiet.every(id => !heard[id].gunfire) && heard.hk45.far < heard.g19.far && heard.g19.far < heard.mp7.far && heard.mp7.far < 11 && loud.every(id => heard[id].gunfire && heard[id].far === 11),
        'WHO HEARS IT: the HK45 turns the fewest heads, then the issue pistol, then the MP7 — none of the three is taken for gunfire; every other gun is, by every man on the line',
        `farthest listener turned (m), ${line}: ${[...quiet, ...loud].map(id => `${id} ${heard[id].far}${heard[id].gunfire ? ' GUNFIRE' : ''}`).join(' · ')}`); }
    // HOW IT COMES ROUND, HOW LONG IT RUNS, HOW LONG IT FEEDS — the row's own numbers, as the turn weight, the trigger and the reload read them
    { const turn = (id: string) => handlingOf(D[id]), runs = (id: string) => { const d = D[id]; return { n: d.magCapacity + (d.topUp ? 1 : 0), secs: (d.magCapacity + (d.topUp ? 1 : 0)) * (d.auto ? d.auto.interval : d.cd), feed: d.reload.dur }; };
      F.verdict(turn('mk46') < turn('mk12') && turn('mk12') < turn('m1014') && turn('m1014') < turn('mk18') && turn('mk18') < turn('mp7') && turn('mp7') < turn('g19') && runs('mk46').n >= 3 * runs('mk18').n && runs('mk46').feed > 2 * runs('mk18').feed && runs('g18').n > 2 * runs('g19').n && runs('hk45').n < runs('g19').n && D.m1014.cd < WEAPONS.m870.cd / 2 && D.mk12.modes.join() === 'semi' && D.g18.modes[0] === 'auto',
        'IN THE HANDS: the Mk 46 comes round slowest and the MP7 nearly like a pistol; the Mk 46 runs three magazines\' worth and takes over twice as long to feed; the Glock 18 holds twice the issue pistol and the HK45 less; the M1014 cycles in under half the pump\'s time',
        `turn weight (1 = a pistol): ${[...longs, ...sides].map(id => `${id} ${f2(turn(id))}`).join(' · ')}\n    rounds · seconds of trigger · reload: ${[...longs, ...sides].map(id => { const r = runs(id); return `${id} ${r.n} · ${f2(r.secs)} · ${f2(r.feed)}`; }).join(' | ')}`);
      F.verdict(Object.values(WEAPONS).every((d: any) => d.damage === 'oneShot') && Object.values(D).every((d: any) => d.weightKg > 0 && d.bulk >= 0), 'never by hit points: every row\'s round does what every round does; each row says what it weighs and how bulky it is', Object.entries(D).map(([id, d]) => `${id} ${d.weightKg} kg / ${d.bulk}`).join(' · ')); }
    // THE SAME GUN WITH ITS SUPPRESSOR OFF — the issue carbine and the issue pistol bare are their own rows' gun, heard; the old meaning behind the key
    { const W = WEAPONS as any, same = (a: string, b: string, keys: string[]) => keys.every(k => JSON.stringify(W[a][k]) === JSON.stringify(W[b][k]));
      const long = pickRow('mk18', false), side = pickRow('g19', false), words = [pickWord('mk18', false) === pickWord('mk18', true), pickWord('g19', false) === pickWord('g19', true)];
      const rows = long === 'mk18bare' && side === 'g19bare' && same('mk18bare', 'fn2000', ['short', 'cls', 'magCapacity', 'spareMags', 'reload', 'modes', 'cd', 'auto', 'rig', 'handling', 'muzzleAhead', 'bulk']) && same('g19bare', 'fiveseven', ['short', 'cls', 'magCapacity', 'spareMags', 'reload', 'modes', 'cd', 'rig', 'bulk'])
        && !W.mk18bare.suppressed && !W.g19bare.suppressed && W.mk18bare.report.loud && W.g19bare.report.level >= 1 && W.fiveseven.report.level < 1 && W.mk18bare.muzzleFx !== W.fn2000.muzzleFx && W.mk18bare.weightKg < W.fn2000.weightKg && W.mk18bare.id === 'mk18bare' && W.fn2000.id === 'fn2000';
      const tube = new Rifle(W.mk18bare), hasTube = Object.keys(tube).length === Object.keys(new Rifle(W.fn2000)).length;
      const card = { ...K.kitDefault(1), weapon: 'rifle', primary: 'mk18', secondary: 'g19', suppressed: false }, held = K.kitGun(card), second = K.kitSide(card);
      GUNSLOTS.bare = false; const was = [pickRow('mk18', false), pickRow('g19', false), pickRow('mk18', true)]; GUNSLOTS.bare = true;
      F.verdict(rows && words.every(Boolean) && hasTube && held === 'mk18bare' && second === 'g19bare' && was.join() === 'aks74u,guard9mm,fn2000',
        'THE SAME GUN, BARE: a Mk 18 or a Glock 19 with its suppressor off keeps its name, magazine, handling, hold and launcher and is heard as gunfire; a teammate is staged with those rows; with the key off a bare carbine is the AKS-74U row as it was',
        `bare rows ${long} + ${side} · tile '${pickWord('mk18', false)}' / '${pickWord('g19', false)}' · a teammate's card with the suppressor off: ${held} + ${second} · key off: ${was.join(' ')}`); }
    // WHAT IT WEIGHS — the card's two scores (kitload.ts reads each gun's own weightKg and bulk): every pick stepped on your card and a teammate's
    { const lines: string[] = []; let ok = true; const slots0 = K.SLOTS.on; K.SLOTS.on = true;   // (a man is weighed under the pouches rule only: kitload.ts)
      for (const i of [0, 1]) {
        const card = (primary: string, secondary = 'g19') => ({ ...K.kitDefault(i), weapon: primary === 'none' ? 'pistol' : 'rifle', primary: primary === 'none' ? 'mk18' : primary, secondary, suppressed: true });
        const of = (primary: string, secondary?: string) => LOAD.loadOf(i, card(primary, secondary)) as { mob: number; con: number };
        const none = of('none'), L = Object.fromEntries(longs.map((id: string) => [id, of(id)])) as Record<string, { mob: number; con: number }>;
        const lighter = (a: string, b: string) => L[a].mob > L[b].mob - 1e-9 && L[a].con > L[b].con - 1e-9 && (L[a].mob > L[b].mob + 0.01 || L[a].con > L[b].con + 0.01);
        const rows = !!LOAD.loadShare(i, card('mk18'), 'primary') && !!LOAD.loadShare(i, card('mk18'), 'secondary') && !LOAD.loadShare(i, card('none'), 'primary');
        const side = of('mk18', 'hk45').mob < of('mk18', 'g19').mob - 1e-6;
        const w = (id: string) => LOAD.loadWorn(i, card(id)), pace = (id: string) => { const x = w(id); return x ? LOAD.loadPaceK(x) : 1; }, seen = (id: string) => { const x = w(id); return x ? LOAD.loadSeenK(x) : 1; };
        ok &&= rows && side && longs.every((id: string) => none.mob > L[id].mob + 0.01 && none.con > L[id].con + 0.1) && lighter('mp7', 'mk18') && lighter('mk18', 'm1014') && lighter('m1014', 'mk12') && lighter('mk12', 'mk46')
          && pace('none') > pace('mp7') && pace('mp7') > pace('mk18') && pace('mk18') > pace('mk46') && seen('none') < seen('mp7') && seen('mp7') < seen('mk18') && seen('mk18') < seen('mk46');
        lines.push(`${i ? 'a teammate' : 'you'} (mobility / concealment · pace × · notice ×): none ${f2(none.mob)} / ${f2(none.con)} · ${f2(pace('none'))} · ${f2(seen('none'))} | ${longs.map((id: string) => `${id} ${f2(L[id].mob)} / ${f2(L[id].con)} · ${f2(pace(id))} · ${f2(seen(id))}`).join(' | ')} | HK45 beside the Mk 18: mobility ${f2(of('mk18', 'hk45').mob)}`);
      }
      K.SLOTS.on = slots0;
      F.verdict(ok, 'WHAT IT WEIGHS: on the card\'s two scores the sidearm alone is lightest and best hidden, then the MP7, the Mk 18, the M1014, the Mk 12, and the Mk 46 last on both; the Primary and the Secondary row each carry their own gun\'s share; a man\'s pace and the notice he draws follow', lines.join('\n    ')); }
    // IN A FIGHT — two teammates with each primary (then each sidearm alone), three men five metres in front of them: the fight is finished with that gun
    { const rows: string[] = []; let all = true;
      for (const pick of [...longs.map((id: string) => ({ primary: id, secondary: sides[0], alone: false })), ...sides.map((id: string) => ({ primary: longs[0], secondary: id, alone: true }))]) {
        const R: any = await hushed(() => rig(17, { stage: false })); raise(!BREAK); const g = R.game; K.KIT.on = true; g.guards.length = 0;
        for (const i of [1, 2]) { K.KIT.members[i] = K.kitDefault(i); K.kitSet(i, 'primary', pick.alone ? 'none' : pick.primary); K.kitSet(i, 'secondary', pick.secondary); }
        const ops = [spawnUnit(g, { team: 'operative', pos: [14.2, 0, 13.35], yaw: Math.PI / 2, name: 'Archer' }), spawnUnit(g, { team: 'operative', pos: [14.0, 0, 12.65], yaw: Math.PI / 2, name: 'Bishop' })];
        K.kitStage(g, ops); const want = D[pick.alone ? pick.secondary : pick.primary].id;
        const hos = [0, 1, 2].map(k => spawnUnit(g, { team: 'hostile', pos: [19.5 + 0.3 * k, 0, 12.2 + 0.5 * k], yaw: -Math.PI / 2, name: `H${k}`, light: false })); for (const h of hos) (h as any).hold = true;
        let n = 0, shots = 0, other = 0, done = -1; const t0 = g.time;
        for (let i = 0; i < 60 * 10 && done < 0; i++) { R.step(); for (; n < g.events.length; n++) { const e = g.events[n]; if (e.kind === 'guardShot' && ops.some((o: any) => o.char.id === e.who)) { if (e.weapon === want) shots++; else other++; } } if (hos.every((h: any) => h.state === 'dead')) done = g.time - t0; }
        const ok = ops.every((o: any) => o.weapon.def.id === want || o.second?.out) && shots > 0 && done > 0; all &&= ok;
        rows.push(`${pick.alone ? pick.secondary + ' alone' : pick.primary}: ${done > 0 ? f2(done) + ' s' : 'NOT FINISHED'}, ${shots} round${shots === 1 ? '' : 's'}${other ? ` (+${other} from the sidearm)` : ''}`);
      }
      for (const i of [1, 2]) K.KIT.members[i] = K.kitDefault(i);
      F.verdict(all, 'IN A FIGHT: with each gun in their hands two teammates put three men down at five metres, and the rounds are that gun\'s', rows.join(' · ')); }
  });
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2); const all: [string, () => Promise<boolean>][] = [['card', gunslotsCard], ['mate', gunslotsMate], ['fight', gunslotsFight], ['guns', gunslotsGuns], ['off', gunslotsOff]];
  const bad = want.filter(w => !all.some(([n]) => n === w)); if (bad.length) { console.error(`unknown: ${bad.join(' ')} (card mate fight guns off)`); process.exit(2); }
  let ok = true; for (const [n, fn] of all) if (!want.length || want.includes(n)) { try { ok = (await fn()) && ok; } catch (e) { ok = false; console.log(`- FAIL — gunslots-${n} threw\n    ${(e as Error).stack ?? (e as Error).message}`); } }
  console.log(`\n=== gunslots-check: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1);
}
