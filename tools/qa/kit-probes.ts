// The 'kit' family (each member's kit and uniform — game/kit.ts, ui/kitCard.ts), run through probes.ts:
//   bun run tools/qa/probes.ts kit | kit-table | kit-stage | kit-card | kit-identity | kit-play
// PASS / FAIL each, all headless; nothing here looks at a picture (the card is the real memberCard on a fake DOM: what it puts on the page, not how it looks).
//   kit-table     the table as data: five members issued as the build was; every row's values step round and back; a set is exactly its card; a hand-typed
//                 store is made safe; what is kept is what is read back; the squad's count as a loadout screen would show it
//   kit-stage     cards changed, a scenario staged (room clear with four, the night breach's pair, the hostage rescue): each staged man carries the weapon row
//                 his card names and wears its two colours, a man with no light never lights one through six seconds of the run, a man with no goggles wears
//                 none, the squad's stun canisters and charges are the issued count moved by the cards, your own rifle / canisters / colours are your card's;
//                 a restart stages the same men again; back as issued (and with the table off) the staged men are the build's
//   kit-pool      the squad's counted stun canisters and charges at every size, none to four, on three scenarios, as issued and with cards changed: the
//                 number the real loadout screen shows (ui/loadout.ts on a fake DOM), kitPool(size) and what the staged run's door tools hold are one
//                 number, at the start and after a restart; as issued a pair, a three and a four hold the game's three and two, one man his own two and one
//   kit-card      the real memberCard on a fake DOM for all five: one line per row with its value and what it changes, a click on a row's arrows and the
//                 A / D / arrow keys change the table, W / S move, the sets are buttons, Esc hands back; no row asks for a held key or a digit
//   kit-identity  one seeded run of two scenarios with every card as issued digests as the same run with the table switched off (the build before the file:
//                 the cross-build comparison against the base commit is on kit.md, not here)
//   kit-play      the quiet set and the loud set on everybody, and a mixed squad, each played to its end on the room clear with four: no exception, the men
//                 keep the guns their cards gave them to the last frame, and a man with no light fitted never lit one
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { El, withDom } from './scenario-picker-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const { KIT, KIT_MEMBERS, KIT_LS, SUITS, TRIMS, CAN_MIXES } = K;
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery, teamOf } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { nvgWorn } = await import(`${ROOT}/src/game/nvg.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { gearText } = await import(`${ROOT}/src/game/gear.ts`);   // (the pistol's name on a card is the issue kit's: asked for as the card words it)
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function levelOfFile(file: string): any { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); }
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const c3 = (v: number[]) => `[${v.map(x => +x.toFixed(3)).join(', ')}]`;
/** every card back as issued, the table on, nothing kept anywhere (each probe starts and ends here: KIT is a module singleton the runner does not snapshot) */
function issued() { K.kitLoad(null, ''); K.kitReset(); }
/** as issued with the POUCHES rule switched off (?noslots): every row free, the table the kit goal shipped. The probes below that change counts freely run so —
 *  what they hold is the table, the staging and the pool, whatever slots.json prices; the rule itself is kit-pouch-probes.ts's (family 'pouches') */
function free() { K.kitLoad(null, '?noslots'); K.kitReset(); }
/** a Map-backed store, as the page's localStorage */
function memStore(seed?: string) { const m = new Map<string, string>(); if (seed !== undefined) m.set(KIT_LS, seed); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }

// ───────────────────────────────────────────────────────────── table ───────────────────────────────────
export async function kitTable(): Promise<boolean> {
  const F = family('kit-table: the table as data');
  issued();
  try {
    const M = KIT.members as any[];
    F.verdict(M.length === KIT_MEMBERS && KIT_MEMBERS === 5 && M.every((m, i) => !K.kitChanged(i) && m.weapon === 'rifle' && m.suppressed && m.light && m.nvg && m.suit === 'issued' && m.trim === 'issued' && (i > 0 || (m.smoke === 1 && m.bangs === 1 && m.frags === 1 && m.shells === 1 && K.kitCost(0).used === K.kitCost(0).total && K.kitCost(0).total === K.kitCost(1).total)) && K.kitGun(m) === 'fn2000')
      && (free(), !K.kitChanged(0) && (M[0] as any).smoke === CAN_MIXES.issued.smoke && (M[0] as any).bangs === CAN_MIXES.issued.stun) && (issued(), !K.kitChanged(0) && (M[0] as any).smoke === 1),   // (you, under the pouches rule: a teammate's four pouches, one of each of your four things — slots.json v6, the maintainer 10-10; with the rule off, the build's split of six as before)
      'five members (you + four), every one issued the build\'s kit: the suppressed FN2000, a light, goggles, the scenario\'s own colours — you one smoke, one stun, one frag and one 40 mm round in as many pouches as a teammate has (the build\'s 4 smoke, 2 stun with the pouches rule off)', M.map((_m, i) => `${K.kitName(i).title}: ${K.kitWords(i)}`).join(' | '));
    F.verdict(M.slice(1).reduce((s, m) => s + m.bangs, 0) === DOORTOOLS.bangs && M.slice(1).reduce((s, m) => s + m.charges, 0) === DOORTOOLS.charges && M[1].bangs + M[2].bangs === DOORTOOLS.bangs && M[1].charges + M[2].charges === DOORTOOLS.charges
      && [2, 3, 4].every(n => K.kitPool(n).bangs === DOORTOOLS.bangs && K.kitPool(n).charges === DOORTOOLS.charges) && K.kitPool(1).bangs === M[1].bangs && K.kitPool(1).charges === M[1].charges,
      'the issued stun canisters and charges on the cards add up to the squad\'s count, for the pair, the three and the four; one man alone carries his own', `cards ${M.slice(1).map(m => `${m.bangs}/${m.charges}`).join(' ')} · DOORTOOLS ${DOORTOOLS.bangs}/${DOORTOOLS.charges} · kitPool(2) ${JSON.stringify(K.kitPool(2))} kitPool(4) ${JSON.stringify(K.kitPool(4))}`);
    // FROM HERE THE FREE ROWS (the pouches rule off): every row steps through each of its values and comes round; back the other way it returns
    free();
    let stepped = 0, bad: string[] = []; const you = 6 + ['wand', 'cams', 'charges', 'walls'].filter(f => K.kitRows(0).some((r: any) => r.field === f)).length;   // (the optical wand is a row of your card while its switch is on — wand.ts, stickycam.ts — and so are your charge rows while theirs is: owncharge.ts)
    for (let i = 0; i < KIT_MEMBERS; i++) for (const r of K.kitRows(i)) {
      const seen: unknown[] = []; for (let n = 0; n < r.values.length; n++) seen.push(K.kitStep(i, r.field, 1));
      const def = K.rowGet(r, K.kitDefault(i)), d = r.values.indexOf(def), n = r.values.length;
      const round = d >= 0 && new Set(seen).size === n && seen[n - 1] === def;
      const back = K.kitStep(i, r.field, -1), fwd = K.kitStep(i, r.field, 1);
      const words = r.values.every((v: any) => typeof r.word(v) === 'string' && r.word(v).length > 0) && typeof r.note(M[i]) === 'string' && r.note(M[i]).length > 0;
      if (!round || back !== r.values[(d - 1 + n) % n] || fwd !== def || !words || n < 2) bad.push(`${i}.${r.field}`);
      stepped++;
    }
    F.verdict(stepped === you + 4 * 11 && !bad.length && !M.some((_m, i) => K.kitChanged(i)), 'the free rows (pouches rule off): every row of every card has two or more values, words for each, steps round them and back, and ends where it began', `${stepped} rows (you ${you}, each teammate 11)${bad.length ? ` · bad: ${bad.join(' ')}` : ''}`);
    F.verdict(K.kitRows(0).every((r: any) => ['weapon', 'cans', 'frags', 'shells', 'cams', 'charges', 'walls', 'wand', 'suit', 'trim'].includes(r.field)) && ['weapon', 'suppressed', 'light', 'nvg', 'bangs', 'smoke', 'charges', 'frags', 'shield', 'suit', 'trim'].every(f => K.kitRows(1).some((r: any) => r.field === f)),
      'your card has no row for what is not a choice of yours (both your guns are suppressed, your light and goggles are on their own keys); a teammate\'s has the eleven', `you: ${K.kitRows(0).map((r: any) => r.label).join(', ')} · teammate: ${K.kitRows(1).map((r: any) => r.label).join(', ')}`);
    // the four guns a card can name are four real, enabled rows
    const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
    const guns = [[true, 'rifle'], [false, 'rifle'], [true, 'pistol'], [false, 'pistol']].map(([s, w]) => K.kitGun({ ...K.kitDefault(1), suppressed: s, weapon: w }));
    F.verdict(new Set(guns).size === 4 && guns.every(id => WEAPONS[id]?.enabled) && WEAPONS[guns[0]].suppressed && !WEAPONS[guns[1]].suppressed && WEAPONS[guns[2]].suppressed && !WEAPONS[guns[3]].suppressed && WEAPONS[guns[2]].cls === 'pistol' && WEAPONS[guns[3]].cls === 'pistol',
      'weapon and suppressor name four different enabled rows of weapons.ts, each suppressed exactly when the card says so', guns.map(id => `${id} (${WEAPONS[id].cls}, ${WEAPONS[id].suppressed ? 'suppressed' : 'bare'}, report level ${WEAPONS[id].report.level})`).join(' · '));
    // the sets
    for (let i = 0; i < KIT_MEMBERS; i++) K.kitPreset(i, 'quiet');
    const q = M.map((_m, i) => K.kitPresetOf(i)), qm = { ...KIT.members[2] } as any, qGun = K.kitGun(qm);
    for (let i = 0; i < KIT_MEMBERS; i++) K.kitPreset(i, 'loud');
    const l = M.map((_m, i) => K.kitPresetOf(i)), lm = { ...KIT.members[2] } as any, lGun = K.kitGun(lm), lPool = K.kitPool(4);
    K.kitStep(2, 'suit', 1); const off = K.kitPresetOf(2);
    for (let i = 0; i < KIT_MEMBERS; i++) K.kitPreset(i, 'issued');
    F.verdict(q.every(x => x === 'quiet') && l.every(x => x === 'loud') && off === null && KIT.members.every((_m: any, i: number) => K.kitPresetOf(i) === 'issued' && !K.kitChanged(i)) && qGun === 'fiveseven' && !qm.light && lGun === 'aks74u' && lm.light && lPool.bangs > DOORTOOLS.bangs,
      'the three sets: a press makes a card exactly that set (and the card knows it), a row changed after is no set, as issued is the build', `quiet teammate: ${qGun}, light ${qm.light}, ${qm.suit}/${qm.trim} · loud teammate: ${lGun}, light ${lm.light}, ${lm.suit}/${lm.trim}, squad count ${lPool.bangs}/${lPool.charges}`);
    // the store: kept as changed, read back, and a hand-typed one made safe
    const st = memStore(); K.kitLoad(st, '?noslots');
    K.kitSet(1, 'weapon', 'pistol'); K.kitSet(1, 'suit', 'olive'); K.kitStep(3, 'light', 1); K.kitSet(0, 'cans', 'stun');
    const refused = K.kitSet(1, 'weapon', 'bazooka') === false && K.kitSet(0, 'light', false) === false && (KIT.members[1] as any).weapon === 'pistol';
    const kept = st.m.get(KIT_LS) ?? ''; issued();
    K.kitLoad(memStore(kept), '?noslots');
    const back = (KIT.members[1] as any).weapon === 'pistol' && (KIT.members[1] as any).suit === 'olive' && (KIT.members[3] as any).light === false && (KIT.members[0] as any).smoke === CAN_MIXES.stun.smoke && (KIT.members[0] as any).bangs === CAN_MIXES.stun.stun && !K.kitChanged(2) && !K.kitChanged(4);
    K.kitLoad(memStore(JSON.stringify({ v: 1, members: [{ weapon: 'tank', cans: 7, suit: 'pink' }, { bangs: 99, charges: -1, light: 'yes', suit: 'desert' }, null, 'x'] })), '?noslots');
    const safe = !K.kitChanged(0) && (KIT.members[1] as any).suit === 'desert' && (KIT.members[1] as any).bangs === K.kitDefault(1).bangs && (KIT.members[1] as any).light === true && !K.kitChanged(2) && !K.kitChanged(3) && !K.kitChanged(4);
    K.kitLoad(memStore('{not json'), '?noslots'); const junk = KIT.members.every((_m: any, i: number) => !K.kitChanged(i));
    K.kitLoad(memStore(kept), '?nokit&noslots'); const offUrl = KIT.on === false; K.kitLoad(null, '');
    F.verdict(refused && back && safe && junk && offUrl && KIT.on === true, 'a change is kept (twopointsix.kit) and read back at the next boot; a value a row does not offer is refused; a hand-typed or broken store comes back as issued field by field; ?nokit switches the table off',
      `kept ${kept.length} bytes · refused ${refused} · read back ${back} · made safe ${safe} · broken JSON as issued ${junk} · ?nokit off ${offUrl}`);
  } finally { issued(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── stage ───────────────────────────────────
export async function kitPoolAgree(): Promise<boolean> {
  const F = family('kit-pool: the squad\'s count on the loadout screen is the run\'s, at every size');
  issued();
  const UI = await import(`${ROOT}/src/ui/loadout.ts`);
  const tables: [string, () => void][] = [
    ['every card as issued', () => {}],
    ['cards changed, pouches rule off (1: three stun · 2: no charge · 3: two charges · 4: one stun)', () => { K.kitSet(1, 'bangs', 3); K.kitSet(2, 'charges', 0); K.kitSet(3, 'charges', 2); K.kitSet(4, 'bangs', 1); }],
  ];
  try {
    for (const [label, set] of tables) {
      for (const id of ['room-clear-four', 'night-breach', 'hostage-rescue']) {
        (label.startsWith('every') ? issued : free)(); set();
        const E = (SCENARIOS as any[]).find(e => e.id === id), rows: string[] = []; let ok = true;
        for (let n = 0; n <= 4; n++) {
          const want = K.kitPool(n);
          const shown = await withDom('', async () => { const host = new El('BODY') as any, S = UI.openLoadout(E, { host, squad: n, deploy: () => {} }); const p = S.pool(), words = host.all((x: El) => x.cls.has('lo-pool'))[0]?.textContent ?? '', size = S.squad; S.back(); return { p, words, size }; });
          const S = await stageOf(id, 0, 0x51c4, n); S.g.doorTools.sync(); const men = teamOf(S.g).length, run = { b: S.g.doorTools.bangs, c: S.g.doorTools.charges, f: S.g.doorTools.frags };
          S.restart(); S.g.doorTools.sync(); const again = { b: S.g.doorTools.bangs, c: S.g.doorTools.charges, f: S.g.doorTools.frags };
          const good = shown.size === n && men === n && (n === 0 ? shown.words === '' : shown.p.bangs === want.bangs && shown.p.charges === want.charges && run.b === want.bangs && run.c === want.charges && again.b === run.b && again.c === run.c && shown.p.frags === want.frags && run.f === want.frags && again.f === run.f && shown.words === `Squad carries · ${run.b} stun · ${run.c} charge${run.c === 1 ? '' : 's'} · ${run.f} frag${run.f === 1 ? '' : 's'}`);
          ok &&= good; rows.push(`${n}: ${n === 0 ? 'no squad, no count' : `screen ${shown.p.bangs}/${shown.p.charges}/${shown.p.frags} run ${run.b}/${run.c}/${run.f} restart ${again.b}/${again.c}/${again.f}`}${good ? '' : ' ✗'}`);
        }
        const P = [1, 2, 3, 4].map(n => K.kitPool(n)), asIssued = label.startsWith('every') ? P[0].bangs === 2 && P[0].charges === 1 && P[0].frags === 1 && P.slice(1).every(p => p.bangs === DOORTOOLS.bangs && p.charges === DOORTOOLS.charges && p.frags === 2) : P[3].bangs === 5 && P[3].charges === 3 && P[3].frags === 2;
        F.verdict(ok && asIssued, `${id}, ${label}: at every size the loadout screen's count, kitPool and the staged run's door tools are one number (stun/charges/frags), a restart included`, rows.join(' · '));
      }
    }
  } finally { issued(); }
  return F.done();
}

/** the solo night wears your card once the page says so (main.ts on ?solo → kitSolo), a restart keeps it, and nothing wears anything until then */
export async function kitSoloNight(): Promise<boolean> {
  const F = family('kit-solo: the plain solo night wears your own card when it was started through the loadout screen (?solo), and only then');
  free();
  try {
    Math.random = seeded(0x51c4);
    const W = await quiet(() => standUp({ uploadEvery: 4 })), g = W.game;
    const plain = samOf(g);
    K.kitSet(0, 'weapon', 'pistol'); K.kitSet(0, 'cans', 'smoke'); K.kitSet(0, 'suit', 'black'); K.kitSet(0, 'trim', 'amber');
    g.restartEncounter(); const untouched = samOf(g);
    // (the SHIPPED stand's plain game IS the page's ?solo night — kit.ts kitSoloStand, raised by profile.ts shippedBoot — so there the changed card is on the fresh
    // player at a restart, by that rule; the page's Start on the card, which wears nothing of yours, is what the frozen stand plays)
    if (K.KIT_SOLO.stand) F.verdict(K.KIT_SOLO.on === true && untouched.rifle === false && JSON.stringify(plain) !== JSON.stringify(untouched), 'the shipped stand plays the page\'s ?solo night: a plain game wears your card, and a changed card is on the fresh player at a restart', JSON.stringify(untouched));
    else F.verdict(JSON.stringify(plain) === JSON.stringify(untouched) && K.KIT_SOLO.on === false, 'a changed card alone moves nothing on the plain night (Start on the card is as it ever was): a restart builds the same player', JSON.stringify(untouched));
    K.kitSolo(g); const worn = samOf(g);
    for (let i = 0; i < 30; i++) W.step(DT);
    g.restartEncounter(); const again = samOf(g);
    const want = { rifle: false, smoke: CAN_MIXES.smoke.smoke, stun: CAN_MIXES.smoke.stun, tint: [...SUITS.black.tint].map((x: number) => +x.toFixed(3)), tint2: [...TRIMS.amber.tint].map((x: number) => +x.toFixed(3)) };
    const is = (s: any) => s.rifle === want.rifle && s.slot !== 'rifle' && s.smoke === want.smoke && s.stun === want.stun && same(s.tint, want.tint) && same(s.tint2, want.tint2);
    F.verdict(is(worn) && is(again), 'kitSolo (the page on ?solo) puts your card on the player — the rifle left at home, the cans split, both colours — and a restart\'s fresh player wears it again', `worn ${JSON.stringify(worn)} · after a restart ${JSON.stringify(again)}`);
    K.KIT_SOLO.on = false; free(); g.restartEncounter(); const off = samOf(g);
    F.verdict(JSON.stringify(off) === JSON.stringify(plain), 'as issued (and the switch down) the plain night\'s player is the one it always was', JSON.stringify(off));
  } finally { K.KIT_SOLO.on = false; issued(); }
  return F.done();
}

interface ManShot { i: number; name: string; gun: string; rig: string; tint: number[]; tint2: number[]; light: boolean; unitLight: boolean; lit: number; goggles: boolean; alive: boolean }
/** stand a Game up on a scenario's level, start it, and say who stands there; then run `secs` of it counting the frames each man's light burned */
async function stageOf(id: string, secs = 0, seed = 0x51c4, squad?: number): Promise<{ W: any; g: any; men: () => ManShot[]; run: (s: number) => void; restart: () => void }> {
  const E = (SCENARIOS as any[]).find(e => e.id === id); if (!E) throw new Error(`no scenario '${id}'`);
  Math.random = seeded(seed);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game; g.godMode = true;
  const q = new URLSearchParams(scenarioQuery(E)); if (squad !== undefined) { q.delete('squad4'); q.set('squad', String(squad)); }   // (a size other than the scenario's own: the loadout screen's ?squad=N)
  const { why } = await quiet(() => startFromQuery(g, q)); if (why) throw new Error(`${id}: start refused — ${why}`);
  const lit = new Map<any, number>();
  const run = (s: number) => { for (let f = 0; f < Math.round(s / DT); f++) { W.step(DT); for (const gd of teamOf(g)) if (gd.flashlight.enabled) lit.set(gd, (lit.get(gd) ?? 0) + 1); } };
  const men = (): ManShot[] => teamOf(g).map((gd: any) => ({ i: K.kitIndex(gd), name: gd.callsign, gun: gd.weapon.def.id, rig: gd.weapon.def.rig, tint: [...gd.char.tint], tint2: [...gd.char.tint2], light: gd.lightDeadUntil !== Infinity, unitLight: !!gd.unit?.light, lit: lit.get(gd) ?? 0, goggles: nvgWorn(g, gd), alive: gd.state !== 'dead' }));
  if (secs) await quiet(() => run(secs));
  return { W, g, men, run: s => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { run(s); } finally { console.log = log; console.error = err; console.warn = warn; } }, restart: () => { lit.clear(); const log = console.log; console.log = () => {}; try { g.restartEncounter(); } finally { console.log = log; } } };
}
const manWords = (m: ManShot) => `${m.i} ${m.name}: ${m.gun}, suit ${c3(m.tint)} trim ${c3(m.tint2)}, ${m.light ? `light (lit ${m.lit} frames)` : `no light (lit ${m.lit})`}, ${m.goggles ? 'goggles' : 'bare eyes'}`;

export async function kitStage(): Promise<boolean> {
  const F = family('kit-stage: a changed card is on the staged man (the free rows: pouches rule off)');
  free();
  try {
    // the build's men, for the comparison (table off = this file never touches anybody)
    KIT.on = false; const base4 = await stageOf('room-clear-four', 6); const B = base4.men(), bPool = { b: base4.g.doorTools.bangs, c: base4.g.doorTools.charges }, bSam = samOf(base4.g); KIT.on = true;
    const as4 = await stageOf('room-clear-four', 6); const A = as4.men(), aPool = { b: as4.g.doorTools.bangs, c: as4.g.doorTools.charges }, aSam = samOf(as4.g);
    F.verdict(A.length === 4 && JSON.stringify(A.map(strip)) === JSON.stringify(B.map(strip)) && aPool.b === bPool.b && aPool.c === bPool.c && JSON.stringify(aSam) === JSON.stringify(bSam) && A.every((m, k) => m.i === k + 1),
      'every card as issued: the four staged men, the squad\'s count and you are the same as with the table switched off', `${A.map(manWords).join(' | ')} · squad ${aPool.b} stun ${aPool.c} charges · you: ${JSON.stringify(aSam)}`);

    // THE CHANGED SQUAD: 1 the bare carbine in olive with amber trim and one more stun canister · 2 the suppressed pistol, no light, no goggles, desert tan ·
    // 3 the bare 9 mm with two charges · 4 as issued · you: the pistol alone, 2 smoke 4 stun, navy with white trim
    K.kitSet(1, 'suppressed', false); K.kitSet(1, 'suit', 'olive'); K.kitSet(1, 'trim', 'amber'); K.kitSet(1, 'bangs', 3);
    K.kitSet(2, 'weapon', 'pistol'); K.kitSet(2, 'light', false); K.kitSet(2, 'nvg', false); K.kitSet(2, 'suit', 'desert');
    K.kitSet(3, 'weapon', 'pistol'); K.kitSet(3, 'suppressed', false); K.kitSet(3, 'charges', 2);
    K.kitSet(0, 'weapon', 'pistol'); K.kitSet(0, 'cans', 'stun'); K.kitSet(0, 'suit', 'navy'); K.kitSet(0, 'trim', 'white');
    const S = await stageOf('room-clear-four'); const C0 = S.men(), pool0 = { b: S.g.doorTools.bangs, c: S.g.doorTools.charges };
    S.run(6); const C = S.men(), pool = { b: S.g.doorTools.bangs, c: S.g.doorTools.charges }, sam = samOf(S.g);
    const want = ['aks74u', 'fiveseven', 'guard9mm', 'fn2000'];
    F.verdict(C.length === 4 && C0.every((m, k) => m.gun === want[k]) && C.every((m, k) => m.gun === want[k]),
      'each staged man carries the weapon row his card names, at staging and six seconds into the run (the row is dealt off his route every frame)', C.map(m => `${m.i} ${m.name}: ${m.gun} (${m.rig} rig)`).join(' · '));
    F.verdict(same(C[0].tint, SUITS.olive.tint) && same(C[0].tint2, TRIMS.amber.tint) && same(C[1].tint, SUITS.desert.tint) && same(C[1].tint2, B[1].tint2) && same(C[2].tint, B[2].tint) && same(C[2].tint2, B[2].tint2) && same(C[3].tint, B[3].tint) && same(C[3].tint2, B[3].tint2),
      'each wears his card\'s colours: suit and trim where chosen, the scenario\'s own where the card says as issued', C.map(m => `${m.i}: suit ${c3(m.tint)} trim ${c3(m.tint2)}`).join(' · ') + ` · the build's: ${B.map(m => `${c3(m.tint)}/${c3(m.tint2)}`).join(' ')}`);
    F.verdict(!C[1].light && C[1].lit === 0 && C[0].light && C[2].light && C[3].light, 'the man with no light fitted has the one switch every light rule yields to thrown (lightDeadUntil = never); the others have not (a staged squad stands dark until its first order: whether a light ever BURNS is kit-play\'s, where there is a fight)', `fitted: ${C.map(m => `${m.i}: ${m.light}`).join(' · ')} · lit frames while staged: ${C.map(m => m.lit).join(' ')}`);
    F.verdict(!C[1].goggles && C[0].goggles === B[0].goggles && C[2].goggles === B[2].goggles && C[3].goggles === B[3].goggles, 'the man with no goggles wears none; the others as the build', `goggles worn: ${C.map(m => `${m.i}: ${m.goggles}`).join(' · ')} (the build's: ${B.map(m => m.goggles).join(' ')})`);
    F.verdict(pool0.b === bPool.b + 1 && pool0.c === bPool.c + 2 && pool.b <= pool0.b && pool.c <= pool0.c && K.kitPool(4, { bangs: DOORTOOLS.bangs, charges: DOORTOOLS.charges }).bangs === pool0.b && K.kitPool(4).charges === pool0.c,
      'the squad\'s counted stun canisters and charges are the issued count moved by the cards (+1 stun on teammate 1, +2 charges on teammate 3), and still that after the door tools have counted the cast in', `issued ${bPool.b}/${bPool.c} · staged ${pool0.b}/${pool0.c} · six seconds on ${pool.b}/${pool.c} · kitPool(4) ${JSON.stringify(K.kitPool(4))}`);
    F.verdict(sam.rifle === false && sam.slot !== 'rifle' && sam.smoke === CAN_MIXES.stun.smoke && sam.stun === CAN_MIXES.stun.stun && same(sam.tint, SUITS.navy.tint) && same(sam.tint2, TRIMS.white.tint) && bSam.rifle === true,
      'you: the rifle left at home, the canisters split as the card says, the two colours on', `you ${JSON.stringify(sam)} · the build's ${JSON.stringify(bSam)}`);
    // what another module reads off a staged man (the squad's silent / loud order): the card he was staged WITH, whatever the table is changed to after
    { const ops: any[] = teamOf(S.g), k = ops.map(gd => K.kitOf(gd)); K.kitSet(2, 'light', true); K.kitSet(1, 'suppressed', true); const after = ops.map(gd => K.kitOf(gd)); K.kitSet(2, 'light', false); K.kitSet(1, 'suppressed', false);
      F.verdict(k.length === 4 && k[0].suppressed === false && k[1].light === false && k[1].suppressed === true && k[3].light === true && k[3].suppressed === true && after[1].light === false && after[0].suppressed === false && K.kitOf(S.g.guards.find((x: any) => x.team !== 'operative')) === null,
        'kitOf(man) is the card he was staged with — light and suppressed plainly named — and stays that when the table is changed mid-run; null for anybody no staging put a card on', k.map((c: any, n: number) => `${n + 1}: light ${c.light}, suppressed ${c.suppressed}`).join(' · ')); }
    // a restart stages again
    S.restart(); const R0 = S.men(), rPool = { b: S.g.doorTools.bangs, c: S.g.doorTools.charges }; S.run(2); const R = S.men(), rSam = samOf(S.g), rPool2 = { b: S.g.doorTools.bangs, c: S.g.doorTools.charges };
    F.verdict(R.length === 4 && R.every((m, k) => m.gun === want[k] && same(m.tint, C[k].tint) && same(m.tint2, C[k].tint2) && m.light === C[k].light) && R[1].lit === 0 && !R[1].goggles && rPool.b === pool0.b && rPool.c === pool0.c && rPool2.b <= pool0.b && rPool2.b >= pool0.b - 1 && JSON.stringify(rSam) === JSON.stringify(sam) && R0.every((m, k) => m.gun === want[k]),
      'a restart stages the same squad again: guns, colours, no light, no goggles, the count, your own kit', `${R.map(manWords).join(' | ')} · squad ${rPool.b}/${rPool.c} · you ${JSON.stringify(rSam)}`);
    // back as issued on the SAME game: the next staging is the build's
    K.kitReset(); S.restart(); S.run(1); const Z = S.men(), zSam = samOf(S.g);
    F.verdict(Z.every((m, k) => m.gun === 'fn2000' && same(m.tint, B[k].tint) && same(m.tint2, B[k].tint2) && m.light) && S.g.doorTools.bangs === bPool.b && S.g.doorTools.charges === bPool.c && zSam.rifle === bSam.rifle && zSam.smoke === bSam.smoke && zSam.stun === bSam.stun && same(zSam.tint, bSam.tint) && same(zSam.tint2, bSam.tint2),
      'the cards put back as issued and the run restarted: the build\'s men, count and you (nothing of the last squad left on anybody)', `${Z.map(manWords).join(' | ')} · squad ${S.g.doorTools.bangs}/${S.g.doorTools.charges} · you ${JSON.stringify(zSam)}`);

    // the pair's scenarios: the night breach and the hostage rescue (its own staging and its own light switch)
    K.kitSet(1, 'weapon', 'pistol'); K.kitSet(1, 'suit', 'jungle'); K.kitSet(1, 'trim', 'red'); K.kitSet(2, 'suppressed', false); K.kitSet(2, 'light', false); K.kitSet(2, 'suit', 'grey'); K.kitSet(2, 'bangs', 0); K.kitSet(3, 'suit', 'khaki'); K.kitSet(3, 'bangs', 3);
    for (const id of ['night-breach', 'hostage-rescue', 'room-clear-pair']) {
      KIT.on = false; const b = await stageOf(id, 3); const bm = b.men(), bp = { b: b.g.doorTools.bangs, c: b.g.doorTools.charges }; KIT.on = true;
      const s = await stageOf(id); const p0 = { b: s.g.doorTools.bangs, c: s.g.doorTools.charges }; s.run(3); const m = s.men();
      F.verdict(m.length === 2 && bm.length === 2 && m[0].gun === 'fiveseven' && same(m[0].tint, SUITS.jungle.tint) && same(m[0].tint2, TRIMS.red.tint) && m[1].gun === 'aks74u' && same(m[1].tint, SUITS.grey.tint) && !m[1].light && m[1].lit === 0 && p0.b === bp.b - 1 && p0.c === bp.c,
        `${id}: the pair carry and wear cards 1 and 2 (cards 3 and 4 are nobody's here: their stun canisters move nothing)`, `${m.map(manWords).join(' | ')} · squad ${p0.b}/${p0.c} (the build's ${bp.b}/${bp.c}; its men: ${bm.map(x => `${x.gun} lit ${x.lit}`).join(', ')})`);
    }
  } finally { issued(); }
  return F.done();
}
const strip = (m: ManShot) => ({ ...m, name: undefined, i: undefined });
function samOf(g: any) { const p = g.player; return { rifle: p.hasRifle, slot: p.slot, smoke: p.canisters, stun: p.flashbangs, tint: [...p.char.tint].map((x: number) => +x.toFixed(3)), tint2: [...p.char.tint2].map((x: number) => +x.toFixed(3)) }; }

