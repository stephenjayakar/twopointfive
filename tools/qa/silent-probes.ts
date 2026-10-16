// The 'silent' family (game/silent.ts — the squad's posture on Sam's word: one row on the squad's order menu puts the whole squad in silent, the row that
// stands in its place takes it out). Headless: the whole Game over the fake device, the room clear on the office with its squad of four (or the pair).
//
//   silent-order   the menu: X on the floor / on a man lists "go silent" under 'the whole squad' on 5 (never a digit above 5, nothing held), 5 gives it to
//                  the whole squad whoever was addressed, the row then reads "go loud"; a door's menu keeps 5 for the door tools; the men keep their
//                  orders across it; a build with the word on a digit keeps 5 for the word; the pair has the row too
//   silent-hud     the squad block's header says which of the two, in both states — and nothing with the switch off
//   silent-walk    the same walk loud and silent: silent legs never above SILENT.pace, no light burning, every footfall at the silent level; a hot floor
//                  does not lift the pace (a knob does); the step level a listener — Hard's defenders among them — is handed
//   silent-doors   a locked door: loud boots it, silent (the pick switched off) says so and the order ends on it; an unlocked one is a hand on the leaf, not
//                  a shoulder (a creak for the bash); a silent man's contact with a leaf is a quiet one
//   silent-pick    a silent squad at a locked door: the lead kneels at the keyway and picks it (the player's own pick: its seconds, its clicks, its snap),
//                  then the entry goes on as at an unlocked door; a steel door is refused as ever; told loud mid-pick he stands up and boots it; blinded
//                  mid-pick his hands come off and go back on; what the room's defenders made of the noise
//   silent-cans    a threshold entry with a can going in first at every door: loud spends one, silent keeps the kit whole — on the word too
//   silent-tools   the loud tools stay on the door's menu marked LOUD while silent; picking one (bang and clear at a locked door; bang, then step in on a
//                  held one) does it and takes the squad out of silent with one line
//   silent-fire    defenders who have not noticed the team: loud teammates shoot them, silent ones bring their guns on and hold ('eyes on. holding.');
//                  once the defenders notice, the silent men shoot — and the first loud thing in their ears is said once ('compromised.') and shown on
//                  the HUD's word, the order still standing
//   silent-set     told to stack beside men who have not noticed them, a silent pair on its marks with its rounds held on those men is SET ('set.', the
//                  row's 'stacked') and no hand goes to the handle while the guns are on them (SILENT.stackSet; off = 'stacking', as it was);
//                  SILENTSET_BREAK=1 leaves the key off where a line asks for it on: must fail
//   silent-hush    a silent teammate's line is a radio line; a loud one's is called out; a hostile's is never touched
//   silent-start   SILENT.start stands a fresh squad up silent (and a restart again); the order still takes it out
//   silent-off     never given, the switch on or off: the same scripted minute digests the same every frame; with the switch off there is no row, no word
//                  on the HUD and no rule — even with the state left silent
// The harness stands the game up with SILENT.on false (src/host/standup.ts: the menu and the squad block as every older probe was written against); the rig
// here turns it on, as it ships.
// Two door rules the page ships came after these stagings: an entry halts at a door found shut (DOORTOOLS.testDoor) and 'clear from outside' is one order
// (DOORTOOLS.outsidePlain). The rig holds both OFF on either stand — the loud squad these lines compare against boots a lock on the first order and has the
// threshold's own orders — and the 'page' lines of silent-pick, silent-cans and silent-tools run with both ON: what the silent order does under them.
// The cross-commit identity (the order never given = the base build) is `bun run tools/qa/nvg-probes.ts digest` and the play-throughs, run here and in a
// checkout of the base: the same lines.
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { FLOOR } = await import(`${ROOT}/src/game/floor.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const NVM: any = await import(`${ROOT}/src/game/nvg.ts`);
const SLM: any = await import(`${ROOT}/src/game/silent.ts`);
const SILENT: any = SLM.SILENT;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const DEFAULTS = { DOORTOOLS: clone(DOORTOOLS), ROOMCLEAR: { ...ROOMCLEAR }, NIGHTBREACH: { ...NIGHTBREACH }, SILENT: clone(SILENT), NVG: clone(NVM.NVG), LIGHTS: clone(GDM.LIGHTS) };
const reset = () => { Object.assign(DOORTOOLS, clone(DEFAULTS.DOORTOOLS)); Object.assign(ROOMCLEAR, DEFAULTS.ROOMCLEAR); Object.assign(NIGHTBREACH, DEFAULTS.NIGHTBREACH); Object.assign(SILENT, clone(DEFAULTS.SILENT)); Object.assign(NVM.NVG, clone(DEFAULTS.NVG)); Object.assign(GDM.LIGHTS, clone(DEFAULTS.LIGHTS)); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const AISLE: number[] = [15, 0, 17.6], AISLE_FAR: number[] = [21, 0, 17.6];

interface RigOpts { squad?: 2 | 4; silent?: Record<string, unknown>; doortools?: Record<string, unknown>; empty?: boolean; nvg?: boolean;
  /** the door rules the page ships that this family's stagings were not written on, left ON for this run: an entry halts at a door found shut (DOORTOOLS.testDoor) and
   *  'clear from outside' is one order (DOORTOOLS.outsidePlain). Default: both OFF on either stand — the loud squad every line here is compared against boots a locked
   *  door on the first order and has the threshold's own orders; the lines that say what the silent order does UNDER the two rules ask for them by this. */
  page?: boolean }
/** the room clear on the office, its squad stood up (`empty`: every hostile taken off the floor first — nothing but the orders decides what follows) */
async function rig(seed: number, o: RigOpts = {}) {
  reset(); Object.assign(NIGHTBREACH, { squad: o.squad ?? 4 }); Object.assign(DOORTOOLS, o.doortools ?? {}); if (o.nvg === false) NVM.NVG.on = false;
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input;
  Object.assign(DOORTOOLS, { testDoor: !!o.page, outsidePlain: !!o.page }, o.doortools ?? {});   // (after the stand-up: the shipped stand leaves both on, the frozen one pins both off — this family says which, per run)
  Object.assign(SILENT, { on: true }, o.silent ?? {});   // (the harness stands the game up with the order off the menu — what the older probes were written against; this family is about it on, as shipped)
  const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  const why = RC.start(seed);
  const seen = new Set<any>();
  const R = { W, game, input, RC, NB, O, D, why, said, held: 0, kicks: 0, bangs: 0, opShots: 0, doorNoise: [] as { level: number; loud: boolean; who: number }[], post: null as null | (() => void),
    get team(): any[] { return O.squad(); }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) { for (let i = 0; i < n; i++) {
      game.player.visibility = 0.05;
      R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0));
      W.step(DT);
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e);
        if (e.kind === 'kick') R.kicks++; if (e.kind === 'bang') R.bangs++;
        if (e.kind === 'guardShot' && game.guards.some((x: any) => x.team === 'operative' && x.char.id === e.who)) R.opShots++;
        if (e.kind === 'door') R.doorNoise.push({ level: e.level ?? 0, loud: !!e.loud, who: e.who ?? -1 }); }
      R.post?.(); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    cursor(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); },
    press(code: string) { input.pressed.add(code); R.step(); },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    /** the newest posture change (silent.ts's own log: the order is not one of the orders' log's) */
    turn(): any { return SLM.SILENT_LOG[SLM.SILENT_LOG.length - 1] ?? null; },
    label(): string { return O.hud().status[0]?.label ?? ''; },
    /** X with the cursor on p: the menu's order rows as the panel draws them (the who row and the cancel row left out) — the menu left UP */
    menu(p: number[]) { R.cursor(p); R.press(ORDERS.key); R.step(2);
      const hud = O.hud().menu; return { kind: O.menu?.target.kind as string | undefined, rows: (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ head: r.label as string, key: r.opts[0]?.key as string, text: r.opts[0]?.text as string, off: !!r.off })) }; },
    esc() { for (let i = 0; i < 3 && O.menu; i++) R.press('Escape'); },
    give(id: string, at: number[], who: any = 'all'): string | null { return O.give(id, O.targetAt(at), who); },
    giveDoor(id: string, name: string): string | null { return O.give(id, O.targetAt(R.door(name).frameCentre)); },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => b.what).join(' | '); },
    silent(): boolean { return SLM.squadSilent(game); },
  };
  R.step(30);
  if (o.empty) { for (const h of game.guards) if (h.team === 'hostile' && h.state !== 'dead') killGuard(game, h, [0, 0, 1], true); R.step(60 * 4); }
  return R;
}
const digitAbove5 = (rows: { key: string }[]) => rows.some(r => /^[6-9]$|^0$/.test(r.key));
const rowOf = (rows: { key: string; text: string; head: string }[], text: string) => rows.find(r => r.text === text) ?? null;

// ---------------------------------------------------------------- the order
export const silentOrder = guarded(async () => {
  const { verdict, done } = family('silent-order: one row on the squad\'s menu, on 5, for the whole squad — and the row that takes it out');
  const R = await rig(7); const { O, game } = R; const sam = game.player.char.pos, spot = [sam[0] + 1.6, 0, sam[2]];
  verdict(R.why === null && R.team.length === 4 && !R.silent(), 'the room clear stands its four up loud', `start: ${R.why} · squad ${R.team.length} · ${SLM.silentSummary(game)}`);
  // the floor's menu
  const m1 = R.menu(AISLE), r1 = rowOf(m1.rows, 'go silent');
  verdict(m1.kind === 'floor' && !!r1 && r1.key === '5' && r1.head === 'the whole squad' && !(r1 as any).off && !digitAbove5(m1.rows) && !rowOf(m1.rows, 'go loud'),
    'X on the floor: "go silent" is on 5 under "the whole squad", no digit above 5 on the menu', m1.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | '));
  const n0 = O.log.length, s0 = R.said.length; R.press('Digit5'); R.step(2); const l1 = R.turn(), told = R.said.slice(s0).find((t: string) => /^you: /.test(t)) ?? '';
  verdict(l1?.to === 'silent' && l1.by === 'order' && /gold — go silent/i.test(told) && R.silent() && O.menu === null && R.held === 0,
    '5 gives it: the whole squad is silent, the menu is away, no key was ever held', `${l1?.to} by ${l1?.by} · "${told}" · silent ${R.silent()} · most keys down ${R.held} · said: ${R.said.slice(-2).join(' / ')}`);
  verdict(O.log.length === n0, 'it is not logged as one of Sam\'s orders to the men (a rescue that starts its clock on his first order does not start it on this)', `orders log +${O.log.length - n0}`);
  // … and the row that stands in its place
  const m2 = R.menu(AISLE), r2 = rowOf(m2.rows, 'go loud');
  verdict(!!r2 && r2.key === '5' && !rowOf(m2.rows, 'go silent') && !digitAbove5(m2.rows), 'silent: the same row reads "go loud", on the same digit', m2.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | '));
  R.press('Digit5'); R.step(2); const l2 = R.turn();
  verdict(l2?.to === 'loud' && l2.by === 'order' && !R.silent(), '5 again: loud', `${l2?.to} by ${l2?.by} · silent ${R.silent()}`);
  // a man's menu, and one man addressed
  const m3 = R.menu([sam[0], 1.0, sam[2]]), r3 = rowOf(m3.rows, 'go silent'); R.esc();
  verdict(m3.kind === 'none' && !!r3 && r3.key === '5' && !digitAbove5(m3.rows), 'X on Sam himself: the row is there too, on 5', m3.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | '));
  const s4 = R.said.length, w4 = R.give('silent', spot, 0), told4 = R.said.slice(s4).find((t: string) => /^you: /.test(t)) ?? '';
  verdict(w4 === null && /gold — go silent/i.test(told4) && R.silent() && R.team.every((x: any) => SLM.silentMan(game, x)), 'addressed to one man it is still the squad\'s: all four take it', `refusal ${w4} · "${told4}" · silent men ${R.team.filter((x: any) => SLM.silentMan(game, x)).length}`);
  // a door's menu keeps its 5
  const bw = R.door('breakroom_w'); const m5 = R.menu(bw.frameCentre), five = m5.rows.find((r: any) => r.key === '5'); R.esc();
  verdict(m5.kind === 'door' && !!five && /^door tools/.test(five.text) && !m5.rows.some((r: any) => /go (silent|loud)/.test(r.text)) && !digitAbove5(m5.rows), 'a door\'s menu is as it was: 5 is the door tools, no posture row',
    m5.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | '));
  verdict(R.give('loud', bw.frameCentre) === null && !R.silent(), '… though the order itself fits any target (give with the reticle on a door)', `silent ${R.silent()}`);
  // the men keep what they were doing
  R.give('hold', spot); R.step(20); const before = R.team.map((x: any) => O.of(x)); R.give('silent', spot); R.step(5); const after = R.team.map((x: any) => O.of(x));
  verdict(before.every((a: any, i: number) => !!a && a === after[i] && a.order === 'hold'), 'the men keep the orders they had: the posture moves nobody', after.map((a: any) => a?.order).join(', '));
  R.give('loud', spot);
  // the word on a digit (an older menu's switch): the word keeps 5
  DOORTOOLS.wordOnKey = false; R.step(3); const m6 = R.menu(AISLE), go6 = m6.rows.find((r: any) => /^go( —| ·|$)/.test(r.text)), s6 = rowOf(m6.rows, 'go silent'); R.esc();
  DOORTOOLS.wordOnKey = true; R.step(3); const m7 = R.menu(AISLE), s7 = rowOf(m7.rows, 'go silent'); R.esc();
  verdict(go6?.key === '5' && !!s6 && s6.key === '' && s7?.key === '5' && !digitAbove5(m6.rows), 'a build with the word on a digit keeps 5 for the word (the posture row is then the wheel\'s) — and takes 5 back with the word on its key',
    `word on a digit: ${m6.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | ')} · back: silent row on '${s7?.key}'`);
  // the pair
  const P = await rig(7, { squad: 2 }); const mp = P.menu(AISLE), rp = rowOf(mp.rows, 'go silent'); P.press('Digit5'); P.step(2);
  verdict(P.team.length === 2 && rp?.key === '5' && P.silent() && P.team.every((x: any) => SLM.silentMan(P.game, x)), 'the pair has the same row on the same digit', `${mp.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | ')} · silent ${P.silent()}`);
  return done();
});

