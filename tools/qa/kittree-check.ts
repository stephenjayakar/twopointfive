// THE GEAR SCREEN AS A TREE (src/game/kittree.ts KITTREE; `KITTREE_BREAK=1` must fail)
//   rows    one list of rows for every man: each gun's own suppressor, the light and what the launcher fires hang UNDER a gun (KitRow.under), your card has
//           the suppressor, light and goggles rows a teammate's has, and a row the card does not have as it stands (no tube on this gun) is not there to step
//   guns    a suppressor is per gun: off your primary the same gun deploys with a bare muzzle, off a teammate's sidearm he is staged with the bare pistol
//           behind a suppressed carbine; a gun made with one, or that none fits, says so and is refused; the four bars set every gun apart
//   sponge  sponge rounds are a counted row: none as issued and none on a loud deploy, the launcher's five handed over the card on a quiet or solo run,
//           a pouch each when you pick them; no light on the card is a dead L, no goggles a dead N
//   off     the switch off = the card of the build before, row for row, and the same run by digest; the two stands' row, the registry, the page's flag, a
//           recording from before it
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself. Nothing here looks at a picture (the page: kittree-page.cjs).
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';

const { KITTREE, bareOf } = await import(`${ROOT}/src/game/kittree.ts`);
const { GUNSLOTS, gunPicks, pickRow } = await import(`${ROOT}/src/game/gunslots.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const { GUN_STATS, gunStats } = await import(`${ROOT}/src/ui/gunStats.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const J = (o: unknown) => JSON.stringify(o), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
/** the switch as the page has it, with the two gun slots' card it rides on (the frozen stand pins all three off as it stands a game up: raised after) — and
 *  every card as the table writes it (kit.ts KITDEAL off: what a team of three or four is dealt is kitdeal-check.ts's to hold) */
const raise = (on = true) => { KITTREE.on = on; GUNSLOTS.on = true; K.BIGSLOT.on = true; K.KITDEAL.on = false; K.KIT.on = true; };
/** every table and card put back as found */
async function kept<T>(fn: () => Promise<T>): Promise<T> {
  const was = { ...KITTREE }, guns = GUNSLOTS.on, big = K.BIGSLOT.on, deal = K.KITDEAL.on, kit = K.KIT.on, solo = K.KIT_SOLO.on, cards = JSON.stringify(K.KIT.members);
  try { return await fn(); } finally { Object.assign(KITTREE, was); GUNSLOTS.on = guns; K.BIGSLOT.on = big; K.KITDEAL.on = deal; K.KIT.on = kit; K.KIT_SOLO.on = solo; K.KIT.members.splice(0, K.KIT.members.length, ...JSON.parse(cards)); }
}
const issue = () => { for (let i = 0; i < K.KIT.members.length; i++) K.KIT.members[i] = K.kitDefault(i); };
const rows = (i: number) => K.kitRows(i) as any[];
const row = (i: number, f: string) => rows(i).find(r => r.field === f);
/** the rows a card has as it stands, each with the gun it hangs under */
const shape = (i: number) => { const m = K.KIT.members[i]; return rows(i).filter(r => K.rowHas(r, m)).map(r => `${r.field}${r.under !== undefined ? `<${K.rowUnder(r, m)}` : ''}`); };
const LAUNCHER = ['rings', 'shells', 'cams'];

// ───────────────────────────────────────────────────────────── rows
export async function kittreeRows(): Promise<boolean> {
  const F = family('kittree-rows: one list of rows for every man, what rides on a gun under it');
  await kept(async () => {
    raise(false); issue(); const flat = [0, 1].map(i => rows(i).map(r => r.field));
    raise(true); issue(); const you = shape(0), mate = shape(1);
    const under = (s: string[], f: string) => s.find(x => x.startsWith(`${f}<`))?.split('<')[1] ?? '';
    F.verdict(under(you, 'suppressed') === 'primary' && under(you, 'sideCan') === 'secondary' && under(mate, 'suppressed') === 'primary' && under(mate, 'sideCan') === 'secondary',
      'each gun has its own suppressor row under it, on your card and on a teammate\'s', `you: ${you.join(' ')}\n    Red One: ${mate.join(' ')}`);
    F.verdict(under(you, 'light') === 'primary' && under(mate, 'light') === 'primary' && you.includes('nvg') && mate.includes('nvg') && !flat[0].includes('light') && !flat[0].includes('nvg'),
      'your card has the weapon light (under the gun in your hands) and the goggles a teammate\'s has: rows it never had', `the card before, you: ${flat[0].join(' ')}`);
    // the same rows, in the same order, but for what only your launcher fires and what a card had of its own before the switch
    const own = (a: string[], b: string[]) => a.filter(f => !b.includes(f)), before = [...own(flat[0], flat[1]), ...own(flat[1], flat[0])];
    const strip = (s: string[]) => s.map(x => x.split('<')[0]).filter(f => !LAUNCHER.includes(f) && !before.includes(f));
    F.verdict(J(strip(you)) === J(strip(mate)), 'your card and a teammate\'s are the same rows in the same order (the launcher\'s loads aside, and what one of the two cards alone had before the switch)',
      `you: ${strip(you).join(' ')}\n    Red One: ${strip(mate).join(' ')}\n    set aside: ${[...LAUNCHER, ...before].join(' ')}`);
    F.verdict(LAUNCHER.filter(f => you.some(x => x.startsWith(`${f}<`))).every(f => under(you, f) === 'primary') && under(you, 'rings') === 'primary', 'what the launcher fires hangs under the primary, sponge rounds among it', you.filter(x => LAUNCHER.includes(x.split('<')[0])).join(' ') || 'none');
    // a primary with no tube: the launcher's rows are not on the card, and cannot be stepped from under it
    const longs = gunPicks('primary') as string[], noTube = longs.find(id => id !== 'none' && WEAPONS[pickRow(id, true)]?.launcher === false);
    if (noTube && !row(0, 'rings')) F.verdict(false, 'a Sponge rounds row to step', 'the card has none');
    else if (noTube) { K.kitSet(0, 'primary', noTube); const s = shape(0), t = K.kitTry(0, 'rings', 1), set = K.kitSet(0, 'rings', 2);
      F.verdict(!s.some(x => LAUNCHER.includes(x.split('<')[0])) && !t.ok && !set && K.KIT.members[0].rings === 0, `a primary with no launcher (${noTube}): its loads are off the card and a step at one is refused`, `${s.join(' ')} · step: ${t.ok ? 'TAKEN' : t.why} · set: ${set}`); }
    else F.verdict(false, 'a primary with no launcher is on offer', longs.join(' '));
    // no long gun: the light hangs under the sidearm, the primary's suppressor is gone
    issue(); K.kitSet(1, 'primary', 'none'); const alone = shape(1);
    F.verdict(under(alone, 'light') === 'secondary' && !alone.some(x => x.startsWith('suppressed<')), 'the pistol alone: the light is under the sidearm and no row is left for a gun not brought', alone.join(' '));
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── guns
export async function kittreeGuns(): Promise<boolean> {
  const F = family('kittree-guns: a suppressor is its gun\'s, and every gun reads apart');
  await kept(async () => {
    const R: any = await hushed(() => rig(17, { stage: false })); raise(true); issue(); const g = R.game, at = g.player.char.pos;
    // yours: off the primary only, then off the sidearm only
    K.kitPlayer(g); const full = { long: g.player.rifle.def, side: g.player.pistol.def };
    K.kitSet(0, 'suppressed', false); K.kitPlayer(g); const a = { long: g.player.rifle.def, side: g.player.pistol.def };
    issue(); K.kitSet(0, 'sideCan', false); K.kitPlayer(g); const b = { long: g.player.rifle.def, side: g.player.pistol.def };
    const say = (d: any) => `${d.id}${d.suppressed ? ' (suppressed' : ' (bare'}, ${d.report.voice} ${f2(d.report.level)})`, louder = (x: any, than: any) => x.report.level > than.report.level || (x.report.voice !== than.report.voice && x.report.loud);
    F.verdict(full.long.suppressed && full.side.suppressed && a.long.id === full.long.id && !a.long.suppressed && louder(a.long, full.long) && a.side === full.side
      && b.long === full.long && b.side.id === full.side.id && !b.side.suppressed && louder(b.side, full.side),
      'your card: the suppressor off one gun is that same gun with a bare muzzle and a gunshot\'s report, the other untouched', `as issued ${say(full.long)} + ${say(full.side)}\n    off the primary: ${say(a.long)} + ${say(a.side)}\n    off the sidearm: ${say(b.long)} + ${say(b.side)}`);
    F.verdict(a.long.magCapacity === full.long.magCapacity && a.long.short === full.long.short && !/suppressed/i.test(a.long.name) && bareOf(full.long) === a.long && bareOf(a.long) === a.long, 'the bare gun is the row it was — its short name, its magazine — made once, and its long name no longer says suppressed', `${full.long.name} → ${a.long.name}, ${a.long.magCapacity} rounds`);
    // a teammate: a suppressed carbine with a bare sidearm behind it, and the other way about
    const ops = [spawnUnit(g, { team: 'operative', pos: [at[0] + 1, 0, at[2] + 1], yaw: 0, name: 'Op', light: false })];
    issue(); K.kitSet(1, 'sideCan', false); K.kitStage(g, ops); const m1 = { hand: (ops[0] as any).weapon.def, back: WEAPONS[(ops[0] as any).second?.id] };
    issue(); K.kitSet(1, 'suppressed', false); K.kitStage(g, ops); const m2 = { hand: (ops[0] as any).weapon.def, back: WEAPONS[(ops[0] as any).second?.id] };
    F.verdict(!!m1.back && !!m2.back && m1.hand.suppressed && !m1.back.suppressed && !m2.hand.suppressed && m2.back.suppressed,
      'a teammate is staged with each gun as its own row says: a suppressed carbine over a bare sidearm, a bare carbine over a suppressed one', `sidearm's off: ${say(m1.hand)} + ${m1.back ? say(m1.back) : 'none'}\n    primary's off: ${say(m2.hand)} + ${m2.back ? say(m2.back) : 'none'}`);
    // a gun that has no choice says which way it is made, and its row cannot be moved
    issue(); const fixed: string[] = [], loose: string[] = [];
    for (const slot of ['primary', 'secondary'] as const) for (const id of gunPicks(slot) as string[]) { if (id === 'none') continue; issue(); K.kitSet(1, slot, id);
      const f = slot === 'primary' ? 'suppressed' : 'sideCan', r = row(1, f), m = K.KIT.members[1], word = r.fixed?.(m) ?? '', can = !!pickRow(id, true) && !!pickRow(id, false) && pickRow(id, true) !== pickRow(id, false);
      const was = K.rowGet(r, m), moved = K.kitSet(1, f, !was) && K.rowGet(r, K.KIT.members[1]) !== was;
      (can === !word && moved === can ? fixed : loose).push(`${id}: ${word || 'on / off'}${moved ? '' : ' (held)'}`); }
    F.verdict(!loose.length && fixed.some(x => x.includes('held')) && fixed.some(x => !x.includes('held')), 'every gun: its suppressor row moves only where the gun can be had both ways, and says why where it cannot', loose.length ? `WRONG ${loose.join(' · ')}` : fixed.join(' · '));
    // the four bars: no two guns of a slot read alike, a bare muzzle is less quiet
    issue(); const bars: Record<string, Record<string, number>> = {};
    for (const slot of ['primary', 'secondary'] as const) for (const id of gunPicks(slot) as string[]) { if (id === 'none') continue; issue(); K.kitSet(1, slot, id); const d = K.kitSlotDef(1, K.KIT.members[1], slot); if (d) bars[`${slot}:${id}`] = gunStats(d); }
    const ids = Object.keys(bars), near: string[] = [], range = (v: Record<string, number>) => Object.values(v).every(x => x >= 0 && x <= 1);
    for (const p of ids) for (const q of ids) if (p < q && p.split(':')[0] === q.split(':')[0] && !(GUN_STATS as any[]).some(S => Math.abs(bars[p][S.id] - bars[q][S.id]) >= 0.1)) near.push(`${p} = ${q}`);
    F.verdict(ids.length >= 6 && !near.length && ids.every(k => range(bars[k])), 'every gun a row offers has four bars inside the track, and no two guns of a slot are within a tenth on all four', near.length ? near.join(' · ') : ids.map(k => `${k.split(':')[1]} ${(GUN_STATS as any[]).map(S => f2(bars[k][S.id])).join('/')}`).join(' · '));
    issue(); const d1 = K.kitSlotDef(0, K.KIT.members[0], 'primary'); K.kitSet(0, 'suppressed', false); const d0 = K.kitSlotDef(0, K.KIT.members[0], 'primary');
    F.verdict(!!d1 && !!d0 && gunStats(d0).quiet < gunStats(d1).quiet && gunStats(d0).reach === gunStats(d1).reach, 'the suppressor off your primary: its quiet bar drops and nothing else moves', d1 && d0 ? `quiet ${f2(gunStats(d1).quiet)} → ${f2(gunStats(d0).quiet)}` : 'no row');
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── sponge
export async function kittreeSponge(): Promise<boolean> {
  const F = family('kittree-sponge: sponge rounds are a row, and only a quiet run is handed them');
  await kept(async () => {
    const R: any = await hushed(() => rig(17, { stage: false })); raise(true); issue(); const g = R.game, pl = () => g.player;
    const quiet = (on: boolean) => { K.KIT_SOLO.on = on; if (on) g.guards = g.guards.filter((gd: any) => !(gd.unit && gd.team === 'operative')); };
    const r = row(0, 'rings'), issued = K.kitDefault(0).rings;
    F.verdict(!!r && issued === 0 && [0, 1, 2, 3, 4].every(i => K.kitDefault(i).rings === 0), 'a Sponge rounds row is on your card, and nobody is issued one', `row: ${r ? `${r.label} ${J(r.values)}` : 'none'} · issued ${[0, 1, 2, 3, 4].map(i => K.kitDefault(i).rings).join(' ')}`);
    quiet(false); K.kitPlayer(g); const loud = { rings: pl().rifle.rings, load: pl().rifle.attachment, tube: pl().rifle.attachments.includes('ring') };
    quiet(true); K.kitPlayer(g); const still = { rings: pl().rifle.rings, load: pl().rifle.attachment };
    F.verdict(loud.tube && loud.rings === 0 && loud.load !== 'ring' && still.rings === KITTREE.lend, 'deployed as issued: no sponge round on a loud mission (the right button is on the tube\'s first load you do carry), the launcher\'s five on a quiet or solo one',
      `loud: ${loud.rings} rounds, the tube on '${loud.load}' · quiet: ${still.rings} rounds, the tube on '${still.load}'`);
    // picked: counted against the pouches like any other thing, and what a loud deploy carries
    issue(); quiet(false); const p0 = K.kitCost(0).used; K.kitSet(0, 'smoke', 0); K.kitSet(0, 'frags', 0); const took = K.kitSet(0, 'rings', 2), p2 = K.kitCost(0); K.kitPlayer(g);
    F.verdict(took && pl().rifle.rings === 2 && p2.lines.some((l: any) => /rings|sponge/i.test(l.item) && l.n === 2 && l.pouches === 2), 'two picked in place of the smoke and the frag: two pouches, and two in the tube on a loud deploy', `pouches ${p0} as issued → ${p2.used} / ${p2.total} · ${p2.lines.map((l: any) => `${l.n} ${l.item} = ${l.pouches}`).join(', ')} · deployed with ${pl().rifle.rings}`);
    quiet(true); K.kitPlayer(g); F.verdict(pl().rifle.rings === KITTREE.lend, '… and on a quiet run the mission\'s five stand over the two', `${pl().rifle.rings} rounds`);
    // your light and goggles rows are what you deploy with
    issue(); quiet(false); K.kitPlayer(g); const on = { l: K.kitYouLight(pl()), n: K.kitYouNvg(pl()) };
    K.kitSet(0, 'light', false); K.kitSet(0, 'nvg', false); K.kitPlayer(g); const off = { l: K.kitYouLight(pl()), n: K.kitYouNvg(pl()) };
    F.verdict(on.l && on.n && !off.l && !off.n, 'your card without the light and the goggles: L and N have nothing to switch (with them, as before)', `fitted: light ${on.l} goggles ${on.n} · taken off: light ${off.l} goggles ${off.n}`);
    issue(); K.kitPlayer(g);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function kittreeOff(): Promise<boolean> {
  const F = family('kittree-off: the switch off is the card and the run of the build before');
  await kept(async () => {
    const sig = (i: number) => rows(i).map(r => `${r.field}:${r.label}:${J(r.values)}:${r.under !== undefined}`);
    raise(false); issue(); const before = [0, 1, 2, 3, 4].map(sig); raise(true); const tree = [0, 1, 2, 3, 4].map(sig); raise(false); const after = [0, 1, 2, 3, 4].map(sig);
    F.verdict(J(before) === J(after) && before.every(s => s.every(x => x.endsWith(':false'))) && tree.every(s => s.some(x => x.endsWith(':true'))), 'the rows with the switch off are the build before\'s, word for word, before and after it was up; on, every card has rows under a gun',
      `off, you: ${before[0].map(x => x.split(':')[0]).join(' ')}\n    on, you:  ${tree[0].map(x => `${x.split(':')[0]}${x.endsWith(':true') ? '*' : ''}`).join(' ')}   (* under a gun)`);
    const run = async (on: boolean) => {
      const R: any = await hushed(() => rig(17, { stage: false })); raise(on); const g = R.game; R.RC.start(17); const hashes: string[] = [];
      for (let i = 0; i < 600; i++) { R.step(); if (i % 150 === 149) hashes.push(hashDigest(digestGame(g, true))); }
      return { hashes, rings: g.player.rifle.rings };
    };
    const a = await run(false), b = await run(false), c = await run(true);
    F.verdict(J(a.hashes) === J(b.hashes) && a.rings === 5 && c.rings === 0, 'ten seconds of the staged room clear, switch off: the same run twice, five sponge rounds in the launcher as ever; on, a loud room clear starts with none', `off: ${a.hashes.join(' ')} (${a.rings} rounds)\n    off: ${b.hashes.join(' ')}\n    on:  ${c.hashes.join(' ')} (${c.rings} rounds)`);
    const reg = knobRegistry(), page = /KITTREE\.on = !q\.has\('nokittree'\)/.test(await Bun.file(`${ROOT}/src/host/profile.ts`).text());
    F.verdict('KITTREE.on' in FROZEN_HOLDS && reg.KITTREE === KITTREE && page, 'the switch is one of the two stands\' rows, in the knob registry, and the page writes it on unless ?nokittree', `frozen hold: ${FROZEN_HOLDS['KITTREE.on']} · registered ${reg.KITTREE === KITTREE} · pageSwitches writes it: ${page}`);
    const R: any = await hushed(() => rig(17, { stage: false })); KITTREE.on = true; const snap = knobsSnapshot(R.game); const has = !!snap.tables.KITTREE; delete snap.tables.KITTREE; applyKnobs(R.game, snap);
    F.verdict(has && KITTREE.on === false, 'a recording carries the table, and one from before it replays with the switch off', `carried ${has} · after a file without it: on = ${KITTREE.on}`);
  });
  return F.done();
}

if (import.meta.main) {
  const all = [await kittreeRows(), await kittreeGuns(), await kittreeSponge(), await kittreeOff()];
  process.exit(all.every(Boolean) ? 0 : 1);
}
