// THE PLAYER CARRIES AND SETS CHARGES LIKE THE SQUAD (src/game/owncharge.ts — the card's rows in kit.ts, a door charge by hand in doortools.ts), headless:
//   bun run tools/qa/owncharge-check.ts [kit|door|squad|save|off]      (probes.ts owncharge; OWNCHARGE_BREAK=1 = the switch left off: must fail)
// The maintainer, 10-12: "weird that i can't use wall charges or door charges myself, should be symmetric" · "we should just remove the max one wall charge
// per squad limitation. maybe we can say that it takes up two slots".
//   kit     your card has a 'Door charges' and a 'Wall charges' row only with the switch, at the teammates' own pouch prices (one, two) and their own two a
//           man; the issued card is full, so a charge is refused until a pouch is given up; what you carry is in the squad's count; a visit with the switch
//           off shows no row, counts nothing and keeps the stored counts; two teammates may each carry a wall charge (no squad cap). WHERE THE BUILD HAS
//           THE KIT'S ONE BIG SLOT (kit.ts BIGSLOT) both cards are asked: a row a thing (those lines, the big slot held off — the page under ?nobigslot),
//           then the big slot on (the page as it opens): your wall charge is the 'Big slot' row's 'wall charge', offered only with the switch, as a
//           teammate's is, it fills no pouch, counts in the squad's bag, and nothing caps the squad
//   door    alone in the office: the count is your card's — the STEALTH card's where a night alone wears one (kit.ts KITDEAL.stealth: none as issued, the
//           loud card's are not that run's; the lines below put theirs on the card the run wears) — (none carried = no row), the row sets one in the squad's own setSecs, a plain save waits, a step
//           breaks it off with nothing spent, a door that comes open hands it back, F blows it, a restart puts the card's count back with nothing left set;
//           on a locked door the row is one more row, none of the lock's rows gives way
//   squad   the room clear: a charge set by hand comes out of the squad's bag, and what it does when it goes is what a teammate's does on the same door (the
//           man inside the knock reach down, the room's other man blind and folded); told the charge row on that door the squad stands off with nobody at
//           the lock and nothing more spent, and F sends them in behind it
//   save    alone: a checkpoint's player slice carries the counts with a set charge back in them, a load puts them back; no slice with the switch off
//   off     the switch off, and the switch on with charges carried and never used: the same run by digest; the two stands' row and the registry
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switch itself. Nothing here looks at a picture.
import { standUp, ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';

const { OWNCHARGE } = await import(`${ROOT}/src/game/owncharge.ts`);
const { KITLOAD } = await import(`${ROOT}/src/game/kitload.ts`);
const K = await import(`${ROOT}/src/game/kit.ts`);
/** the kit's one big slot, where the build has one (undefined before it: every card is a row a thing) */
const BIG: { on: boolean } | undefined = (K as any).BIGSLOT;
const { DOORTOOLS, doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const SAVE = await import(`${ROOT}/src/game/savestate.ts`);
const { runningVerb } = await import(`${ROOT}/src/game/interact.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const J = (o: unknown) => JSON.stringify(o), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const BREAK = process.env.OWNCHARGE_BREAK === '1';
const raise = () => { OWNCHARGE.on = !BREAK; };   // (the frozen stand pins the switch off as it stands a game up: raised after)
const memStore = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const isOpen = (d: any) => !d.latched && Math.abs(d.angle) >= 0.6;
/** the kit table, its rules and the switch as they stood, put back after `fn` (the store the table writes to is left on nothing) */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const cards = K.KIT.members.map((m: any) => ({ ...m })), on = K.KIT.on, slots = K.SLOTS.on, own = OWNCHARGE.on, big = BIG?.on, solo = { ...K.KIT_SOLO }, rnd = Math.random;
  try { return await fn(); } finally { K.kitLoad(null, ''); if (BIG) BIG.on = !!big; for (let i = 0; i < cards.length; i++) K.KIT.members[i] = cards[i]; K.KIT.on = on; K.SLOTS.on = slots; OWNCHARGE.on = own; Object.assign(K.KIT_SOLO, solo); Math.random = rnd; }
}
/** YOUR CARD FOR A NIGHT ALONE, AS THE BUILD STAGES IT. Where a stealth mission wears a card of its own (kit.ts KITDEAL.stealth, on in the page: the night
 *  alone is one) the charges go on THAT card, the way the loadout screen would have them there: as issued its pouches are full of the mission's kit, so what
 *  fills them besides the launcher's rounds is given up for the charges (kitMission stands the stealth card first, and keeps it as it is put back). The loud
 *  card gets the same counts, which is all there is where no stealth card exists or the run is a loud one. Then the staging a man alone gets. */
function soloWith(g: any, counts: { charges?: number; walls?: number }) {
  Object.assign(K.KIT.members[0], counts);
  if ((K as any).kitStealthOn?.()) { K.kitMission(K.kitStealthHand(0, false)); const m: any = K.KIT.members[0];
    for (const f of ['smoke', 'bangs', 'frags', 'shells', 'cams']) m[f] = 0; m.wand = false; Object.assign(m, counts); K.kitMission(null); }
  K.kitSolo(g);
}
const fields = (i: number) => K.kitRows(i).map((r: any) => r.field as string);
/** a member's pouches emptied (the cans, the grenades, the charges): room for what a check puts on him */
const empty = (i: number) => { for (const f of ['smoke', 'bangs', 'frags', 'shells', 'charges', 'walls']) (K.KIT.members[i] as any)[f] = 0; (K.KIT.members[i] as any).wand = false; };
/** what member i's 'Big slot' row offers (none where the build or the stand has no such row) */
const bigVals = (i: number): string[] => (K.kitRows(i).find((r: any) => r.field === 'big')?.values ?? []) as string[];
/** … and his card with nothing in its pouches or its big slot */
const bare = (i: number) => { empty(i); K.kitSet(i, 'big' as any, 'none'); };
/** the face of `d` the corridor is on (the office's rooms open off it to +x of the break room's west door: asked of the geometry, not assumed) */
const faceToward = (d: any, p: number[]): 1 | -1 => (dist(doorPt(d, d.def.width / 2, 1, 1), p) <= dist(doorPt(d, d.def.width / 2, 1, -1), p) ? 1 : -1);
const doorRows = (g: any) => g.nearby.filter((x: any) => x.kind === 'door');
/** a leaf put home on its latch (the office's inside doors stand open as authored) */
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; };
/** Sam stood at arm's length off the middle of the leaf on `side`, the rows read */
function standAt(R: any, d: any, side: 1 | -1, off = 0.75) { R.game.teleportPlayer(doorPt(d, d.def.width / 2, off, side)); R.step(12); return doorRows(R.game); }
/** the row picked and one Space → did it start */
function begin(R: any): boolean { const ok = R.game.selectVerb('door', 'charge'); if (ok) { R.input.pressed.add('Space'); R.step(); } return ok && !!R.game.player.charging; }
/** … and held to the end → seconds it took (NaN: never set) */
function setByHand(R: any, d: any, side: 1 | -1): number {
  standAt(R, d, side); const n0 = R.D.set.length, t0 = R.game.time; if (!begin(R)) return NaN;
  const ok = R.until(() => R.D.set.length > n0 || !R.game.player.charging, DOORTOOLS.setSecs + 2) && R.D.set.length > n0, secs = R.game.time - t0; R.step(3); return ok ? secs : NaN;
}

// ───────────────────────────────────────────────────────────── kit
export async function ownchargeKit(): Promise<boolean> {
  const F = family('owncharge-kit: your card carries door and wall charges at the teammates\' prices, and they count in the squad\'s bag');
  await kept(async () => {
    await hushed(() => standUp());   // (the tables stood as the stand has them)
    K.kitLoad(null, ''); K.KIT.on = true; K.SLOTS.on = true;
    if (BIG) BIG.on = false;   // A ROW A THING first (the build before the big slot, and the page under ?nobigslot); the big slot's own lines are at the foot
    OWNCHARGE.on = false; const off = fields(0), pool0 = K.kitPool(4).charges, mate = fields(1);
    raise(); const on = fields(0), walls = K.wallHere();
    F.verdict(!off.includes('charges') && !off.includes('walls') && on.includes('charges') && (!walls || on.includes('walls')) && J(fields(1)) === J(mate) && mate.includes('charges'),
      'the two rows are on YOUR card only with the switch; a teammate\'s card is the same either way', `off: ${off.join(' ')} · on: ${on.join(' ')} · a teammate: ${mate.join(' ')}`);
    const full = K.kitTry(0, 'charges', 1), give = K.kitTry(0, 'frags', -1), one = K.kitTry(0, 'charges', 1), cost1 = K.kitRowCost(0, K.kitRows(0).find((r: any) => r.field === 'charges'));
    const mateCost = K.kitRowCost(1, K.kitRows(1).find((r: any) => r.field === 'charges'));
    F.verdict(!full.ok && /pouch/.test(full.why) && give.ok && one.ok && one.value === 1 && cost1?.pouches === 1 && cost1.rate === mateCost?.rate && K.kitPool(4).charges === pool0 + 1,
      'the issued card is full: a door charge is refused until a pouch is given up, then it takes one pouch — a teammate\'s rate — and is in the squad\'s count', `full: "${full.why}" · after a frag given up: ${J(one)} · cost ${J(cost1)} (a teammate's rate: ${mateCost?.rate}) · squad's charges ${pool0} → ${K.kitPool(4).charges}`);
    empty(0); const vals = (i: number, f: string) => (K.kitRows(i).find((r: any) => r.field === f)?.values ?? []).join(','), a = K.kitSet(0, 'charges', 1), b = K.kitSet(0, 'charges', 2), c = K.kitSet(0, 'charges', 3);
    F.verdict(a && b && !c && K.KIT.members[0].charges === 2 && vals(0, 'charges') === vals(1, 'charges'), 'two door charges a man at most, yours as a teammate\'s', `set 1 ${a} · set 2 ${b} · set 3 ${c} · carried ${K.KIT.members[0].charges} · the row offers ${vals(0, 'charges')} (a teammate's: ${vals(1, 'charges')})`);
    if (walls) {
      empty(0); const w1 = K.kitSet(0, 'walls', 1), wc = K.kitRowCost(0, K.kitRows(0).find((r: any) => r.field === 'walls')), w2 = K.kitSet(0, 'walls', 2), used = K.kitCost(0), more = K.kitTry(0, 'charges', 1), w3 = K.kitSet(0, 'walls', 3);
      F.verdict(w1 && wc?.pouches === 2 && w2 && !w3 && !more.ok && used.used === 4 && K.kitWalls(4) >= 2, 'a wall charge is two of your four pouches: two fill the card, and nothing more goes on it', `set 1 ${w1} (${J(wc)}) · set 2 ${w2} · set 3 ${w3} · pouches ${used.used} of ${used.total} · a door charge on top: "${more.why}" · squad's wall charges ${K.kitWalls(4)}`);
      empty(0); empty(1); empty(2); const m1 = K.kitTry(1, 'walls', 1), m2 = K.kitTry(2, 'walls', 1), m1b = K.kitTry(1, 'walls', 1), legal = K.kitLegal(), mine = K.kitTry(0, 'walls', 1);
      F.verdict(m1.ok && m2.ok && m1b.ok && K.KIT.members[1].walls === 2 && legal === null && mine.ok && K.kitWalls(4) === 4, 'NO SQUAD CAP: two teammates each carry a wall charge, one of them two, and you one more — the pouches are the limit',
        `Red One +1 ${m1.ok} · Red Two +1 ${m2.ok} "${m2.why}" · Red One +1 ${m1b.ok} · the cards are legal: ${legal === null ? 'yes' : legal} · you +1 ${mine.ok} · the squad of four carries ${K.kitWalls(4)}`);
    } else F.verdict(true, '(no wall charge rows in this build: the wall lines are not asked)', '');
    // the store across a visit with the switch off
    const store = memStore(); K.kitLoad(store, ''); raise(); empty(0); K.kitTry(0, 'charges', 1); if (walls) K.kitTry(0, 'walls', 1); K.kitSave();
    const had = { c: K.KIT.members[0].charges, w: K.KIT.members[0].walls };
    OWNCHARGE.on = false; K.kitLoad(store, ''); const offRows = fields(0), offPool = K.kitPool(4).charges, offWalls = K.kitWalls(4); K.kitTry(0, 'smoke', 1); K.kitSave();
    raise(); K.kitLoad(store, ''); const back = { c: K.KIT.members[0].charges, w: K.KIT.members[0].walls };
    F.verdict(had.c === 1 && !offRows.includes('charges') && !offRows.includes('walls') && back.c === had.c && back.w === had.w && K.KIT.members[0].smoke === 1,
      'a visit with the switch off shows no row, counts nothing of yours, and a row changed there does not write your charges out of the store', `kept ${J(had)} · off: rows ${offRows.join(' ')}, squad's charges ${offPool}, walls ${offWalls} · back on: ${J(back)}, smoke ${K.KIT.members[0].smoke}`);
    if (BIG) {   // ONE BIG SLOT A CARD (the page as it opens): the door charge row as above; the wall charge is the big row's 'wall charge'
      K.kitLoad(null, ''); BIG.on = true;
      OWNCHARGE.on = false; const offB = fields(0), offBig = bigVals(0), mateB = J([fields(1), bigVals(1)]);
      raise(); const onB = fields(0), onBig = bigVals(0);
      F.verdict(!offB.includes('charges') && !offBig.includes('wall') && onB.includes('charges') && !onB.includes('walls') && (!walls || (onBig.includes('wall') && bigVals(1).includes('wall'))) && J([fields(1), bigVals(1)]) === mateB,
        'with one big slot a card: the door charge row, and the big slot\'s wall charge, are yours only with the switch; a teammate\'s card is the same either way',
        `off: ${offB.join(' ')} · big slot offers ${offBig.join(',')} · on: ${onB.join(' ')} · big slot offers ${onBig.join(',')} · a teammate's: ${bigVals(1).join(',')}`);
      if (walls) {
        bare(0); bare(1); bare(2); const p0 = K.kitCost(0).used, w = K.kitSet(0, 'big' as any, 'wall'), mine = K.KIT.members[0].walls, p1 = K.kitCost(0).used, old = K.kitSet(0, 'walls', 0) && K.KIT.members[0].walls === 0 && K.kitSet(0, 'walls', 1);
        const m1 = K.kitSet(1, 'big' as any, 'wall'), m2 = K.kitSet(2, 'big' as any, 'wall'), legal = K.kitLegal(), sum = K.KIT.members.slice(0, 5).reduce((n: number, m: any) => n + m.walls, 0);
        F.verdict(w && mine >= 1 && p1 === p0 && old && m1 && m2 && K.KIT.members[1].walls >= 1 && K.KIT.members[2].walls >= 1 && legal === null && K.kitWalls(4) === sum && sum >= 3,
          'the big slot: your wall charge rides there as a teammate\'s does and fills no pouch; NO SQUAD CAP — you and two teammates each carry one, all in the squad\'s bag',
          `yours set ${w} (carried ${mine}, pouches ${p0} → ${p1}) · by the old row's name, off and on again: ${old} · Red One ${m1} · Red Two ${m2} · the cards are legal: ${legal === null ? 'yes' : legal} · the squad of four carries ${K.kitWalls(4)}`);
      }
      const storeB = memStore(); K.kitLoad(storeB, ''); raise(); bare(0); K.kitTry(0, 'charges', 1); if (walls) K.kitSet(0, 'big' as any, 'wall'); K.kitSave();
      const hadB = { c: K.KIT.members[0].charges, w: K.KIT.members[0].walls };
      OWNCHARGE.on = false; K.kitLoad(storeB, ''); const offRowsB = fields(0), offBigB = bigVals(0), offPoolB = K.kitPool(4).charges, offWallsB = K.kitWalls(4); K.kitTry(0, 'smoke', 1); K.kitSave();
      raise(); K.kitLoad(storeB, ''); const backB = { c: K.KIT.members[0].charges, w: K.KIT.members[0].walls };
      F.verdict(hadB.c === 1 && (!walls || hadB.w >= 1) && !offRowsB.includes('charges') && !offBigB.includes('wall') && backB.c === hadB.c && backB.w === hadB.w && K.KIT.members[0].smoke === 1,
        'the big slot: a visit with the switch off offers neither, counts nothing of yours, and a row changed there does not write your charges out of the store', `kept ${J(hadB)} · off: rows ${offRowsB.join(' ')}, big slot offers ${offBigB.join(',')}, squad's charges ${offPoolB}, walls ${offWallsB} · back on: ${J(backB)}, smoke ${K.KIT.members[0].smoke}`);
    }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── door (alone)
export async function ownchargeDoor(): Promise<boolean> {
  const F = family('owncharge-door: alone, the count is your card\'s; a row of a shut door sets one in the squad\'s own time; F blows it');
  await kept(async () => {
    const R: any = await hushed(() => rig(11, { stage: false })); const { game: g, D } = R; raise();
    K.KIT.on = true; const d = R.door('breakroom_w'), side = faceToward(d, [20, 0, 18.9]); shut(d);
    if ((K as any).kitStealthOn?.()) { K.KIT.members[0].charges = 2; (K as any).kitStealthSet(null); K.kitSolo(g);   // (kit.ts KITDEAL.stealth: the night alone is a stealth mission)
      F.verdict(D.charges === 0, 'a night alone wears the stealth card: as issued it carries no charge, and two on the loud card are not this run\'s', `count ${D.charges} · the loud card's ${K.KIT.members[0].charges}`); }
    soloWith(g, { charges: 0 }); const none = standAt(R, d, side);
    F.verdict(D.charges === 0 && !none.some((r: any) => r.verb === 'charge') && none.length > 0, 'none on your card: none in the count, and no door offers one', `count ${D.charges} · the door's rows: ${none.map((r: any) => r.verb).join(' ')}`);
    soloWith(g, { charges: 2 }); const rows = standAt(R, d, side), row = rows.find((r: any) => r.verb === 'charge');
    F.verdict(D.charges === 2 && !!row && /set a charge · 2 left/.test(row.line2) && /F  blows it once set/.test(row.line2), 'two on your card: two in the count, and the shut door\'s rows have "set a charge · 2 left"', `count ${D.charges} · rows: ${rows.map((r: any) => `${r.verb} "${r.line2}"`).join(' | ')}`);
    { const pl: any = g.player, face = () => (D as any).samFace(d), free = face(), h0 = pl.holding, d0 = pl.dragging; pl.holding = {}; const held = face(); pl.holding = h0; pl.dragging = {}; const tow = face(); pl.dragging = d0;
      F.verdict(free !== null && held === null && tow === null, 'not with a man in his arm or a body in tow: his hands are full', `hands free: face ${free} · a man held: ${held} · a body in tow: ${tow}`); }
    // broken off by a step: nothing spent
    const started = begin(R); R.step(30); const busy = SAVE.playerBusy(g), verb = runningVerb(g), running = g.nearby.map((r: any) => `${r.line1} ${r.line2 ?? ''}`).join(' | ');
    R.input.keys.add('KeyS'); R.input.pressed.add('KeyS'); R.step(40); R.input.keys.delete('KeyS');
    F.verdict(started && busy === 'setting a charge' && verb === `charge:${d.def.name}` && /setting the charge/.test(running) && !g.player.charging && D.charges === 2 && D.set.length === 0 && R.said.includes('charge not set'),
      'while his hands are on it a plain save waits; a step breaks it off with nothing spent', `started ${started} · save: ${busy} · running verb ${verb} · the row: ${running} · after the step: charging ${!!g.player.charging}, count ${D.charges}, set ${D.set.length} · said: ${R.said.slice(-2).join(' / ')}`);
    // set, to the end
    const secs = setByHand(R, d, side), c = D.set[0]; R.step(3); const line = doorRows(g).map((r: any) => r.line1).join(' | ');
    F.verdict(Math.abs(secs - DOORTOOLS.setSecs) < 0.25 && D.charges === 1 && D.set.length === 1 && c?.door === d && c.by === 'Sam' && c.side === side && /charge set · press F to blow it/.test(line) && !doorRows(g).some((r: any) => r.verb === 'charge'),
      'held to the end it is on the door after the squad\'s own setSecs, one spent, and the door\'s lines say F blows it', `${f2(secs)} s (setSecs ${DOORTOOLS.setSecs}) · count ${D.charges} · set ${D.set.length} by ${c?.by} · rows: ${line}`);
    // the door comes open: the charge is off it, back in the count
    d.latched = false; d.angle = (d.swing || 1) * 1.2; R.step(2);
    F.verdict(D.set.length === 0 && D.charges === 2 && R.said.some((t: string) => /came open, so the charge came off/.test(t)), 'the door comes open under it: the charge is off the door and back in the count', `set ${D.set.length} · count ${D.charges} · said: ${R.said.slice(-1)[0]}`);
    // F, on another door (a locked one: the row is one more row there)
    const m = R.door('manager'); shut(m); g.player.crouch = true; OWNCHARGE.on = false; const ms: 1 | -1 = standAt(R, m, 1).some((r: any) => r.verb === 'pick') ? 1 : -1; const lockRows0 = standAt(R, m, ms).map((r: any) => r.verb); raise(); const lockRows = standAt(R, m, ms).map((r: any) => r.verb); g.player.crouch = false;
    F.verdict(m.locked && lockRows0.includes('pick') && lockRows0.length === 3 && lockRows.includes('charge') && lockRows0.every((v: string) => lockRows.includes(v)) && lockRows.length === lockRows0.length + 1,
      'on a locked door the charge is ONE MORE row: every row the lock had is still there', `switch off: ${lockRows0.join(' ')} · on: ${lockRows.join(' ')}`);
    const secs2 = setByHand(R, m, ms); g.teleportPlayer(doorPt(m, m.def.width / 2 + 2.6, 1.0, ms)); R.step(8); const blown0 = D.stats.blown, bangs0 = R.bangs.length;
    R.press('KeyF'); R.step(2);
    F.verdict(secs2 > 0 && D.stats.blown === blown0 + 1 && D.set.length === 0 && R.bangs.length === bangs0 + 1 && (m.off || (!m.latched && m.lockBroken)) && D.charges === 1,
      'F blows it: one blast, the locked door broken open, and that charge is spent', `set in ${f2(secs2)} s · blown ${D.stats.blown - blown0} · blasts ${R.bangs.length - bangs0} · latched ${m.latched}, lock broken ${m.lockBroken}, off its hinges ${!!m.off} · count ${D.charges}`);
    // a restart: the card's count again, nothing left set
    const st = R.door('storage'), ss = faceToward(st, [30.8, 0, 11.2]); shut(st); R.step(2); const secs3 = setByHand(R, st, ss), before = { n: D.charges, set: D.set.length };
    await hushed(() => g.restartEncounter()); R.step(5);
    F.verdict(secs3 > 0 && before.n === 0 && before.set === 1 && D.charges === 2 && D.set.length === 0 && !g.player.charging, 'a restart: your card\'s two again, and the charge left on a door last run is gone with the run', `before: count ${before.n}, set ${before.set} · after: count ${D.charges}, set ${D.set.length}`);
    { // the kit rule off (no card to read the count from): the run's own spent charges are handed back to the bag a fresh run starts with
      K.KIT.on = false; shut(st); R.step(2); const n0 = D.charges, s4 = setByHand(R, st, ss), mid = { n: D.charges, set: D.set.length, spent: D.samSpent }; await hushed(() => g.restartEncounter()); R.step(5); K.KIT.on = true;
      F.verdict(s4 > 0 && mid.n === n0 - 1 && mid.set === 1 && mid.spent === 1 && D.charges === n0 && D.set.length === 0 && D.samSpent === 0, 'the same with the kit rule off: the charge left set is gone and its one is back in the bag', `before: ${n0} · set: ${J(mid)} · after the restart: count ${D.charges}, set ${D.set.length}, spent ${D.samSpent}`); K.kitSolo(g); }
    if (K.wallHere()) {
      K.SLOTS.on = true; soloWith(g, { walls: 1 }); const w1 = g.wallCharge.carried, can1 = g.wallCharge.affordable; soloWith(g, { walls: 0 }); const w0 = g.wallCharge.carried, can0 = g.wallCharge.affordable;
      F.verdict(w1 === 1 && can1 && w0 === 0 && !can0, 'wall charges alone are your card\'s too: one carried = one to set by hand, none = none (door charges do not pay for a wall)', `card 1: carried ${w1}, can set ${can1} · card 0: carried ${w0}, can set ${can0} (door charges in the count: ${D.charges})`);
    }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── squad
export async function ownchargeSquad(): Promise<boolean> {
  const F = family('owncharge-squad: your charge is the squad\'s charge — the same bag, the same blast, and they stand off and go in behind it');
  await kept(async () => {
    const K0 = DOORTOOLS;
    /** the break room's west door charged and blown with one of the room's men stood a stride inside it: by Sam's hands, or by the squad's order */
    const blast = async (hand: boolean) => {
      const R: any = await hushed(() => rig(7, { door: 'breakroom_w' })); raise(); const { D, game: g } = R; const d = R.door('breakroom_w'), room = R.room('breakroom'), side = faceToward(d, [20, 0, 18.9]);
      const n0 = D.charges; let secs = NaN, why: string | null = null;
      if (hand) { secs = setByHand(R, d, side); g.teleportPlayer([25.0, 0, 18.9]); R.step(5); }
      else { why = R.give('charge', 'breakroom_w'); const t0 = g.time; R.until(() => D.ops[0]?.phase === 'armed', 45); secs = g.time - t0; }
      const spent = n0 - D.charges, by = D.set[0]?.by;
      const near = room.defenders[0], far = room.defenders[1]; near.char.pos[0] = d.frameCentre[0] + 1.3; near.char.pos[2] = d.frameCentre[2]; R.step(2);
      const farD = dist(far.char.pos, d.frameCentre); let res: any = null; { const blow = D.blow.bind(D); D.blow = (c: any) => (res = blow(c)); }
      R.press('KeyF');
      const out = { blown: D.stats.blown, set: D.set.length, blasts: R.bangs.length, doorIn: !!d.off || (!d.latched && !!d.lockBroken), near: `${near.state}/${near.downKind}`, knocked: res?.knocked ?? -1,
        farHit: farD >= K0.stunM ? 'out of reach' : far.state === 'dead' ? 'down' : far.dazzledUntil - g.time > K0.stunSecs[1] - 0.1 && far.staggerUntil - g.time > K0.staggerSecs - 0.1 ? 'blind and folded' : 'untouched' };
      return { R, d, side, secs, why, spent, by, out, res, farD };
    };
    const A = await blast(true), B = await blast(false);
    F.verdict(A.secs > 0 && A.spent === 1 && B.spent === 1 && A.by === 'Sam' && B.by !== 'Sam' && B.why === null, 'either way one charge leaves the squad\'s one bag', `by hand: set in ${f2(A.secs)} s, spent ${A.spent}, by ${A.by} · by order: armed in ${f2(B.secs)} s, spent ${B.spent}, by ${B.by}`);
    F.verdict(J(A.out) === J(B.out) && A.out.blown === 1 && A.out.doorIn && A.out.near === 'dead/struck' && A.out.farHit !== 'untouched',
      'and it does the same when it goes: the door in, the man a stride inside it down (out cold), the room\'s other man blind and folded', `by hand:  ${J(A.out)}\n    by order: ${J(B.out)} (the other man ${f2(B.farD)} m in)`);
    // the squad on a charge set by hand
    const R: any = await hushed(() => rig(7, { door: 'breakroom_w' })); raise(); const { D, O, game: g } = R; const d = R.door('breakroom_w'), side = faceToward(d, [20, 0, 18.9]);
    setByHand(R, d, side); g.teleportPlayer([25.0, 0, 18.9]); R.step(5); const n1 = D.charges;
    const row = R.menuOn(d.frameCentre)?.tools?.rows.find((r: any) => r.key === '3');
    const w = R.give('charge', 'breakroom_w'), op = D.ops[0]; const armed = R.until(() => op?.phase === 'armed', 45);
    const off = R.ops.map((x: any) => dist(x.char.pos, d.frameCentre)), lock = (op?.beats ?? []).some((b: any) => /^set|setter|sets it/.test(b.what));
    F.verdict(/^stand off · in behind the charge/.test(row?.text ?? '') && !row.off && w === null && armed && D.charges === n1 && D.set.length === 1 && !lock && off.every((x: number) => x > K0.backblastM) && d.latched,
      'told the charge row on that door ("stand off · in behind the charge") they stand off past the backblast: nobody goes to the lock, nothing more is spent, nothing goes off', `row 3: ${row?.text} · ${R.beats(op)} · count ${n1} → ${D.charges} · set ${D.set.length} · the pair ${off.map(f2).join(' / ')} m off (backblast ${K0.backblastM})`);
    const hud = O.hud().status.flatMap((r: any) => r.opts.map((o: any) => o.text)).join(' / ');
    g.teleportPlayer(doorPt(d, d.def.width / 2, 0.8, side)); R.step(20); const close = D.closeWords(D.set[0]), hudNear = (D.hudNotes() as string[]).join(' / '), doorLine = doorRows(g).map((r: any) => r.line1).join(' | '); g.teleportPlayer([25.0, 0, 18.9]); R.step(4);
    R.press('KeyF'); const crossed = R.until(() => op.crossed.size > 0, 8);
    F.verdict(D.stats.blown === 1 && crossed && (isOpen(d) || !!d.off), 'F: it goes, and they are in behind it as behind their own', `${R.beats(op)}`);
    F.verdict(/charge set/.test(hud), 'the squad block says a charge is set and which key blows it', hud);
    const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`);
    F.verdict((SAMSTUN.on ? /too close: you/.test(close) : !/you/.test(close)) && (!close || hudNear.includes(close.replace('too close:', 'TOO CLOSE:').replace('behind the door:', 'BEHIND THE DOOR:'))), SAMSTUN.on ? 'stood at the door with it set, the words name you as too close, on the door\'s line and on the squad block\'s' : '(blasts do not stun the player on this stand: the words do not name you)', `at 0.8 m: "${close}" · block: ${hudNear}`);
    // (the door's header is one line the HUD cuts at its end: the names come AHEAD of the hint, so the cut takes the hint)
    F.verdict(!close || (doorLine.includes(close) && doorLine.indexOf(close) < doorLine.indexOf(' · charge set · ')), 'on the door\'s own line the names come before "charge set · F blows it"', doorLine);
    { // both at once: his hands on a door the squad is then ordered to charge — one charge, the squad's
      const R3: any = await hushed(() => rig(7, { door: 'breakroom_w' })); raise(); const D3 = R3.D, g3 = R3.game, d3 = R3.door('breakroom_w'), s3 = faceToward(d3, [20, 0, 18.9]); const n3 = D3.charges;
      standAt(R3, d3, s3); const st3 = begin(R3); R3.step(20); const w3 = R3.give('charge', 'breakroom_w'); R3.step(3); const let3 = !g3.player.charging, mid3 = D3.charges;
      g3.teleportPlayer([25.0, 0, 18.9]); const arm3 = R3.until(() => D3.ops[0]?.phase === 'armed', 45);
      F.verdict(st3 && w3 === null && let3 && mid3 === n3 && arm3 && D3.charges === n3 - 1 && D3.set.length === 1 && D3.set[0].by !== 'Sam' && D3.samSpent === 0,
        'the squad ordered to charge a door your hands are on: yours is broken off with nothing spent, and ONE charge goes on it — theirs', `started ${st3} · order ${w3 ?? 'taken'} · hands off ${let3} (count ${mid3} of ${n3}) · armed ${arm3}: count ${D3.charges}, set ${D3.set.length} by ${D3.set[0]?.by}`); }
    // the staging: your card's charges in the bag the squad spends
    if (K.wallHere()) {
      K.KIT.on = true; K.SLOTS.on = true; for (let i = 0; i < 3; i++) empty(i); K.KIT.members[0].charges = 1; K.KIT.members[1].charges = 1; K.KIT.members[1].walls = 1; K.KIT.members[2].walls = 1;
      const R2: any = await hushed(() => rig(7, { stage: false })); raise(); await hushed(() => R2.RC.start(7)); R2.step(5); const n = R2.ops.length;
      F.verdict(n === 2 && R2.D.charges === 2 && R2.game.wallCharge.carried === 2, 'staged with a pair: your door charge and Red One\'s are one count of two, and the two wall charges two teammates carry are both in the run', `teammates ${n} · door charges ${R2.D.charges} · wall charges ${R2.game.wallCharge.carried}`);
    }
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── save
export async function ownchargeSave(): Promise<boolean> {
  const F = family('owncharge-save: alone, a checkpoint carries your counts and a charge left set on a door');
  await kept(async () => {
    const R: any = await hushed(() => rig(13, { stage: false })); const { game: g, D } = R; raise();
    K.KIT.on = true; soloWith(g, { charges: 2 }); const d = R.door('breakroom_w'), side = faceToward(d, [20, 0, 18.9]); shut(d);
    setByHand(R, d, side); g.teleportPlayer([25.0, 0, 18.9]); R.step(20);
    const s1 = SAVE.saveState(g, { kind: 'harness', force: true });
    R.press('KeyF'); R.step(30); const s2 = SAVE.saveState(g, { kind: 'harness', force: true }), after = { n: D.charges, set: D.set.length };
    const di = g.doors.list.indexOf(d);
    F.verdict(s1.player.own?.charges === 1 && J(s1.player.own?.doors) === J([[di, side]]) && s1.player.own?.spent === 1 && s2.player.own?.charges === 1 && !s2.player.own?.doors?.length && after.n === 1 && after.set === 0,
      'one set and not blown: the file has the one left in the bag and the charge on its door; blown: one left, nothing set', `set, unblown: ${J(s1.player.own)} · blown: ${J(s2.player.own)} · in play then: count ${after.n}, set ${after.set}`);
    await hushed(() => SAVE.loadState(g, s1)); R.step(3); const l1 = { n: D.charges, set: D.set.length, on: D.set[0]?.door === g.doors.list[di] && D.set[0]?.side === side && D.set[0]?.by === 'Sam', shut: g.doors.list[di].latched };
    const blown0 = D.stats.blown; R.press('KeyF'); R.step(3); const l1b = { blown: D.stats.blown - blown0, n: D.charges, set: D.set.length };
    await hushed(() => SAVE.loadState(g, s2)); R.step(3); const l2 = { n: D.charges, set: D.set.length };
    const old = JSON.parse(JSON.stringify(s2)); delete old.player.own; await hushed(() => SAVE.loadState(g, old)); R.step(3); const l3 = D.charges;
    F.verdict(l1.n === 1 && l1.set === 1 && l1.on && l1b.blown === 1 && l1b.set === 0 && l1b.n === 1 && l2.n === 1 && l2.set === 0 && l3 === 2,
      'a load puts the count back AND the charge on its door, where F blows it; a file from before the counts were saved gets the staging\'s (your card\'s)', `first file: ${J(l1)}, then F: ${J(l1b)} · second: ${J(l2)} · a file without the counts: ${l3}`);
    await hushed(() => SAVE.loadState(g, s1)); R.step(3); await hushed(() => g.restartEncounter()); R.step(5);
    F.verdict(D.charges === 2 && D.set.length === 0 && D.samSpent === 0, 'a restart after that load: your card\'s two, nothing set', `count ${D.charges} · set ${D.set.length} · spent ${D.samSpent}`);
    OWNCHARGE.on = false; const s0 = SAVE.saveState(g, { kind: 'harness', force: true });
    F.verdict(!('own' in s0.player), 'with the switch off the file has no such counts', `player slice keys: ${Object.keys(s0.player).filter(k => /own|wand/.test(k)).join(' ') || '(neither)'}`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── off
export async function ownchargeOff(): Promise<boolean> {
  const F = family('owncharge-off: the switch off, or charges carried and never set, is the same run');
  await kept(async () => {
    // (what a carried charge WEIGHS is the kit weight's rule, and kitload-check's to say: two carried charges slow the walk whether or not one is set. Held off in
    //  both runs here, after the stand has written it, so this asks of the row alone.)
    const weighs = KITLOAD.on;
    const run = async (on: boolean, n = on ? 2 : 0, weigh = false) => {
      const R: any = await hushed(() => rig(17, { stage: false })); OWNCHARGE.on = on; KITLOAD.on = weigh && weighs; const g = R.game; g.godMode = false; K.KIT.on = true; soloWith(g, { charges: n });
      const a = R.door('breakroom_w'), b = R.door('manager'); shut(a); shut(b); const seen = new Set<string>(); const hashes: string[] = [];
      for (let i = 0; i < 900; i++) {   // a stand at each of two shut doors (one of them locked), a walk off between: the rows are read, nothing is picked
        if (i === 0) g.teleportPlayer(doorPt(a, a.def.width / 2, 0.75, faceToward(a, [20, 0, 18.9]))); if (i === 450) g.teleportPlayer(doorPt(b, b.def.width / 2, 0.75, 1));
        if (i % 450 > 300) R.input.keys.add('KeyA'); else R.input.keys.delete('KeyA');
        R.step(); for (const r of doorRows(g)) if (r.verb) seen.add(r.verb); if (i % 150 === 149) hashes.push(hashDigest(digestGame(g, true))); }
      R.input.keys.delete('KeyA');
      return { hashes, rows: [...seen].sort().join(' '), n: R.D.charges };
    };
    const off = await run(false), on = await run(!BREAK);
    // (…and with the weight as the stand has it, the pair that weighs the same: the switch on and NO charge carried, against the switch off)
    const off2 = await run(false, 0, true), on2 = await run(true, 0, true); KITLOAD.on = weighs;
    F.verdict(J(off.hashes) === J(on.hashes) && on.rows.includes('charge') && !off.rows.includes('charge'), 'fifteen seconds at two shut doors and walking off them: the row is offered with the switch on, never used — and, what the two charges weigh apart, the run digests the same', `off: ${off.hashes.join(' ')} · rows ${off.rows}\n    on:  ${on.hashes.join(' ')} · rows ${on.rows} (carried ${on.n})`);
    F.verdict(J(off2.hashes) === J(on2.hashes) && !on2.rows.includes('charge'), 'the kit\'s weight as the stand has it: the switch on with no charge carried is the same run as the switch off', `weight ${weighs ? 'on' : 'off on this stand'} · off: ${off2.hashes.join(' ')}\n    on:  ${on2.hashes.join(' ')} · rows ${on2.rows} (carried ${on2.n})`);
    const reg = knobRegistry(), page = /OWNCHARGE\.on = !q\.has\('noowncharge'\)/.test(await Bun.file(`${ROOT}/src/host/profile.ts`).text());
    F.verdict('OWNCHARGE.on' in FROZEN_HOLDS && reg.OWNCHARGE === OWNCHARGE && page, 'the switch is one of the two stands\' rows, in the knob registry, and the page writes it on unless ?noowncharge', `frozen hold: ${FROZEN_HOLDS['OWNCHARGE.on']} · registered ${reg.OWNCHARGE === OWNCHARGE} · pageSwitches writes it: ${page}`);
  });
  return F.done();
}

if (import.meta.main) {
  const want = process.argv.slice(2); const all: [string, () => Promise<boolean>][] = [['kit', ownchargeKit], ['door', ownchargeDoor], ['squad', ownchargeSquad], ['save', ownchargeSave], ['off', ownchargeOff]];
  const bad = want.filter(w => !all.some(([n]) => n === w)); if (bad.length) { console.error(`unknown: ${bad.join(' ')} (kit door squad save off)`); process.exit(2); }
  let ok = true; for (const [n, fn] of all) if (!want.length || want.includes(n)) { try { ok = (await fn()) && ok; } catch (e) { ok = false; console.log(`- FAIL — owncharge-${n} threw\n    ${(e as Error).message}`); } }
  console.log(`\n=== owncharge-check: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1);
}