// ---------------------------------------------------------------- the HUD
export const silentHud = guarded(async () => {
  const { verdict, done } = family('silent-hud: the squad block says which of the two, at a glance');
  const R = await rig(7); const { game } = R;
  const l0 = R.label(); R.give('silent', AISLE); R.step(2); const l1 = R.label(); R.give('loud', AISLE); R.step(2); const l2 = R.label();
  verdict(/^squad · loud · orders to /.test(l0) && /^squad · SILENT · orders to /.test(l1) && l2 === l0, 'the header of the squad block: "loud" until told, "SILENT" while silent, "loud" again', `'${l0}' → '${l1}' → '${l2}'`);
  R.give('silent', AISLE); SILENT.on = false; R.step(3); const l3 = R.label(), m = R.menu(AISLE); R.esc();
  verdict(/^squad · orders to /.test(l3) && !m.rows.some((r: any) => /go (silent|loud)/.test(r.text)) && !R.silent() && R.give('silent', AISLE) !== null,
    'the switch off: no word on the header, no row, no such order — and a state left silent rules nothing', `'${l3}' · ${m.rows.map((r: any) => `${r.key || '·'} ${r.text}`).join(' | ')} · ${SLM.silentSummary(game)}`);
  SILENT.on = true; R.step(3); const l4 = R.label(), m2 = R.menu(AISLE); R.esc();
  verdict(/^squad · SILENT · /.test(l4) && rowOf(m2.rows, 'go loud')?.key === '5', '… and back on: the rows and the word are back (the squad as it was left)', `'${l4}'`);
  return done();
});

// ---------------------------------------------------------------- the walk
interface Walk { top: number; lit: number; frames: number; steps: number[]; gog: number; arrived: boolean }
async function walk(silent: boolean, o: RigOpts = {}): Promise<{ R: any; w: Walk }> {
  const R = await rig(7, { empty: true, nvg: false, ...o }); const { game, O, W } = R; const team: any[] = R.team;
  if (silent) R.give('silent', AISLE);
  R.give('move', AISLE_FAR); R.until(() => team.every(x => O.of(x)?.arrived), 25); R.step(30);
  W.audioLog = []; const w: Walk = { top: 0, lit: 0, frames: 0, steps: [], gog: 0, arrived: false };
  R.post = () => { w.frames++; for (const x of team) { w.top = Math.max(w.top, x.speed); if (x.flashlight?.enabled) w.lit++; if (NVM.nvgDown(game, x)) w.gog++; } };
  R.give('move', [7.5, 0, 17.6]); w.arrived = R.until(() => team.every(x => O.of(x)?.arrived), 30); R.post = null;
  w.steps = (W.audioLog as any[]).filter(c => c.name === 'footstep' && !c.opts?.isPlayer).map(c => c.gain / (FLOOR as any)[c.opts.mat].loud); W.audioLog = null;
  return { R, w };
}
export const silentWalk = guarded(async () => {
  const { verdict, done } = family('silent-walk: the same walk, loud and silent — the legs, the lights, the feet');
  const { w: L } = await walk(false), { R, w: S } = await walk(true); const { game } = R; const man = R.team[0];
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), maxOf = (a: number[]) => a.reduce((m, x) => Math.max(m, x), 0);
  verdict(L.arrived && S.arrived && L.top > SILENT.pace + 0.2 && S.top <= SILENT.pace + 0.02, 'loud they move at the order\'s pace; silent no man\'s legs go above SILENT.pace — and they still get there',
    `top speed loud ${f2(L.top)} m/s · silent ${f2(S.top)} (cap ${SILENT.pace}) · arrived ${L.arrived} / ${S.arrived} in ${L.frames} / ${S.frames} frames`);
  verdict(L.lit > 0 && S.lit === 0, 'loud their weapon lights burn on the way (goggles switched off for this walk); silent not one light for one frame', `man-frames lit: loud ${L.lit} · silent ${S.lit}`);
  verdict(L.steps.length > 8 && S.steps.length > 8 && maxOf(S.steps) <= SILENT.step + 1e-6 && mean(L.steps) > SILENT.step + 0.1, 'every silent footfall is at SILENT.step (floor for floor), under the loud walk\'s',
    `footfalls loud ${L.steps.length}, base level mean ${f2(mean(L.steps))} · silent ${S.steps.length}, max ${f2(maxOf(S.steps))} (SILENT.step ${SILENT.step})`);
  // what a listener is handed, and the hot floor
  const stepS = SLM.silentStep(game, man), stepH = SLM.silentStep(game, R.hostiles[0] ?? { team: 'hostile', unit: {} });
  const calm = SLM.silentPace(game, man, 2.2); game.fight.hotT = game.time; const hot = SLM.silentPace(game, man, 2.2); SILENT.hotPace = true; const hotOn = SLM.silentPace(game, man, 2.2); SILENT.hotPace = false; game.fight.hotT = -100;
  verdict(stepS === SILENT.step && stepH === null && calm === SILENT.pace && hot === SILENT.pace && hotOn === 2.2 && SLM.silentPace(game, man, 1.0) === 1.0,
    'the step a listener hears from a silent teammate is SILENT.step (nobody else\'s is touched); a hot floor does not lift his pace (the hotPace knob would), and a slower walk is never sped up',
    `step: teammate ${stepS}, hostile ${stepH} · pace asked 2.2: calm ${calm}, hot ${hot}, hot with hotPace on ${hotOn} · asked 1.0: ${SLM.silentPace(game, man, 1.0)}`);
  // goggles are nvg.ts's: with them on, a silent walk in the dim is a goggles walk
  const { w: G } = await walk(true, { nvg: true });
  verdict(G.lit === 0 && G.arrived, 'with the goggles\' own rule on, silent is still dark (the goggles are that module\'s to bring down)', `man-frames lit ${G.lit} · goggles down ${G.gog} of ${G.frames * 4}`);
  R.give('loud', AISLE); R.step(90); const back = R.team.filter((x: any) => x.state !== 'dead').length > 0 && SLM.silentPace(game, man, 2.2) === 2.2 && SLM.silentStep(game, man) === null && !SLM.silentDark(game, man);
  verdict(back, 'told loud again: pace, step and light are the team\'s own again', `pace ${SLM.silentPace(game, man, 2.2)} · step ${SLM.silentStep(game, man)} · dark ${SLM.silentDark(game, man)}`);
  return done();
});