// ───────────────────────────────────────────────────────────── card ────────────────────────────────────
const text = (e: El) => e.textContent.replace(/\s+/g, ' ').trim();
const byCls = (root: El, c: string) => root.all(e => e.cls.has(c));
const keyEv = (key: string, code?: string) => { const e = { key, code: code ?? (key === ' ' ? 'Space' : /^\d$/.test(key) ? `Digit${key}` : key.length === 1 ? `Key${key.toUpperCase()}` : key), repeat: false, stopped: false, preventDefault() { this.stopped = true; }, stopPropagation() {} }; return e; };
export async function kitCard(): Promise<boolean> {
  const F = family('kit-card: the member card on a fake DOM');
  issued();
  try {
    await withDom('', async root => {
      const { memberCard } = await import(`${ROOT}/src/ui/kitCard.ts`);
      const hosts = Array.from({ length: KIT_MEMBERS }, (_x, i) => { const h = new El('DIV'); h.setAttribute('data-member', String(i)); root.appendChild(h); return h; });
      let backs = 0, changes = 0;
      const cards = hosts.map((h, i) => memberCard(h as unknown as HTMLElement, i, { onBack: () => { backs++; }, onChange: () => { changes++; } }));
      const rowsOf = (i: number) => byCls(hosts[i], 'kc-row'), valOf = (i: number, f: string) => text(byCls(rowsOf(i).find(r => r.attrs['data-field'] === f)!, 'kc-val')[0]);
      F.verdict(hosts.every((h, i) => rowsOf(i).length === K.kitRows(i).length && rowsOf(i).every((r, k) => r.attrs['data-field'] === K.kitRows(i)[k].field && byCls(r, 'kc-val').length === 1 && byCls(r, 'kc-note').length === 1 && text(byCls(r, 'kc-note')[0]).length > 0 && byCls(r, 'kc-step').length === 2) && text(byCls(h, 'kc-title')[0]) === K.kitName(i).title),
        'five cards, each with its member\'s name and one line per row of his table: label, value, the two arrows, what the value changes', hosts.map((h, i) => `${text(byCls(h, 'kc-title')[0])}: ${rowsOf(i).map(r => `${text(byCls(r, 'kc-label')[0])} = ${text(byCls(r, 'kc-val')[0])}`).join(', ')}`).join(' | '));
      // the mouse: the right arrow of teammate 2's Weapon row, then the left one back
      const wRow = () => rowsOf(2).find(r => r.attrs['data-field'] === 'weapon')!, steps = () => byCls(wRow(), 'kc-step');
      steps()[1].onclick?.(); const w1 = (KIT.members[2] as any).weapon, v1 = valOf(2, 'weapon'), note1 = text(byCls(wRow(), 'kc-note')[0]);
      steps()[0].onclick?.(); const w2 = (KIT.members[2] as any).weapon;
      F.verdict(w1 === 'pistol' && v1 === 'pistol' && note1.includes(gearText('Five-seveN')) && w2 === 'rifle' && changes === 2, 'the mouse: a click on a row\'s right arrow steps it (table, value and note all change), the left arrow steps it back', `after ›: ${w1}, shows '${v1}', note '${note1}' · after ‹: ${w2} · ${changes} change calls`);
      // the keys: S S to the third row (light), D changes it, ArrowLeft changes it back, W up one (suppressor), ArrowRight
      const c1 = cards[1]; c1.focus();
      const at0 = c1.at(); c1.key(keyEv('s')); c1.key(keyEv('ArrowDown')); const at2 = c1.at();
      c1.key(keyEv('d')); const l1 = (KIT.members[1] as any).light; c1.key(keyEv('ArrowLeft')); const l2 = (KIT.members[1] as any).light;
      c1.key(keyEv('w')); const at1 = c1.at(); c1.key(keyEv('ArrowRight')); const s1 = (KIT.members[1] as any).suppressed; c1.key(keyEv('a'));
      const up = (() => { c1.key(keyEv('ArrowUp')); c1.key(keyEv('ArrowUp')); c1.key(keyEv('ArrowUp')); return c1.at(); })();   // (past the top: it stays, or wraps — said below)
      F.verdict(at0 === 0 && at2 === 2 && l1 === false && l2 === true && at1 === 1 && s1 === false && (KIT.members[1] as any).suppressed === true && rowsOf(1)[c1.at()].cls.has('sel'),
        'the keys: W / S and the up / down arrows move the highlighted row, A / D and left / right change its value', `rows ${at0} → ${at2} → ${at1} → ${up} · light D ${l1}, ← ${l2} · suppressor → ${s1}, A back true`);
      // a held key (repeat) and a digit do nothing
      const before = JSON.stringify(KIT.members); const rep = keyEv('d'); rep.repeat = true; c1.key(rep); for (const d of ['1', '5', '6', '9']) c1.key(keyEv(d));
      F.verdict(JSON.stringify(KIT.members) === before, 'a key held down (auto-repeat) changes nothing, and no digit is read', 'D held, then 1 5 6 9: the table as it was');
      // the sets: three buttons a click presses; and reachable by the keys (S down past the last row, Enter)
      const sets = byCls(hosts[3], 'kc-set'); sets.find(b => b.attrs['data-set'] === 'quiet')!.onclick?.(); const setQ = K.kitPresetOf(3), selQ = byCls(hosts[3], 'kc-set').find(b => b.attrs['data-set'] === 'quiet')!.cls.has('on');
      const c4 = cards[4]; c4.focus(); for (let n = 0; n < K.kitRows(4).length; n++) c4.key(keyEv('s')); const onSets = c4.at(); c4.key(keyEv('d')); c4.key(keyEv('d')); c4.key(keyEv('Enter')); const setL = K.kitPresetOf(4); c4.key(keyEv('a')); c4.key(keyEv(' ')); const setQ4 = K.kitPresetOf(4); c4.key(keyEv('a')); c4.key(keyEv('Enter'));
      F.verdict(sets.length === 3 && setQ === 'quiet' && selQ && onSets === K.kitRows(4).length && setL === 'loud' && setQ4 === 'quiet' && K.kitPresetOf(4) === 'issued' && valOf(3, 'weapon') === 'pistol',
        'the sets are three buttons under the rows: a click presses one (and it shows as the card\'s set); by the keys, S past the last row, A / D to pick, Enter or Space to press', `teammate 3 by click: ${setQ} · teammate 4 by keys: ${setL}, then ${setQ4}, then issued`);
      const b0 = backs; c4.key(keyEv('Escape')); const esc = backs - b0, handled = c4.key(keyEv('q'));
      F.verdict(esc === 1 && handled === false, 'Esc hands back to whoever mounted the card; a key that is not the card\'s is left for the page', `Esc called back ${esc} time · 'q' handled: ${handled}`);
      // refresh: the table changed from outside (the loadout screen's own 'all quiet' button, say)
      K.kitPreset(1, 'loud'); const stale = valOf(1, 'suppressed'); c1.refresh(); const fresh = valOf(1, 'suppressed');
      F.verdict(fresh === 'off' && stale === 'on', 'refresh() redraws a card whose table was changed elsewhere', `suppressor shown '${stale}' → '${fresh}' after refresh`);
      for (const c of cards) c.destroy();
      F.verdict(hosts.every(h => h.children.length === 0), 'destroy() leaves the host empty', `${hosts.map(h => h.children.length).join(' ')} children`);
    });
  } finally { issued(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── identity + play ─────────────────────────
export async function kitIdentity(): Promise<boolean> {
  const F = family('kit-identity: as issued is the table switched off');
  // (THE FREE ROWS — the pouches rule off — since slots.json v6: under the rule you are issued one of each of your four things, fewer than a Player is built
  // with, so the staging writes your counts and the digest, which holds them, differs; that run is held in the 'pouches' family — pouch-stage)
  free(); const was = process.env.PT_DIGEST; process.env.PT_DIGEST = '1';
  try {
    const { play } = await import('./playthrough.ts');
    for (const scn of ['room-clear-four', 'hostage-rescue']) {
      KIT.on = true; const a = await play(scn, 2, 240); KIT.on = false; const b = await play(scn, 2, 240); KIT.on = true;
      F.verdict(a.end !== 'error' && !!a.digest && a.digest === b.digest && a.end === b.end && a.t === b.t, `${scn} seed 2: every card as issued (the pouches rule off) digests as the run with the table off`, `${a.end} ${a.t} s team ${a.team}/${a.of} · digest ${String(a.digest).slice(0, 16)} vs ${String(b.digest).slice(0, 16)}${a.end === 'error' ? ` · ${a.why.split('\n')[0]}` : ''}`);
    }
  } finally { if (was === undefined) delete process.env.PT_DIGEST; else process.env.PT_DIGEST = was; issued(); }
  return F.done();
}
export async function kitPlay(): Promise<boolean> {
  const F = family('kit-play: changed squads played to the end');
  issued(); let unwrap = () => {};
  try {
    const { play } = await import('./playthrough.ts');
    // every frame's END: whose light burns (Game.update wrapped for the length of this probe; the men are the last staging's — kit.ts KIT_STAGED)
    const { Game } = await import(`${ROOT}/src/game/game.ts`);
    const update = Game.prototype.update; let lit = [0, 0, 0, 0], frames = 0, stagedN = -1;
    Game.prototype.update = function (this: any, ...a: any[]) { const r = update.apply(this, a); if (K.KIT_STAGED.n !== stagedN) { stagedN = K.KIT_STAGED.n; lit = [0, 0, 0, 0]; frames = 0; } frames++; K.KIT_STAGED.ops.forEach((gd: any, k: number) => { if (gd.state !== 'dead' && gd.flashlight.enabled) lit[k]++; }); return r; };
    unwrap = () => { Game.prototype.update = update; };
    // [name, the cards, each man's gun, each man: a light fitted]
    const squads: [string, () => void, string[], boolean[]][] = [
      ['every card as issued', () => {}, ['fn2000', 'fn2000', 'fn2000', 'fn2000'], [true, true, true, true]],
      ['the quiet set on everybody', () => { for (let i = 0; i < KIT_MEMBERS; i++) K.kitPreset(i, 'quiet'); }, ['fiveseven', 'fiveseven', 'fiveseven', 'fiveseven'], [false, false, false, false]],
      ['the loud set on everybody', () => { for (let i = 0; i < KIT_MEMBERS; i++) K.kitPreset(i, 'loud'); }, ['aks74u', 'aks74u', 'aks74u', 'aks74u'], [true, true, true, true]],
      ['a mixed squad (9 mm, no light + no goggles, issued, bare carbine)', () => { K.kitSet(1, 'weapon', 'pistol'); K.kitSet(1, 'suppressed', false); K.kitSet(2, 'light', false); K.kitSet(2, 'nvg', false); K.kitSet(4, 'suppressed', false); }, ['guard9mm', 'fn2000', 'fn2000', 'aks74u'], [true, false, true, true]],
    ];
    let burned = 0;
    for (const [name, set, guns, fitted] of squads) {
      issued(); set();
      for (const seed of [1, 2]) {
        const r: any = await play('room-clear-four', seed, 300);
        const team: any[] = K.KIT_STAGED.ops, held = team.map(gd => gd.weapon.def.id), dark = lit.filter((n, k) => !fitted[k] && n > 0).length;
        burned += lit.reduce((s, n, k) => s + (fitted[k] ? n : 0), 0);
        F.verdict(r.end !== 'error' && held.length === 4 && held.every((id, k) => id === guns[k]) && dark === 0, `${name}, seed ${seed}: played to its end, every man still on his card's gun, no unfitted light lit in any frame`,
          `${r.end} at ${r.t} s · team ${r.team}/${r.of} · hostiles left ${r.hostiles}/${r.hostilesOf} · ${r.smells.length} smells${r.end === 'error' ? ` · ${r.why.split('\n').slice(0, 2).join(' / ')}` : ''} · held: ${held.join(' ')} · frames lit of ${frames}: ${lit.map((n, k) => `${n}${fitted[k] ? '' : ' (none fitted)'}`).join(' ')}`);
      }
    }
    F.verdict(burned > 0, 'and the check is not empty: fitted lights did burn in these runs', `${burned} man-frames of fitted lights lit over the eight runs`);
  } finally { unwrap(); issued(); }
  return F.done();
}