// ---------------------------------------------------------------- doors
export const silentDoors = guarded(async () => {
  const { verdict, done } = family('silent-doors: no boot by themselves, and a leaf eased open');
  // the locked door, both ways
  const run = async (silent: boolean, order: string) => { const R = await rig(7, { silent: { picks: false } }); const { D } = R; const Md = R.door('manager'); const locked = Md.locked, k0 = SLM.SILENT_STATS.locked;
    if (silent) R.give('silent', AISLE); const w = R.giveDoor(order, 'manager'); const op = D.ops[0]; R.until(() => D.ops.length === 0 || R.kicks > 0, 45); R.step(30);
    return { R, Md, locked, w, op, kicked: R.kicks > 0, broken: !!Md.lockBroken, ended: op?.ended as string | undefined, held: SLM.SILENT_STATS.locked - k0 }; };
  const A = await run(false, 'openClear'), B = await run(true, 'openClear');
  verdict(A.locked && A.w === null && A.kicked && A.broken, 'loud, a locked door, "open and clear": the lead boots it (as ever)', `kicks ${A.R.kicks} · lock broken ${A.broken} · ${A.R.beats(A.op)}`);
  verdict(B.locked && B.w === null && !B.kicked && !B.broken && B.Md.latched && /silent: no boot/.test(B.ended ?? '') && B.R.said.some((t: string) => /locked\. no boot while we are silent/.test(t)) && B.held > 0 && A.held === 0,
    'silent with the pick switched off, the same order: no boot — the lead says it is locked (on the net) and the order ends on the door, the leaf still shut', `kicks ${B.R.kicks} · latched ${B.Md.latched} · ended: ${B.ended} · said: ${B.R.said.filter((t: string) => /locked/.test(t)).join(' / ')}`);
  // the unlocked door: the shove
  const shove = async (silent: boolean) => { const R = await rig(7, { empty: true }); const { D, W } = R; const d = R.door('breakroom_w');
    if (silent) R.give('silent', AISLE); W.audioLog = []; let top = 0; R.post = () => { top = Math.max(top, Math.abs(d.vel)); };
    const w = R.giveDoor('openClear', 'breakroom_w'); const op = D.ops[0]; R.until(() => D.ops.length === 0, 45); R.post = null;
    const bash = (W.audioLog as any[]).filter(c => c.name === 'doorBash').length, creak = (W.audioLog as any[]).filter(c => c.name === 'doorCreak').length; W.audioLog = null;
    return { R, w, op, top, bash, creak, loudNoise: R.doorNoise.filter((n: any) => n.loud).length, noise: R.doorNoise.reduce((m: number, n: any) => Math.max(m, n.level), 0), opened: Math.abs(d.angle) > 0.5 || op?.crossed?.size > 0, crossed: op?.crossed?.size ?? 0 }; };
  const L = await shove(false), S = await shove(true);
  verdict(L.w === null && S.w === null && L.bash > 0 && S.bash === 0 && S.creak > 0 && S.loudNoise === 0 && Math.abs(S.top - L.top) < 0.5 && S.crossed === L.crossed && S.crossed > 0,
    'an unlocked door: loud it is shouldered open (the bash); silent it is a hand on the leaf (a creak, no bash, nothing loud filed) — the leaf swings as it did and the men go in the same',
    `loud: ${L.bash} bash, leaf top ${f2(L.top)} rad/s, ${L.crossed} in · silent: ${S.bash} bash, ${S.creak} creak, leaf top ${f2(S.top)} rad/s, loud door events ${S.loudNoise}, ${S.crossed} in`);
  // a contact
  const man = S.R.team[0]; const q1 = SLM.silentEase(S.R.game, man); S.R.give('loud', AISLE); const q0 = SLM.silentEase(S.R.game, man);
  verdict(q1 && !q0, 'a silent man\'s own push on a leaf is a quiet contact (doors.ts: the creak at 0.12 for 0.3); a loud man\'s as it was', `quiet contact: silent ${q1} · loud ${q0}`);
  return done();
});

// ---------------------------------------------------------------- the lock picked
export const silentPick = guarded(async () => {
  const { verdict, done } = family('silent-pick: a silent squad picks the lock it would have booted');
  const PICK_SECS = 4.2;   // (doors.ts Doors.PICK_SECS — the player's own)
  const run = async (o: RigOpts & { mid?: (R: any, op: any) => void } = {}) => { const R = await rig(7, o); const { D, game } = R; const Md = R.door('manager'); const locked = Md.locked, k0 = SLM.SILENT_STATS.picked;
    R.give('silent', AISLE); const w = R.giveDoor('openClear', 'manager'); const op = D.ops[0], lead = op?.lead;
    let kneel = 0, off = 0, t0 = NaN, t1 = NaN, heard = 0, near = Infinity, did = false, at = NaN, stillHot = 0, aw0 = NaN, awSnap = 0; const top = () => R.hostiles.reduce((m: number, h: any) => h.state === 'dead' ? m : Math.max(m, h.awareness), 0);
    R.post = () => { const hands = R.team.filter((m: any) => m.char.anim.lockpick);
      if (hands.length) { kneel++; if (isNaN(t0)) { t0 = game.time; at = dist(hands[0].char.pos, Md.pos); aw0 = top(); } } else if (!isNaN(t0) && Md.locked) off++;
      if (!Md.locked && isNaN(t1)) t1 = game.time; if (!isNaN(t1) && game.time - t1 < 0.5) awSnap = Math.max(awSnap, top());
      if (Md.locked) for (const h of R.hostiles) if (h.state !== 'dead') { heard = Math.max(heard, h.awareness); near = Math.min(near, dist(h.char.pos, Md.pos)); if (h.state === 'alert' || h.state === 'search') stillHot++; }
      if (o.mid && !did && Md.pick > 0.4) { did = true; o.mid(R, op); } };
    R.until(() => D.ops.length === 0 || (op?.crossed?.size ?? 0) > 0, 60); R.step(45); R.post = null;
    const mine = R.doorNoise.filter((n: any) => n.who === lead?.char.id);
    return { R, Md, locked, w, op, lead, kneel, off, secs: t1 - t0, at, heard, near, stillHot, aw0, awSnap, picked: SLM.SILENT_STATS.picked - k0, picks: D.stats.picks as number, clicks: mine.filter((n: any) => Math.abs(n.level - 0.16) < 1e-6).length, snaps: mine.filter((n: any) => Math.abs(n.level - 0.3) < 1e-6).length,
      loudNoise: R.doorNoise.filter((n: any) => n.loud).length, handsLeft: R.team.filter((m: any) => m.char.anim.lockpick).length, crossed: op?.crossed?.size ?? 0, saidPick: R.said.filter((t: string) => /locked\. picking/.test(t)), ended: op?.ended as string | undefined }; };
  // picked, and entered
  const A = await run();
  verdict(A.locked && A.w === null && A.R.kicks === 0 && !A.Md.lockBroken && !A.Md.locked && A.picked === 1 && A.picks === 1 && A.saidPick.length === 1 && /radio/.test(A.saidPick[0]),
    'silent, a locked door, "open and clear": no boot — the lead says "locked. picking." over the net and the lock is picked, not broken', `kicks ${A.R.kicks} · lock broken ${!!A.Md.lockBroken} · locked now ${A.Md.locked} · picked ${A.picked} · said: ${A.saidPick.join(' / ')} · ${A.R.beats(A.op)}`);
  verdict(A.kneel > 200 && Math.abs(A.secs - PICK_SECS) < 0.3 && A.at < 1.2 && A.clicks >= 4 && A.clicks <= 9 && A.snaps === 1 && A.loudNoise === 0 && A.handsLeft === 0,
    'it is the player\'s own pick: hands on the lock at the door for its 4.2 s, a click every ~0.7 s at 0.16 and one snap at 0.3 filed for hearing under his id, nothing loud — and his hands come off it after',
    `hands on the lock ${A.kneel} frames, ${f2(A.at)} m from the leaf · ${f2(A.secs)} s to the snap · ${A.clicks} clicks, ${A.snaps} snap · loud door events ${A.loudNoise} · hands still on a lock after ${A.handsLeft}`);
  verdict(A.crossed > 0 && A.R.silent(), 'and the order carries on as at an unlocked door: the leaf is eased open and they go in, still silent', `over the line ${A.crossed} · ended: ${A.ended ?? '(still going in)'} · silent ${A.R.silent()}`);
  console.log(`    (informational) the room's defenders while the lock was worked: nearest ${f2(A.near)} m from the hinge, top awareness ${f2(A.aw0)} at the first touch → ${f2(A.heard)} at most while it was worked → ${f2(A.awSnap)} in the half second after the snap; frames any was alert / searching before it gave: ${A.stillHot}`);
  // steel
  { const R = await rig(7); const { D, game } = R; const St = R.door('stairwell'); R.give('silent', AISLE); const w = R.giveDoor('openClear', 'stairwell'); R.step(120);
    const adv = game.doors.pick(St, R.team[0].char.id, 1.0);
    verdict(!!St.def.steel && St.locked && /steel/.test(w ?? '') && D.ops.length === 0 && D.stats.picks === 0 && adv === false && St.pick === 0 && R.kicks === 0,
      'a steel door has no keyway: the order is refused as ever, nobody kneels at it, and the pick itself advances nothing on it', `refused: ${w} · ops ${D.ops.length} · picks ${D.stats.picks} · pick() → ${adv}, progress ${St.pick}`); }
  // the page's own door rule on (DOORTOOLS.testDoor: an entry halts at a door found shut, and steel is found at the handle, not read off the menu): a silent squad is not halted at a lock it can pick, and steel still gets no pick and no boot
  { const P = await run({ page: true });
    verdict(P.locked && P.w === null && P.R.D.stats.halted === 0 && P.R.kicks === 0 && P.picked === 1 && P.crossed > 0 && P.R.silent(),
      'with the door tried before entry (as the page ships): the silent lead finds it locked and picks it on the same order — no halt, no boot, and they go in silent', `halted ${P.R.D.stats.halted} · kicks ${P.R.kicks} · picked ${P.picked} · over the line ${P.crossed} · ${P.R.beats(P.op)}`);
    const R = await rig(7, { page: true }); const { D, game } = R; const St = R.door('stairwell'); R.give('silent', AISLE); const w = R.giveDoor('openClear', 'stairwell'); const op = D.ops[0]; R.until(() => D.ops.length === 0, 45);
    const adv = game.doors.pick(St, R.team[0].char.id, 1.0);
    verdict(St.locked && w === null && /steel/.test(op?.ended ?? '') && R.said.some((t: string) => /it's steel\. no way through/.test(t)) && D.stats.picks === 0 && adv === false && St.pick === 0 && R.kicks === 0 && R.silent(),
      'and steel nobody has tried: the order is taken, the lead says it is steel at the door and the order ends there — nobody kneels, no boot, still silent', `given: ${w ?? 'ok'} · ended: ${op?.ended ?? '—'} · picks ${D.stats.picks} · kicks ${R.kicks} · said: ${R.said.filter((t: string) => /steel/.test(t)).join(' / ')}`); }
  // a keypad door (no cylinder) and a wedged one (digin.ts: a lock no ring fits) are not picked: the old line, and the order ends
  for (const [what, name, prep] of [['a keypad door', 'server_manager', null], ['a door wedged from inside', 'manager', (d: any) => { d.lockId = `wedge:${d.def.name}`; }]] as [string, string, null | ((d: any) => void)][]) {
    const R = await rig(7); const { D } = R; const d = R.door(name); prep?.(d); R.give('silent', AISLE); const w = R.giveDoor('openClear', name); const op = D.ops[0]; R.until(() => D.ops.length === 0, 45);
    verdict(d.locked && D.stats.picks === 0 && R.kicks === 0 && !R.team.some((m: any) => m.char.anim.lockpick) && (w !== null || /silent: no boot/.test(op?.ended ?? '')),
      `${what}: nobody kneels at it — the order is refused or ends on the door with no boot (not compromised: silent-boot has the lines), the door still locked`, `given: ${w ?? 'ok'} · ended: ${op?.ended ?? '—'} · picks ${D.stats.picks} · kicks ${R.kicks} · locked ${d.locked}`); }
  // told loud mid-pick
  const B = await run({ mid: (R) => { R.give('loud', AISLE); } });
  verdict(B.w === null && B.kneel > 60 && B.R.kicks > 0 && !!B.Md.lockBroken && B.picked === 0 && B.handsLeft === 0 && !B.R.silent() && B.R.said.some((t: string) => /locked\. kicking it/.test(t)),
    'told loud with the lock half picked: he stands up and boots it, as a loud squad would', `hands on the lock ${B.kneel} frames · kicks ${B.R.kicks} · lock broken ${!!B.Md.lockBroken} · picked ${B.picked} · ${B.R.beats(B.op)}`);
  // loud from the start (never silent at the door): the boot — and the switch does nothing to a loud squad
  { const R = await rig(7); const { D } = R; const Md = R.door('manager'); const w = R.giveDoor('openClear', 'manager'); R.until(() => D.ops.length === 0 || R.kicks > 0, 45);
    verdict(w === null && R.kicks > 0 && D.stats.picks === 0 && !R.team.some((m: any) => m.char.anim.lockpick) && !!Md.lockBroken, 'a loud squad at the same door: the boot, nobody at the lock', `kicks ${R.kicks} · picks ${D.stats.picks}`); }
  // the fight has him mid-pick (blinded): hands off, then back on, and it still gives
  const C = await run({ mid: (R, op) => { op.lead.dazzledUntil = R.game.time + 1.0; } });
  verdict(C.w === null && C.off >= 50 && C.off <= 75 && C.picked === 1 && C.R.kicks === 0 && C.secs > PICK_SECS + 0.8 && C.secs < PICK_SECS + 1.6 && C.crossed > 0,
    'blinded for a second mid-pick: his hands come off the lock for it, go back on, and the lock still gives (the door kept what was done)', `hands off ${C.off} frames · ${f2(C.secs)} s from first touch to the snap · picked ${C.picked} · over the line ${C.crossed}`);
  return done();
});

// ---------------------------------------------------------------- the door no pick opens
export const silentBoot = guarded(async () => {
  const { verdict, done } = family('silent-boot: a door no pick opens (wedged from inside, a keypad\'s) — booted once compromised, and the squad stays silent');
  const wedge = (d: any) => { d.lockId = `wedge:${d.def.name}`; };                                    // (digin.ts wedge(): the door's own lock, to a lock no ring fits)
  const pad = (d: any, R: any) => { const of = R.game.devices.padOf.bind(R.game.devices); R.game.devices.padOf = (x: any) => x === d ? { def: { name: 'probe_pad' }, door: d } : of(x); };   // (the manager's door stood in as a keypad door: the office's own pad door is behind a locked one, and its order is refused for that)
  const run = async (o: { prep: (d: any, R: any) => void; hot: boolean; silent?: boolean; knobs?: Record<string, unknown>; again?: boolean; later?: number }) => {
    const R = await rig(7, { empty: true, silent: o.knobs }); const { D, game } = R; const Md = R.door('manager'); o.prep(Md, R);
    const b0 = SLM.SILENT_STATS.booted, l0 = SLM.SILENT_STATS.locked, turns0 = SLM.SILENT_LOG.length, bangs0 = D.bangs;
    if (o.silent !== false) R.give('silent', AISLE);
    if (o.hot) { game.fight.hotT = game.time; R.step(3); }                                          // (a shot in the team's ears AFTER the order: silent-fire's own way of compromising them)
    const hotLabel = R.label(); if (o.later) R.step(60 * o.later); const orderLabel = R.label();   // (`later`: the noise that long gone before the door is given)
    const s0 = R.said.length, w = R.giveDoor('openClear', 'manager'); const op = D.ops[0], lead = op?.lead;
    let lit = 0, top = 0, kickLabel = '', regiven = false;
    R.post = () => { for (const m of R.team) { if (m.flashlight?.enabled) lit++; top = Math.max(top, m.speed); }
      if (R.kicks > 0 && !kickLabel) kickLabel = R.label();
      if (o.again && !regiven && op?.phase === 'kick' && R.kicks === 0) { regiven = true; R.giveDoor('openClear', 'manager'); } };   // (the same order given again while he walks to the kick spot)
    R.until(() => D.ops.length === 0 || (op?.crossed?.size ?? 0) > 0, 60); R.step(45); R.post = null;
    const man = R.team[0];
    return { R, Md, w, op, lead, lit, top, kickLabel, regiven, hotLabel, orderLabel, said: R.said.slice(s0), booted: SLM.SILENT_STATS.booted - b0, locked: SLM.SILENT_STATS.locked - l0, bangs: bangs0 - D.bangs,
      turns: SLM.SILENT_LOG.slice(turns0).map((x: any) => x.to), label: R.label(), dark: SLM.silentDark(game, man), pace: SLM.silentPace(game, man, 2.2), cans: SLM.silentNoCans(game), crossed: op?.crossed?.size ?? 0, ended: op?.ended as string | undefined }; };
  const line = (A: any, re: RegExp) => A.said.filter((t: string) => re.test(t));
  // wedged, compromised: the boot, said once, still silent
  const A = await run({ prep: wedge, hot: true });
  verdict(A.w === null && A.R.kicks === 1 && !!A.Md.lockBroken && A.booted === 1 && A.R.D.stats.picks === 0 && line(A, /wedged from inside\. booting it/).length === 1 && /radio/.test(line(A, /booting it/)[0] ?? '') && line(A, /kicking it|no boot/).length === 0 && A.crossed > 0,
    'silent and compromised at a door wedged from inside: the lead says "wedged from inside. booting it." once, over the net, boots it, and they go in', `kicks ${A.R.kicks} · lock broken ${!!A.Md.lockBroken} · booted ${A.booted} · said: ${line(A, /wedged|locked/).join(' / ')} · over the line ${A.crossed} · ${A.R.beats(A.op)}`);
  verdict(A.R.silent() && /SILENT · compromised/.test(A.kickLabel) && /SILENT · compromised/.test(A.label) && A.turns.join() === 'silent' && A.dark && A.lit === 0 && A.pace === SILENT.pace && A.top <= SILENT.pace + 0.25 && A.cans && line(A, /compromised\./).length === 0,
    'and the posture stands: still SILENT · compromised on the HUD at the boot and after, no light lit on the way in (a loud squad\'s burn: the last check), no man over the silent walk, the can rule still answering — and nobody says "compromised." a second time at their own boot', `HUD at the boot '${A.kickLabel}' · after '${A.label}' · posture turns: ${A.turns.join(', ')} · lit frames ${A.lit} · top speed ${f2(A.top)} (cap ${SILENT.pace}) · cans spent ${A.bangs}`);
  // … compromised a minute ago, the HUD's word lapsed (the fight's 45 s clock): still the boot — it goes by what has happened since the order
  const A2 = await run({ prep: wedge, hot: true, later: 60 });
  verdict(/compromised/.test(A2.hotLabel) && !/compromised/.test(A2.orderLabel) && A2.R.kicks === 1 && !!A2.Md.lockBroken && A2.booted === 1 && line(A2, /wedged from inside\. booting it/).length === 1 && A2.R.silent() && A2.lit === 0 && line(A2, /compromised\./).length === 0,
    'compromised a minute before the door is given (the HUD\'s word has lapsed by then): still the boot, still silent — compromised since the order is what counts', `HUD when it happened '${A2.hotLabel}' · when the door was given '${A2.orderLabel}' · kicks ${A2.R.kicks} · booted ${A2.booted} · said: ${line(A2, /wedged|locked/).join(' / ')}`);
  // wedged, NOT compromised: no boot, the line names the fix
  const B = await run({ prep: wedge, hot: false });
  verdict(B.w === null && B.R.kicks === 0 && B.Md.locked && !B.Md.lockBroken && B.booted === 0 && B.locked === 1 && /silent: no boot/.test(B.ended ?? '') && line(B, /wedged from inside\. no quiet way in\. go loud and we boot it/).length === 1 && B.R.silent() && !/compromised/.test(B.label),
    'silent and NOT compromised at the same door: no boot — "wedged from inside. no quiet way in. go loud and we boot it." and the order ends on the door, still locked', `kicks ${B.R.kicks} · locked ${B.Md.locked} · ended: ${B.ended} · said: ${line(B, /wedged|locked/).join(' / ')} · ${B.label}`);
  // … and his loud word after it does boot it
  { const { R, Md } = B; const w2 = R.give('loud', AISLE); R.give('silent', AISLE); R.step(3); const again = SLM.silentBoot(R.game, Md); R.give('loud', AISLE); const w3 = R.giveDoor('openClear', 'manager');
    verdict(again === null, '(and a fresh "go silent" starts clean: not compromised until something loud comes after it)', `asked of a squad just told silent again: ${again}`); R.until(() => R.D.ops.length === 0 || R.kicks > 0, 45);
    verdict(w2 === null && w3 === null && R.kicks === 1 && !!Md.lockBroken && R.said.some((t: string) => /locked\. kicking it/.test(t)), '… told loud and given the door again: the boot, as a loud squad boots it', `kicks ${R.kicks} · lock broken ${!!Md.lockBroken}`); }
  // a keypad door, both ways
  const C = await run({ prep: pad, hot: true }), E = await run({ prep: pad, hot: false });
  verdict(C.R.kicks === 1 && !!C.Md.lockBroken && C.booted === 1 && line(C, /keypad, no code\. booting it/).length === 1 && C.R.silent() && C.R.D.stats.picks === 0,
    'a keypad door (the manager\'s stood in as one), compromised: "keypad, no code. booting it." and the boot, nobody at the keyway, still silent', `kicks ${C.R.kicks} · booted ${C.booted} · picks ${C.R.D.stats.picks} · said: ${line(C, /keypad|locked/).join(' / ')}`);
  verdict(E.R.kicks === 0 && E.Md.locked && E.booted === 0 && /silent: no boot/.test(E.ended ?? '') && line(E, /keypad, no code\. no quiet way in\. go loud and we boot it/).length === 1,
    '… not compromised: no boot, "keypad, no code. no quiet way in. go loud and we boot it."', `kicks ${E.R.kicks} · ended: ${E.ended} · said: ${line(E, /keypad|locked/).join(' / ')}`);
  // a cylinder is still picked, compromised or not (the boot is only for what no pick opens)
  const P = await run({ prep: () => {}, hot: true });
  verdict(P.R.kicks === 0 && P.booted === 0 && !P.Md.lockBroken && !P.Md.locked && line(P, /locked\. picking/).length === 1, 'compromised at a door with a keyway: still the pick, no boot', `kicks ${P.R.kicks} · booted ${P.booted} · picks ${P.R.D.stats.picks} · said: ${line(P, /locked|wedged/).join(' / ')}`);
  // the switch off: held, whatever has reached them — the old line
  const F = await run({ prep: wedge, hot: true, knobs: { bootWedged: false } });
  verdict(F.R.kicks === 0 && F.Md.locked && F.booted === 0 && /silent: no boot/.test(F.ended ?? '') && line(F, /locked\. no boot while we are silent/).length === 1 && line(F, /go loud|booting/).length === 0,
    'the switch off (SILENT.bootWedged): compromised or not, no boot and the old line', `kicks ${F.R.kicks} · ended: ${F.ended} · said: ${line(F, /wedged|locked/).join(' / ')}`);
  // said once per door
  const G = await run({ prep: wedge, hot: true, again: true });
  { const { R, Md } = G; const a = SLM.silentBoot(R.game, Md), b = SLM.silentBoot(R.game, R.door('breakroom_w'));
    verdict(G.regiven && G.R.kicks >= 1 && line(G, /booting it/).length === 1 && G.booted === 1 && a === 'again' && b === 'first',
      'the order given again while he walks to the kick spot: the line is not said twice (once per door; another door gets its own)', `re-given ${G.regiven} · kicks ${G.R.kicks} · "booting it" ×${line(G, /booting it/).length} · counted ${G.booted} · asked again: this door '${a}', another '${b}'`); }
  // a loud squad at a wedged door: as it was
  const L = await run({ prep: wedge, hot: true, silent: false });
  verdict(L.lit > 0 && L.R.kicks === 1 && L.booted === 0 && L.locked === 0 && line(L, /locked\. kicking it/).length === 1 && line(L, /wedged|booting/).length === 0, 'a loud squad at the wedged door: "locked. kicking it." and the boot, as before — the rule counts nothing', `kicks ${L.R.kicks} · booted ${L.booted} · said: ${line(L, /wedged|locked/).join(' / ')} · (control for the dark check above) man-frames lit, loud: ${L.lit}`);
  return done();
});

// ---------------------------------------------------------------- cans
export const silentCans = guarded(async () => {
  const { verdict, done } = family('silent-cans: the canisters stay in the kit');
  const run = async (silent: boolean, then: boolean) => { const R = await rig(7, { doortools: { thrFirst: 2 } }); const { D } = R; const b0 = D.bangs;   // (thrFirst 2: a can goes in first at EVERY threshold — the loud side of the comparison is then certain)
    if (silent) R.give('silent', AISLE); const w = R.giveDoor(then ? 'thresholdHold' : 'threshold', 'breakroom_w'); const op = D.ops[0];
    if (then) { R.until(() => !!op?.thr?.told || D.ops.length === 0, 40); const held = D.bangs; const w2 = R.giveDoor('go', 'breakroom_w'); R.until(() => D.ops.length === 0, 60); return { R, w, w2, op, spent: b0 - D.bangs, heldSpent: b0 - held }; }
    R.until(() => D.ops.length === 0, 60); return { R, w, w2: null as string | null, op, spent: b0 - D.bangs, heldSpent: 0 }; };
  const L = await run(false, false), S = await run(true, false), T = await run(true, true);
  verdict(L.w === null && L.spent >= 1 && L.R.bangs >= 1, 'loud, "step in once it goes quiet" with a can going in first: a can is spent', `bangs spent ${L.spent} · blasts ${L.R.bangs} · ${L.R.beats(L.op)}`);
  verdict(S.w === null && S.spent === 0 && S.R.bangs === 0 && (S.op?.crossed?.size ?? 0) > 0, 'silent, the same order: the kit is whole, no blast — and they still step in', `bangs spent ${S.spent} · blasts ${S.R.bangs} · over the line ${S.op?.crossed?.size} · ${S.R.beats(S.op)}`);
  verdict(T.w === null && T.heldSpent === 0 && T.w2 === null && T.spent === 0 && T.R.bangs === 0 && (T.op?.crossed?.size ?? 0) > 0 && T.R.silent(), 'silent, holding the door, then the word: they step in on it, and the kit is still whole', `while holding ${T.heldSpent} spent · after the word ${T.spent} · blasts ${T.R.bangs} · over the line ${T.op?.crossed?.size} · ${T.R.beats(T.op)}`);
  // 'clear from outside' as ONE order (DOORTOOLS.outsidePlain, as the page ships): hold the door, then the word — the same kit rule
  { const R = await rig(7, { page: true, doortools: { thrFirst: 2 } }); const { D } = R; const b0 = D.bangs; R.give('silent', AISLE); const w = R.giveDoor('thresholdHold', 'breakroom_w'); const op = D.ops[0];
    R.until(() => !!op?.thr?.told || D.ops.length === 0, 40); const held = b0 - D.bangs; const w2 = R.giveDoor('go', 'breakroom_w'); R.until(() => D.ops.length === 0, 60);
    verdict(w === null && held === 0 && w2 === null && b0 - D.bangs === 0 && R.bangs === 0 && (op?.crossed?.size ?? 0) > 0 && R.silent(), 'with "clear from outside" as one order (as the page ships): silent, they hold the door, go in on the word, and the kit is whole',
      `while holding ${held} spent · after the word ${b0 - D.bangs} · blasts ${R.bangs} · over the line ${op?.crossed?.size} · silent ${R.silent()}`); }
  return done();
});

// ---------------------------------------------------------------- the loud tools
export const silentTools = guarded(async () => {
  const { verdict, done } = family('silent-tools: the loud tools stay on the menu marked LOUD, and picking one ends silent');
  // the door tools' page, loud and silent
  const page = async (silent: boolean) => { const R = await rig(7); if (silent) R.give('silent', AISLE); R.menu(R.door('breakroom_w').frameCentre); R.press('Digit5'); R.step(2);
    const rows: string[] = (R.O.hud().menu?.rows ?? []).map((r: any) => r.opts[0]?.text as string).filter(Boolean); R.esc(); return rows; };
  const PL = await page(false), PS = await page(true); const marked = (rows: string[]) => rows.filter(t => / · LOUD/.test(t));
  verdict(marked(PL).length === 0 && marked(PS).length === 3 && marked(PS).some(t => /^bang and clear/.test(t)) && marked(PS).some(t => /charge/.test(t)) && marked(PS).some(t => /^frag and clear/.test(t)) && PS.some(t => /^open and clear/.test(t) && !/LOUD/.test(t)) && PS.length === PL.length,
    'the door tools\' page: loud, no mark; silent, "bang and clear", the charge and "frag and clear" carry LOUD, "open and clear" does not — the same rows on the same keys', `loud: ${PL.join(' | ')}\n    silent: ${PS.join(' | ')}`);
  // bang and clear at a locked door
  { const R = await rig(7); const { D } = R; const Md = R.door('manager'); R.give('silent', AISLE); const n0 = R.said.length; const w = R.giveDoor('bangClear', 'manager'); const flipped = !R.silent(); const line = R.said.slice(n0).filter((t: string) => /going loud/.test(t));
    const op = D.ops[0]; R.until(() => D.ops.length === 0 || R.bangs > 0, 45); R.step(30);
    verdict(Md.locked !== undefined && w === null && flipped && line.length === 1 && R.kicks > 0 && !!Md.lockBroken && R.bangs > 0 && SLM.SILENT_LOG[SLM.SILENT_LOG.length - 1]?.by === 'tool',
      'silent, "bang and clear" on a locked door: the squad is loud from the order, one line says so — the boot, then the can', `loud at once ${flipped} · said: ${line.join(' / ')} · kicks ${R.kicks} · blasts ${R.bangs} · ${R.beats(op)}`); }
  // bang, then step in, on a held door
  { const R = await rig(7, { doortools: { thrFirst: 2 } }); const { D } = R; const b0 = D.bangs; R.give('silent', AISLE); R.giveDoor('thresholdHold', 'breakroom_w'); const op = D.ops[0];
    R.until(() => !!op?.thr?.told || D.ops.length === 0, 40); const held = b0 - D.bangs, was = R.silent(); const w2 = R.giveDoor('thrBang', 'breakroom_w'); const flipped = !R.silent(); R.until(() => D.ops.length === 0 || R.bangs > 0, 30);
    verdict(held === 0 && was && w2 === null && flipped && b0 - D.bangs >= 1 && R.bangs >= 1, 'silent, holding a door, then "bang, then step in": nothing thrown while they held; the row ends silent and its can goes in', `while holding ${held} spent, silent ${was} · after the row: loud ${flipped}, ${b0 - D.bangs} spent, blasts ${R.bangs}`); }
  // a bang and clear started any other way (a scenario's F: DoorTools.order)
  { const R = await rig(7); const { D, O } = R; const d = R.door('breakroom_w'); R.give('silent', AISLE); const t = O.targetAt(d.frameCentre); const r = D.order('bangClear', O.men(), d, t.side);
    verdict(typeof r !== 'string' && !R.silent() && R.turn()?.by === 'tool', 'a bang and clear given to the door tools directly (a scenario\'s own launch) ends silent the same way', `started ${typeof r !== 'string'} · silent ${R.silent()} · by ${R.turn()?.by}`); }
  // the pair's word on a held door says what it will do
  { const word = async (silent: boolean) => { const R = await rig(7, { squad: 2 }); const { D } = R; if (silent) R.give('silent', AISLE); R.giveDoor('thresholdHold', 'breakroom_w'); const op = D.ops[0];
      R.until(() => !!op?.thr?.told || D.ops.length === 0, 40); R.menu(R.door('breakroom_w').frameCentre); R.press('Digit5'); R.step(2);
      const rows: string[] = (R.O.hud().menu?.rows ?? []).map((r: any) => r.opts[0]?.text as string).filter(Boolean); R.esc(); return rows; };
    const WL = await word(false), WS = await word(true);
    verdict(WL.some(t => /^go · bang the blind pockets, step in/.test(t)) && WS.some(t => /^go · step in · no bang/.test(t)) && !WS.some(t => /^go · bang the blind/.test(t)) && WS.some(t => /^bang, then step in.* · LOUD/.test(t)),
      'the pair holding a door: loud, the word reads "bang the blind pockets, step in"; silent it reads "step in · no bang" — and "bang, then step in" carries LOUD', `loud: ${WL.join(' | ')}\n    silent: ${WS.join(' | ')}`); }
  // the same three under the page's own door rules (the door tried before entry; 'clear from outside' as one order — its second order is this page's rows 1 and 2)
  { const R = await rig(7, { page: true }); const { D } = R; const Md = R.door('manager'); R.give('silent', AISLE); const w = R.giveDoor('bangClear', 'manager'); const flipped = !R.silent(); const op = D.ops[0];
    R.until(() => D.ops.length === 0 || R.kicks > 0, 45); const halted = D.stats.halted as number, k1 = R.kicks, said = R.said.filter((t: string) => /holding on it/.test(t));
    const w2 = R.giveDoor('bangClear', 'manager'); const op2 = D.ops[0]; R.until(() => D.ops.length === 0 || R.bangs > 0, 45); R.step(30);
    verdict(w === null && flipped && halted === 1 && k1 === 0 && said.length === 1 && w2 === null && R.kicks > 0 && !!Md.lockBroken && R.bangs > 0 && !R.silent(),
      'with the door tried before entry: silent, "bang and clear" on a locked door ends silent at the order, and the now loud squad does what a loud one does — halts on the lock, and the same row again is the boot, then the can',
      `loud at once ${flipped} · first order: halted ${halted}, kicks ${k1}, said: ${said.join(' / ')} | ${R.beats(op)} · again: kicks ${R.kicks}, blasts ${R.bangs} | ${R.beats(op2)}`); }
  { const R = await rig(7, { page: true, doortools: { thrFirst: 2 } }); const { D } = R; const b0 = D.bangs; R.give('silent', AISLE); R.giveDoor('thresholdHold', 'breakroom_w'); const op = D.ops[0];
    R.until(() => !!op?.thr?.told || D.ops.length === 0, 40); const held = b0 - D.bangs, was = R.silent(); const w2 = R.giveDoor('bangClear', 'breakroom_w'); const flipped = !R.silent(); R.until(() => R.bangs > 0, 30);
    verdict(held === 0 && was && w2 === null && flipped && b0 - D.bangs >= 1 && R.bangs >= 1, 'with "clear from outside" as one order: silent, holding a door, then "bang, then go in" — nothing thrown while they held; the row ends silent and its can goes in', `while holding ${held} spent, silent ${was} · after the row: ${w2 ?? 'given'}, loud ${flipped}, ${b0 - D.bangs} spent, blasts ${R.bangs}`); }
  { const word = async (silent: boolean) => { const R = await rig(7, { squad: 2, page: true }); const { D } = R; if (silent) R.give('silent', AISLE); R.giveDoor('thresholdHold', 'breakroom_w'); const op = D.ops[0];
      R.until(() => !!op?.thr?.told || D.ops.length === 0, 40); R.menu(R.door('breakroom_w').frameCentre); R.press('Digit5'); R.step(2);
      const rows: string[] = (R.O.hud().menu?.rows ?? []).map((r: any) => r.opts[0]?.text as string).filter(Boolean); R.esc(); return rows; };
    const WL = await word(false), WS = await word(true); const loudRows = (rows: string[]) => rows.filter(t => / · LOUD/.test(t));
    verdict(loudRows(WL).length === 0 && WL.some(t => /^bang, then go in/.test(t)) && WS.some(t => /^go in and clear · no bang/.test(t) && !/LOUD/.test(t)) && WS.some(t => /^bang, then go in.* · LOUD/.test(t)) && WS.some(t => /^frag and clear.* · LOUD/.test(t)) && loudRows(WS).length === 2,
      'and the pair holding a door from outside: the second order\'s rows are "go in and clear · no bang" and "bang, then go in" — silent, the bang and the frag carry LOUD and going in does not', `loud: ${WL.join(' | ')}\n    silent: ${WS.join(' | ')}`); }
  // the knob
  { const R = await rig(7, { silent: { toolsLoud: false } }); R.give('silent', AISLE); R.giveDoor('bangClear', 'manager'); R.until(() => R.D.ops.length === 0, 45);
    verdict(R.silent() && R.kicks === 0, 'with toolsLoud off the row is done silent: the order stands, and the locked door is not booted', `silent ${R.silent()} · kicks ${R.kicks} · locked said ${SLM.SILENT_STATS.locked}`); }
  return done();
});

// ---------------------------------------------------------------- fire
export const silentFire = guarded(async () => {
  const { verdict, done } = family('silent-fire: fire held on a man who has not noticed — and what changes once the squad is compromised');
  // the break room's two, kept unaware (state and awareness written back every frame) while the four go in on them
  const run = async (silent: boolean, o: RigOpts = {}) => { const R = await rig(7, o); const { game } = R; let frozen = true; const h0 = SLM.SILENT_STATS.held, c0 = SLM.SILENT_STATS.compromised;
    R.post = () => { if (frozen) for (const h of R.hostiles) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; } };
    if (silent) R.give('silent', AISLE); R.giveDoor('openClear', 'breakroom_w'); R.step(60 * 25);
    const a = { shots: R.opShots, held: SLM.SILENT_STATS.held - h0, label: R.label(), eyesOn: R.said.filter((t: string) => /eyes on\. holding/.test(t)).length, down: R.hostiles.filter((h: any) => h.state === 'dead').length };
    frozen = false; for (const h of R.hostiles) if (h.state !== 'dead') { h.state = 'alert'; h.awareness = 1; } R.step(60 * 15); R.post = null;
    return { R, a, shots: R.opShots, comp: SLM.SILENT_STATS.compromised - c0, label: R.label(), said: R.said.filter((t: string) => /compromised/.test(t)), down: R.hostiles.filter((h: any) => h.state === 'dead').length, silent: R.silent(), top: 0 }; };
  const L = await run(false), S = await run(true), K = await run(true, { silent: { holdFire: false } });
  verdict(L.a.shots > 0 && L.a.down > 0 && L.a.held === 0, 'loud: the four shoot the men in the room, noticed or not (as ever)', `rounds in the first 25 s: ${L.a.shots} · down ${L.a.down}`);
  verdict(S.a.shots === 0 && S.a.down === 0 && S.a.held > 0 && S.a.eyesOn > 0 && /SILENT/.test(S.a.label) && !/compromised/.test(S.a.label),
    'silent: guns on the same men, not one round — and they say so on the net', `rounds ${S.a.shots} · down ${S.a.down} · frames a round was held ${S.a.held} · "eyes on. holding." ×${S.a.eyesOn} · ${S.a.label}`);
  verdict(S.shots > 0 && S.down > 0 && S.silent, 'the men notice: the silent four shoot them — the order still stands', `rounds ${S.shots} · down ${S.down} · still silent ${S.silent}`);
  verdict(S.comp === 1 && S.said.length === 1 && /SILENT · compromised/.test(S.label), 'the first loud thing in a silent man\'s ears is said once, over the net, and the HUD\'s word shows it', `compromised ×${S.comp} · said: ${S.said.join(' / ')} · ${S.label}`);
  verdict(K.a.shots > 0 && K.a.held === 0, 'with holdFire off a silent four shoot as a loud one does', `rounds in the first 25 s: ${K.a.shots} · held ${K.a.held}`);
  // noise from before the order is not a compromise; a captor at his last warning holds nothing back
  { const R = await rig(7); const { game } = R; const man = R.team[0], foe = R.hostiles.find((h: any) => h.state !== 'dead'); foe.state = 'patrol'; foe.awareness = 0;
    game.fight.hotT = game.time; R.step(3); const c0 = SLM.SILENT_STATS.compromised; R.give('silent', AISLE); R.step(30); const stale = { comp: SLM.SILENT_STATS.compromised - c0, label: R.label(), holds: SLM.silentHolds(game, man, foe) };
    game.fight.hotT = game.time; R.step(3); const fresh = { comp: SLM.SILENT_STATS.compromised - c0, label: R.label(), holds: SLM.silentHolds(game, man, foe) };
    verdict(stale.comp === 0 && !/compromised/.test(stale.label) && stale.holds && fresh.comp === 1 && /compromised/.test(fresh.label) && !fresh.holds,
      'told silent 3 frames after a loud fight: not compromised, fire still held — a loud thing AFTER the order is what compromises', `noise before the order: compromised ×${stale.comp}, holds ${stale.holds}, ${stale.label} · noise after: ×${fresh.comp}, holds ${fresh.holds}, ${fresh.label}`); }
  { const R = await rig(7); const { game } = R; const man = R.team[0], foe = R.hostiles.find((h: any) => h.state !== 'dead'); foe.state = 'patrol'; foe.awareness = 0; R.give('silent', AISLE); R.step(2);
    const k0 = SLM.SILENT_STATS.locked, calm = { holds: SLM.silentHolds(game, man, foe), boot: SLM.silentNoBoot(game) }; const was = game.rescue.lastWarning; game.rescue.lastWarning = () => true;
    const last = { holds: SLM.silentHolds(game, man, foe), boot: SLM.silentNoBoot(game) }; game.rescue.lastWarning = was;
    verdict(calm.holds && calm.boot && !last.holds && !last.boot && SLM.SILENT_STATS.locked - k0 === 1, 'a captor at his last warning: no round and no boot is held (silent never costs the hostage)', `calm: holds fire ${calm.holds}, holds the boot ${calm.boot} · last warning: ${last.holds}, ${last.boot}`);
    // the gun: the team's rifle is loud by its report; a quiet gun (the loadout's seam) is not held
    const rep = man.weapon.def.report, was2 = { ...rep }; const loudGun = SLM.quietGun(man); Object.assign(rep, { level: 0.6, loud: false }); const q = { quiet: SLM.quietGun(man), holds: SLM.silentHolds(game, man, foe) }; Object.assign(rep, was2);
    verdict(!loudGun && q.quiet && !q.holds && SLM.silentHolds(game, man, foe), 'the team\'s rifle is not a quiet gun (its report is a gunshot\'s), so its rounds are held; a gun whose report is quiet is not held (quietGun: the kit\'s seam)', `rifle: report level ${was2.level}, quiet ${loudGun} · a 0.6 report: quiet ${q.quiet}, holds ${q.holds}`); }
  // told loud, the cue is gone
  S.R.give('loud', AISLE); S.R.step(5);
  verdict(!S.R.silent() && /squad · loud ·/.test(S.R.label()), 'told loud: the word on the HUD is "loud" again', S.R.label());
  return done();
});

// ---------------------------------------------------------------- lines
export const silentHush = guarded(async () => {
  const { verdict, done } = family('silent-hush: what he would have called out goes over the net');
  const R = await rig(7); const { game } = R; const man = R.team[0], foe = R.hostiles.find((h: any) => h.state !== 'dead');
  game.say(man, 'probe line one.'); const b0 = { ...man.bubble };
  R.give('silent', AISLE); const ack = R.team.map((x: any) => x.bubble).find((b: any) => b && /going quiet|copy\. silent/.test(b.text));
  game.say(man, 'probe line two.'); const b1 = { ...man.bubble }; game.say(foe, 'probe line three.'); const b2 = { ...foe.bubble };
  SILENT.hush = false; game.say(man, 'probe line four.'); const b3 = { ...man.bubble }; SILENT.hush = true;
  verdict(b0.radio === false && b1.radio === true && b2.radio === false && b3.radio === false && !!ack && ack.radio === true,
    'loud: called out · silent: a radio line (the order\'s own answer included) · a hostile\'s line is his own · the knob off: called out again',
    `loud ${b0.radio} · silent ${b1.radio} · ack '${ack?.text}' ${ack?.radio} · hostile ${b2.radio} · hush off ${b3.radio}`);
  return done();
});

// ---------------------------------------------------------------- the starting posture
export const silentStart = guarded(async () => {
  const { verdict, done } = family('silent-start: SILENT.start stands a fresh squad up silent');
  const R = await rig(7, { silent: { start: true }, nvg: false }); const { game, RC } = R; let lit = 0; R.post = () => { for (const x of R.team) if (x.flashlight?.enabled) lit++; };
  R.step(120); const a = R.silent(), la = R.label(), by = SLM.SILENT_LOG[SLM.SILENT_LOG.length - 1]?.by;
  verdict(a && /^squad · SILENT · /.test(la) && by === 'start', 'staged with start on: silent from the first frames, nobody told', `silent ${a} · '${la}' · by ${by} · man-frames lit over two seconds ${lit}`);
  R.give('loud', AISLE); R.step(5); const b = R.silent(); const cast0 = R.team[0];
  const why = RC.start(8); R.step(5); const c = R.silent(), fresh = R.team[0] !== cast0;
  verdict(!b && why === null && fresh && c, 'the order takes it out — and a restart stands the NEW squad up silent again', `after "go loud" ${b} · restart ${why} · new men ${fresh} · silent ${c}`);
  // … and clean: the last squad's noise is not the new one's (a squad compromised, then a restart that stands the next one up silent as well)
  { game.fight.hotT = game.time; R.step(3); const was = /compromised/.test(R.label()); const old = R.team[0]; RC.start(10); R.step(5); const Md = R.door('manager'); Md.lockId = `wedge:${Md.def.name}`;
    verdict(was && R.team[0] !== old && R.silent() && !/compromised/.test(R.label()) && SLM.silentBoot(game, Md) === null, 'a silent squad that was compromised, then a restart: the new squad is silent and NOT compromised (a wedged door is not booted on the last squad\'s noise)',
      `before '${was ? 'compromised' : 'clean'}' · after '${R.label()}' · a wedged door asked: ${SLM.silentBoot(game, Md)}`); Md.lockId = Md.def.lock ?? Md.lockId; RC.start(8); R.step(5); }
  // a man leaving the roster (a cast changed, not replaced) leaves Sam's word standing; a showcase's cast is never silent
  const gone = game.guards.indexOf(R.team[3]), man = game.guards.splice(gone, 1)[0]; R.step(3); const kept = R.silent(); game.guards.splice(gone, 0, man); R.step(3); const kept2 = R.silent();
  game.touring = true; const show = { squad: R.silent(), man: SLM.silentMan(game, R.team[0]), pace: SLM.silentPace(game, R.team[0], 2.2) }; game.touring = false;
  verdict(kept && kept2 && !show.squad && !show.man && show.pace === 2.2 && R.silent(), 'one man off the roster and back: still silent; under a showcase / the tour no rule applies (the squad is not under Sam\'s orders there)',
    `three men ${kept} · four again ${kept2} · touring: silent ${show.squad}, pace asked 2.2 → ${show.pace}`);
  SILENT.start = false; RC.start(9); R.step(5);
  verdict(!R.silent() && /^squad · loud · /.test(R.label()), 'start off (shipped): the next squad stands up loud, whatever the last one was', `silent ${R.silent()} · '${R.label()}' · ${SLM.silentSummary(game)}`);
  return done();
});

// ---------------------------------------------------------------- off / never given
/** a scripted minute — fall in, stack, open and clear with the room's men alive — hashed every frame: the digest, and every man's light, state, place, aim */
async function minute(o: RigOpts, pre?: (R: any) => void): Promise<string> {
  const R = await rig(11, o); const { game, O } = R; pre?.(R); let h = 0x811c9dc5 >>> 0;
  const eat = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  const frame = (n: number) => { for (let f = 0; f < n; f++) { R.step(); eat(JSON.stringify(digestGame(game, true))); for (const x of game.guards) eat(`${x.flashlight?.enabled ? 1 : 0}${x.state[0]}${x.char.pos[0].toFixed(4)},${x.char.pos[2].toFixed(4)},${x.char.aimYaw.toFixed(4)},${x.bubble?.radio ? 1 : 0}`); } };
  const sam = game.player.char.pos; O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all'); frame(120);
  R.giveDoor('stack', 'breakroom_w'); frame(60 * 12); R.giveDoor('openClear', 'breakroom_w'); frame(60 * 25); R.giveDoor('threshold', 'manager'); frame(60 * 25);
  return `${(h >>> 0).toString(16).padStart(8, '0')} · ${game.guards.filter((x: any) => x.state !== 'dead').length} standing at ${game.time.toFixed(2)} s · kicks ${R.kicks} bangs ${R.bangs}`;
}
export const silentOff = guarded(async () => {
  const { verdict, done } = family('silent-off: the order never given is the game as it was');
  const on = await minute({}), off = await minute({ silent: { on: false } }), knobs = await minute({ silent: { pace: 0.8, step: 0.05, kicks: false } });
  verdict(on === off && on === knobs, 'a scripted minute (fall in, stack, open and clear, a threshold on a locked door), never told silent: the same hash every frame with the switch on, off, and with its numbers moved',
    `on ${on} · off ${off} · numbers moved ${knobs}`);
  const told = await minute({}, R => R.give('silent', AISLE)), dead = await minute({ silent: { on: false } }, R => SLM.setSilent(R.game, true));
  verdict(told !== on, 'told silent, the same minute is a different one (the probe can tell)', `silent ${told}`);
  verdict(dead === off, 'the switch off over a state left silent: the same hash again (no rule reads the state)', `left silent, switch off ${dead}`);
  return done();
});

// ---------------------------------------------------------------- a silent stack beside unaware men is set
/** SILENTSET_BREAK=1: the key left off where a line asks for it on — the lines about the rule must fail */
const SET_BREAK = process.env.SILENTSET_BREAK === '1';
export const silentSet = guarded(async () => {
  const { verdict, done } = family('silent-set: a silent man on his stack mark whose round is held on a man is stacked');
  const off = (o: any, at: number[]) => { const e = Math.atan2(at[0] - o.char.pos[0], at[2] - o.char.pos[2]) - o.char.aimYaw; return Math.abs(Math.atan2(Math.sin(e), Math.cos(e))); };
  // the break room's west door stood open, Sam inside by the north door, its two men kept unaware: the silent pair is told to stack on the north door from inside
  const run = async (key: boolean, o: RigOpts = {}, locked = false) => { const R = await rig(7, { squad: 2, ...o, silent: { stackSet: key && !SET_BREAK } }); const { game, O, D } = R;
    const d = R.door('breakroom_n'), dw = R.door('breakroom_w'), said: string[] = [], say0 = game.say; game.say = function (this: any, gd: any, text: string, ...r: any[]) { said.push(text); return say0.call(this, gd, text, ...r); };
    R.post = () => { for (const h of R.hostiles) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; } };
    R.give('silent', AISLE); dw.angle = (dw.swing ?? 1) > 0 ? dw.maxA : dw.minA; dw.latched = false; dw.vel = 0; dw.quietT = -3600; game.teleportPlayer([30.75, 0, 14.4]); R.step(60);
    if (locked) { d.locked = true; d.latched = true; d.keySide = game.doors.side(d, game.player.char.pos); }   // (locked against the side they stack on)
    const h0 = SLM.SILENT_STATS.held, t0 = D.stats.tested, up0 = R.hostiles.filter((h: any) => h.state !== 'dead').length, w = R.giveDoor('stack', 'breakroom_n'), men = () => R.team.filter((x: any) => x.state !== 'dead');
    const all = () => men().length === 2 && men().every((x: any) => O.of(x)?.order === 'stack' && O.of(x).arrived);
    let secs = 0; for (; secs < 30 && !all(); secs++) R.step(60);
    let left = 0, n = 0; for (let i = 0; i < 60 * 8; i++) { R.step(); for (const x of men()) { n++; if (!O.of(x)?.arrived) left++; } }
    const rows = men().map((x: any) => { const A = O.of(x), t = game.fight.opOf(x)?.tgt; return { cs: x.callsign as string, arrived: !!A?.arrived, mark: A?.post ? dist(x.char.pos, A.post) : NaN, man: t ? off(x, t.char.pos) : NaN, door: off(x, d.frameCentre), tgt: (t?.callsign ?? 'nobody') as string, calm: t?.state === 'patrol', rule: SLM.silentOnMan(game, x) as boolean, word: O.statusOf(x) as string }; });
    const out = { R, w, set: all(), secs, left, n, rows, rounds: R.opShots, held: SLM.SILENT_STATS.held - h0, tested: D.stats.tested - t0, sets: said.filter(x => x === 'set.').length, lockedSaid: said.filter(x => /locked/.test(x)).length, leaf: Math.abs(d.angle), silent: R.silent(), up0, up: R.hostiles.filter((h: any) => h.state !== 'dead').length };
    game.say = say0; return out; };
  const show = (a: Awaited<ReturnType<typeof run>>) => `${a.w ? `refused: ${a.w}` : 'given'} · set ${a.set} after ${a.secs} s · man-frames not arrived in the 8 s after ${a.left}/${a.n} · 'set.' said ${a.sets} · team rounds ${a.rounds} · frames a round was held ${a.held} · handles tried ${a.tested} · 'locked' said ${a.lockedSaid} · leaf ${f2(a.leaf)} · still silent ${a.silent} · defenders up ${a.up}/${a.up0} · ${a.rows.map(m => `${m.cs}: ${f2(m.mark)} m off his mark, gun ${f2(m.man)} rad off ${m.tgt} and ${f2(m.door)} rad off the doorway, held on him by the order ${m.rule}, "${m.word}"`).join(' · ')}`;
  const onMarks = (a: Awaited<ReturnType<typeof run>>) => !a.w && a.rows.length === 2 && a.rows.every(m => m.mark < 0.35 && m.calm && m.man < 0.2 && m.door > 0.2) && a.rounds === 0 && a.held > 0 && a.silent && a.up === a.up0 && a.up > 0 && a.leaf < 0.05;
  const A = await run(true);
  verdict(onMarks(A) && A.set && A.left === 0 && A.sets === 1 && A.rows.every(m => m.arrived && m.rule && m.word.startsWith('stacked')),
    'a silent pair told to stack inside a room with unaware men in view: on its marks, each gun held on a man and not on the door, the pair is SET — \'set.\' said once, the rows say stacked, not a round fired', show(A));
  const B = await run(false);
  verdict(onMarks(B) && !B.set && B.sets === 0 && B.left === B.n && B.rows.every(m => !m.arrived && !m.rule && m.word.startsWith('stacking')),
    'the key off: the same pair on the same marks is never set — the rows say stacking, nobody says \'set.\' (the build as it was)', show(B));
  const C = await run(true, { page: true }, true);
  verdict(onMarks(C) && C.set && C.left === 0 && C.sets === 1 && C.tested === 0 && C.lockedSaid === 0 && C.rows.every(m => m.rule && m.word.startsWith('stacked')),
    'the door LOCKED and the handle tried before entry (as the page ships): set and held on a man, no hand goes to the handle — nobody says \'locked\', the pair stays stacked', show(C));
  // … and when the men they were held on are gone, the hand goes to the handle only once the gun is the door's again (the frame before each try, as testStacks sees it)
  { const { R } = C, { game, O, D } = R, t0 = D.stats.tested; let tried = -1, worst = 0, lockedSaid = 0;
    const say0 = game.say; game.say = function (this: any, gd: any, text: string, ...r: any[]) { if (/locked/.test(text)) lockedSaid++; return say0.call(this, gd, text, ...r); };
    R.post = null; for (const h of R.hostiles) if (h.state !== 'dead') killGuard(game, h, [0, 0, 1], true);
    for (let i = 0; i < 60 * 15 && tried < 0; i++) { const pre = R.team.filter((x: any) => x.state !== 'dead' && O.of(x)?.stance === 'stack' && O.of(x).watch).map((x: any) => off(x, O.of(x).watch));
      R.step(); if (D.stats.tested > t0) { tried = i; worst = Math.max(0, ...pre); } }
    game.say = say0;
    verdict(SET_BREAK || (tried > 0 && worst < 0.2 && lockedSaid > 0), 'the men they were held on are gone: the lead tries the handle only with his gun back on the door, and says what he found',
      `handle tried ${tried < 0 ? 'never in 15 s' : `${f2(tried / 60)} s after`} · the stacked lead's gun ${f2(worst)} rad off his door the frame before · 'locked' said ${lockedSaid}`); }
  const E = await run(true, { page: true, empty: true }, true);
  verdict(!E.w && E.set && E.tested > 0 && E.lockedSaid > 0 && E.up === 0 && E.rows.every(m => !m.rule), 'CONTROL — the same locked door with nobody in the room: no gun is held on a man, so the stacked lead tries the handle and says what he found',
    show(E));
  // the rule's own edges, asked of the function on the set pair: a man who has noticed, a loud squad, the fire hold off
  { const { R } = A, { game } = R, m = R.team[0], t = game.fight.opOf(m)?.tgt; const calm = SLM.silentOnMan(game, m) as boolean;
    let noticed = true, noHold = true, loud = true;
    if (t) { t.state = 'alert'; noticed = SLM.silentOnMan(game, m); t.state = 'patrol'; SILENT.holdFire = false; noHold = SLM.silentOnMan(game, m); SILENT.holdFire = true; }
    R.give('loud', AISLE); loud = SLM.silentOnMan(game, m);
    verdict(!!t && calm && !noticed && !noHold && !loud, 'the question is the order\'s own hold: true on the unaware man; false once he is alert, with the fire hold off, and for a squad told loud',
      `on ${t?.callsign ?? 'nobody'}, unaware: ${calm} · him alert: ${noticed} · holdFire off: ${noHold} · told loud: ${loud}`); R.post = null; }
  // CONTROL (plumbing, not the rule: SILENTSET_BREAK does not touch it): the stands, and what a recording carries
  { const P: any = await import(`${ROOT}/src/host/profile.ts`), E: any = await import(`${ROOT}/src/host/standEnv.ts`), J: any = await import(`${ROOT}/src/game/journal.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`);
    reset(); const W: any = await standUp(), g = W.game, stood = SILENT.stackSet, prof = P.harnessProfile() as string, env = process.env.TPS_SILENTSET, want = env !== undefined ? env === '1' : prof === 'shipped';
    verdict(stood === want && P.FROZEN_HOLDS['SILENT.stackSet'] === 'TPS_SILENTSET=1' && E.STAND_ENV.includes('TPS_SILENTSET'), `the ${prof} stand stands it ${want ? 'ON' : 'OFF'}; the key is a row of the two stands' list with its word`,
      `SILENT.stackSet as stood up: ${stood} · TPS_SILENTSET ${env ?? 'not given'} · FROZEN_HOLDS: ${P.FROZEN_HOLDS['SILENT.stackSet']} · in STAND_ENV ${E.STAND_ENV.includes('TPS_SILENTSET')}`);
    const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), all = KN.knobsCopy();
    try {
      SILENT.stackSet = true; const old = snap(); delete old.tables.SILENT; J.applyKnobs(g, old); const before = SILENT.stackSet;
      SILENT.stackSet = true; const keyless = snap(); delete keyless.tables.SILENT.stackSet; J.applyKnobs(g, keyless); const noKey = SILENT.stackSet;
      SILENT.stackSet = true; const recOn = snap(); SILENT.stackSet = false; J.applyKnobs(g, recOn); const kept = SILENT.stackSet;
      SILENT.stackSet = false; const recOff = snap(); SILENT.stackSet = true; J.applyKnobs(g, recOff); const keptOff = SILENT.stackSet;
      verdict(before === false && noKey === false && kept === true && keptOff === false && KN.JOURNAL_KNOBS.includes('SILENT'), 'a recording carries the SILENT table: one from before the key (no SILENT row, or a row without it) replays with it off, one made with it on replays on, off off',
        `no SILENT row: ${before} · a row without the key: ${noKey} · recorded on: ${kept} · recorded off: ${keptOff} · SILENT in JOURNAL_KNOBS ${KN.JOURNAL_KNOBS.includes('SILENT')}`);
    } finally { KN.knobsBack(all); } }
  return done();
});

if (import.meta.main) {
  const all: Record<string, () => Promise<boolean>> = { 'silent-order': silentOrder, 'silent-hud': silentHud, 'silent-walk': silentWalk, 'silent-doors': silentDoors, 'silent-pick': silentPick, 'silent-boot': silentBoot, 'silent-cans': silentCans, 'silent-tools': silentTools, 'silent-fire': silentFire, 'silent-hush': silentHush, 'silent-start': silentStart, 'silent-off': silentOff, 'silent-set': silentSet };
  const want = process.argv.slice(2).filter(a => !a.startsWith('--')); let ok = true;
  for (const [name, fn] of Object.entries(all)) if (!want.length || want.includes(name)) ok = (await fn()) && ok;
  process.exit(ok ? 0 : 1);
}
