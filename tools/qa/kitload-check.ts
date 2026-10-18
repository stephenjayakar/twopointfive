// LIGHTER KIT MOVES FASTER AND HIDES BETTER — the check behind src/game/kitload.ts (KITLOAD.on: on in the page, ?nokitload; off on the frozen stand,
// TPS_KITLOAD=1).
//   bun run tools/qa/kitload-check.ts        (also `probes.ts kitload`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
//   kitload-table   the scores as data: you as issued are the reference (×1 pace, notice and footfall); a bare card scores best and a full one worst;
//                   taking any one thing off a card never lowers a score; a fitting or a colour weighs nothing; with the pouches rule off nobody is weighed
//   kitload-you     the plain night with your card on you (kit.ts kitSolo), W held: a light card's top walk and sprint are quicker than the issued card's
//                   and a heavy card's slower; the first footfall is quieter light and louder heavy; a guard's eye builds its notice of you more slowly
//                   light and faster heavy, and the point-blank floor is the same for all three
//   kitload-mates   the room clear staged with four: the light man's legs get more than the heavy man's and never more than `paceTop`; teamPace is still a
//                   cap that may be asked twice, and a path walked at 2.0 m/s tops out at 2.0 × his factor (once, not twice); a step's gait is read off
//                   the pace he was asked for; he is noticed more slowly; a defender (no card on him) is as he was
//   kitload-off     the same seeded walk digests the same with the switch off whatever the card; with it on, an issued card digests as the switch off
//                   (the reference plays as it did) and a light card does not
//   kitload-card    the real card on a fake DOM: two bars, the issued card's grey to their notch, the highlighted row's share outlined past the bar's end
//                   (dashed: what one more would take, on a row that carries none), a lighter card's gain and a heavier one's loss; nothing shown with
//                   the switch off; no digit anywhere on the bars
//   kitload-save    a checkpoint holds the two scores while the switch is on, and a file that says nothing leaves what the staging puts on him
// KITLOAD_BREAK=1 = the floor ignores the scores with the switch on: kitload-you, kitload-mates and kitload-off must each fail (the table and the card
// hold either way: they read no floor).
// exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a pace is a number, a footfall an event's level, a bar a width on a fake element. Nobody has seen or played any of this.
import { standUp, ROOT } from './headless.ts';
import { El, withDom } from './scenario-picker-probes.ts';

const K = await import(`${ROOT}/src/game/kit.ts`);
const L = await import(`${ROOT}/src/game/kitload.ts`);
const { KITLOAD } = L;
const Gd = await import(`${ROOT}/src/game/guards.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery, teamOf } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

const DT = 1 / 60, BROKEN = process.env.KITLOAD_BREAK === '1', STAND = harnessProfile() as string;
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x)), f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the kit table, the switch, the plain night's flag and the dice as they stood, put back after `fn` */
async function kept<T>(fn: () => Promise<T> | T): Promise<T> {
  const cards = K.KIT.members.map((m: any) => ({ ...m })), on = KITLOAD.on, slots = K.SLOTS.on, big = K.BIGSLOT.on, solo = { ...K.KIT_SOLO }, rnd = Math.random;
  try { rules(); return await fn(); } finally { K.BIGSLOT.on = big; K.SLOTS.on = slots; for (let i = 0; i < cards.length; i++) K.KIT.members[i] = cards[i]; KITLOAD.on = on; Object.assign(K.KIT_SOLO, solo); Math.random = rnd; }
}
/** the two kit rules the cards below are cut for, raised on either stand (the frozen stand holds both off as a game stands up: written again after each
 *  stand-up) — a card is weighed by the rows it HAS, and the hammer's row is the big slot's */
const rules = () => { K.SLOTS.on = true; K.BIGSLOT.on = true; };
/** three cards of yours: nothing but the pistol · as issued under the pouches rule · the long gun, every pouch a smoke can, and the hammer where the stand has a big slot */
const YOU = {
  light: { weapon: 'pistol', smoke: 0, bangs: 0, frags: 0, shells: 0, wand: false, cams: 0, charges: 0, walls: 0, big: 'none' },
  issued: { weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, shells: 1, wand: false, cams: 0, charges: 0, walls: 0, big: 'none' },
  heavy: { weapon: 'rifle', smoke: 4, bangs: 0, frags: 0, shells: 0, wand: false, cams: 0, charges: 0, walls: 0, big: 'hammer' },
} as const;
const card = (i: number, over: Record<string, unknown>) => ({ ...K.kitDefault(i), ...over });

// ───────────────────────────────────────────────────────────── the table
export async function kitloadTable(): Promise<boolean> {
  const F = family('kitload-table: a card\'s two scores');
  await kept(() => {
    const R = L.loadRef(0), a = L.loadOf(0, card(0, YOU.light)), b = L.loadOf(0, card(0, YOU.issued)), c = L.loadOf(0, card(0, YOU.heavy));
    const worn = (x: any, r: any = R) => ({ ...x, refMob: r.mob, refCon: r.con });
    const say = (x: any) => `mobility ${f2(x.mob)} concealment ${f2(x.con)} (pace ×${f3(L.loadPaceK(worn(x)))}, seen ×${f3(L.loadSeenK(worn(x)))}, heard ×${f3(L.loadHeardK(worn(x)))})`;
    F.verdict(Math.abs(b.mob - R.mob) < 1e-9 && Math.abs(b.con - R.con) < 1e-9 && L.loadPaceK(worn(b)) === 1 && L.loadSeenK(worn(b)) === 1 && L.loadHeardK(worn(b)) === 1,
      'you as issued (the long gun, the pistol, one smoke, one stun, one frag, one 40 mm) are your own reference: ×1 on pace, notice and footfall', `issued: ${say(b)} · the reference: mobility ${f2(R.mob)} concealment ${f2(R.con)}`);
    { let bad = ''; for (let i = 0; i < K.KIT_MEMBERS; i++) { const w = L.loadWorn(i, K.kitDefault(i)); if (!w || L.loadPaceK(w) !== 1 || L.loadSeenK(w) !== 1 || L.loadHeardK(w) !== 1) bad ||= `member ${i}`; }
      F.verdict(!bad, 'every man as issued is ×1 against his own issue, exactly', bad || Array.from({ length: K.KIT_MEMBERS }, (_x, i) => { const r = L.loadRef(i); return `${i}: ${f2(r.mob)} / ${f2(r.con)}`; }).join(' · ')); }
    F.verdict(a.mob > b.mob && b.mob > c.mob && a.con > b.con && b.con > c.con && L.loadPaceK(worn(a)) > 1 && L.loadPaceK(worn(c)) < 1 && L.loadSeenK(worn(a)) < 1 && L.loadSeenK(worn(c)) > 1 && L.loadHeardK(worn(a)) < 1 && L.loadHeardK(worn(c)) > 1,
      'the pistol alone scores best on both and the long gun with full pouches worst; lighter is quicker, noticed more slowly and quieter', `light: ${say(a)}\n    heavy (four smoke, the hammer): ${say(c)}`);
    // one thing off any card never lowers a score, on every member, from a card filled as far as its rows go
    let worst = '', n = 0;
    for (let i = 0; i < K.KIT_MEMBERS; i++) {
      const full: any = card(i, { weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, charges: 1, shells: i ? 0 : 1, wand: true, cams: i ? 0 : 1, big: 'hammer' }), was = L.loadOf(i, full);
      for (const [f, v] of [['weapon', 'pistol'], ['smoke', 0], ['bangs', 0], ['frags', 0], ['charges', 0], ['shells', 0], ['wand', false], ['cams', 0], ['big', 'none']] as [string, unknown][]) {
        const less = L.loadOf(i, { ...full, [f]: v }); n++;
        if (less.mob < was.mob - 1e-12 || less.con < was.con - 1e-12) worst ||= `member ${i} without ${f}: ${f2(less.mob)} / ${f2(less.con)} under ${f2(was.mob)} / ${f2(was.con)}`;
      }
    }
    F.verdict(!worst, 'taking one thing off a card never lowers a score (every member, every thing)', worst || `${n} cases`);
    const base = L.loadOf(1, card(1, {})), dressed = L.loadOf(1, card(1, { light: false, nvg: false, suppressed: false, suit: 'olive', trim: 'amber' }));
    F.verdict(base.mob === dressed.mob && base.con === dressed.con && L.loadShare(1, card(1, {}), 'suit') === null && L.loadShare(1, card(1, {}), 'light') === null,
      'a fitting or a colour weighs nothing', `Red One as issued ${f2(base.mob)} / ${f2(base.con)} · with no light, no goggles, a bare muzzle, olive and amber ${f2(dressed.mob)} / ${f2(dressed.con)}`);
    K.SLOTS.on = false; const free = [0, 1].map(i => L.loadWorn(i, K.kitDefault(i))); K.SLOTS.on = true;
    F.verdict(free.every((w: unknown) => w === null) && L.loadWorn(0, card(0, YOU.light)) !== null, 'the weight is the pouches rule\'s: with that rule off nobody is weighed (free counts, no table of weights cut for them)', `rule off: ${JSON.stringify(free)} · rule on: weighed`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── you
/** the plain night under a seed, the switch as `on` says (written after the stand-up: the frozen stand holds it off as a game stands), `you` on your card and
 *  the card put on you (kitSolo) */
async function night(seed: number, you: Record<string, unknown>, on: boolean) {
  Math.random = seeded(0x4c0ad + seed * 7919);
  for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = K.kitDefault(i);
  const W: any = await hushed(() => standUp({ seed })); const g = W.game; rules(); KITLOAD.on = on; g.godMode = true;
  K.KIT.members[0] = card(0, you); K.kitSolo(g);
  const step = (n: number) => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { for (let f = 0; f < n; f++) W.step(DT); } finally { console.log = log; console.error = err; console.warn = warn; } };
  return { W, g, step };
}
/** W held for `secs` from where the night puts him (Shift with it: a sprint): his top ground speed, how far he got, and his first footfall's level */
async function walk(you: Record<string, unknown>, o: { sprint?: boolean; secs?: number; on?: boolean } = {}) {
  const R = await night(3, you, o.on ?? true), g = R.g, pl = g.player, from = [...pl.char.pos]; g.aiEnabled = false;
  R.step(20); R.W.input.keys.add('KeyW'); if (o.sprint) R.W.input.keys.add('ShiftLeft');
  let top = 0, first = NaN; const seen = new Set<any>();
  for (let f = 0; f < Math.round((o.secs ?? 1.5) / DT); f++) {
    R.step(1); top = Math.max(top, Math.hypot(pl.char.vel[0], pl.char.vel[2]));
    for (const e of g.events) if (e.kind === 'step' && e.who === undefined && !seen.has(e)) { seen.add(e); if (!Number.isFinite(first)) first = e.level; }
  }
  R.W.input.keys.delete('KeyW'); R.W.input.keys.delete('ShiftLeft');
  return { top, first, went: Math.hypot(pl.char.pos[0] - from[0], pl.char.pos[2] - from[2]), digest: hashDigest(digestGame(g)) as string, load: pl.kitLoad as { mob: number; con: number } | null };
}
export async function kitloadYou(): Promise<boolean> {
  const F = family('kitload-you: your card is your pace, your footfall and the notice you build');
  await kept(async () => {
    const a = await walk(YOU.light), b = await walk(YOU.issued), c = await walk(YOU.heavy), off = await walk(YOU.light, { on: false });
    F.verdict(a.top > b.top * 1.03 && c.top < b.top * 0.97 && Math.abs(off.top - b.top) < 1e-6, 'W held: a light card walks quicker than the issued one, a heavy one slower; with the switch off a light card walks as the issued one',
      `top walk — light ${f3(a.top)} · issued ${f3(b.top)} · heavy ${f3(c.top)} m/s · light with the switch off ${f3(off.top)} · gone in 1.5 s: ${f2(a.went)} / ${f2(b.went)} / ${f2(c.went)} m`);
    const as = await walk(YOU.light, { sprint: true }), bs = await walk(YOU.issued, { sprint: true }), cs = await walk(YOU.heavy, { sprint: true });
    F.verdict(as.top > bs.top * 1.03 && cs.top < bs.top * 0.97, 'Shift held with it: the sprint the same way', `top sprint — light ${f3(as.top)} · issued ${f3(bs.top)} · heavy ${f3(cs.top)} m/s`);
    F.verdict(a.first < b.first * 0.97 && c.first > b.first * 1.03 && Math.abs(off.first - b.first) < 1e-9, 'his first footfall on the same floor: quieter light, louder heavy; the issued level with the switch off',
      `a walking step's level — light ${f3(a.first)} · issued ${f3(b.first)} · heavy ${f3(c.first)} · light with the switch off ${f3(off.first)}`);
    // the notice a guard's eye builds of him: one game, the card changed on him and put on again
    const R = await night(3, YOU.issued, true), g = R.g, gd = g.guards.find((x: any) => x.state !== 'dead'); g.aiEnabled = false; R.step(10);
    const gain = (you: Record<string, unknown>, d: number) => { K.KIT.members[0] = card(0, you); K.kitPlayer(g); g.player.visibility = 0.6; gd.smokeTrans = 1; return Gd.sightGain(g, gd, d) as number; };
    const far = [gain(YOU.light, 6), gain(YOU.issued, 6), gain(YOU.heavy, 6)], near = [gain(YOU.light, 1), gain(YOU.issued, 1), gain(YOU.heavy, 1)];
    F.verdict(far[0] < far[1] * 0.97 && far[2] > far[1] * 1.03, 'a guard\'s eye at 6 m, the same light on you: its notice builds more slowly on a light card and faster on a heavy one', `awareness a second — light ${f3(far[0])} · issued ${f3(far[1])} · heavy ${f3(far[2])}`);
    F.verdict(near[0] === near[1] && near[1] === near[2] && near[0] > far[2], 'at his elbow (1 m) the point-blank floor is whole: the same whatever you carry', `light ${f3(near[0])} · issued ${f3(near[1])} · heavy ${f3(near[2])}`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── teammates
export async function kitloadMates(): Promise<boolean> {
  const F = family('kitload-mates: a teammate\'s card is his pace and the notice he builds');
  await kept(async () => {
    Math.random = seeded(0x51c4);
    for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = K.kitDefault(i);
    K.KIT.members[1] = card(1, { weapon: 'pistol', bangs: 0, charges: 0, frags: 0, smoke: 0 });   // Red One: a pistol and nothing else
    K.KIT.members[2] = card(2, { weapon: 'rifle', bangs: 2, charges: 2, frags: 0, smoke: 0, big: 'hammer' });   // Red Two: the long gun, four full pouches, the hammer where the stand has a big slot
    const E = (SCENARIOS as any[]).find(e => e.id === 'room-clear-four'), W: any = await hushed(() => standUp({ uploadEvery: 4 })), g = W.game; g.godMode = true; rules(); KITLOAD.on = true;
    K.KIT.members[1] = card(1, { weapon: 'pistol', bangs: 0, charges: 0, frags: 0, smoke: 0 }); K.KIT.members[2] = card(2, { weapon: 'rifle', bangs: 2, charges: 2, frags: 0, smoke: 0, big: 'hammer' });   // (again: raising a rule refits the table)
    const { why } = await hushed(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E)))); if (why) throw new Error(`room-clear-four: start refused — ${why}`);
    const team = teamOf(g) as any[], light = team.find(t => K.kitIndex(t) === 1), heavy = team.find(t => K.kitIndex(t) === 2), foe = (g.guards as any[]).find(x => x.team !== 'operative' && x.state !== 'dead');
    const legs = (gd: any, v: number) => Gd.teamLegs(g, gd, Gd.teamPace(g, gd, v)) as number;
    const pl = legs(light, 2.2), ph = legs(heavy, 2.2), top = legs(light, 2.3), kl = L.loadPaceOn(g, light) as number, kh = L.loadPaceOn(g, heavy) as number;
    F.verdict(!!light && !!heavy && pl > ph * 1.05 && pl <= KITLOAD.paceTop + 1e-9 && top <= KITLOAD.paceTop + 1e-9 && kl > 1 && kh < 1,
      `asked for a teammate's most (2.2 m/s): the light man's legs get more than the heavy man's, and never more than ${KITLOAD.paceTop} — under the sprint`, `Red One (pistol, nothing) ${f3(pl)} m/s · Red Two (long gun, four pouches, hammer) ${f3(ph)} m/s · asked for 2.3 m/s the light man gets ${f3(top)}`);
    F.verdict(Gd.teamPace(g, heavy, 2.0) === 2.0 && Gd.teamPace(g, light, 2.0) === 2.0, 'teamPace is still a cap and no more: asked twice it gives what it gave (the card is weighed once a leg, in teamLegs)', `teamPace(2.0): ${f3(Gd.teamPace(g, heavy, 2.0))} and ${f3(Gd.teamPace(g, light, 2.0))}`);
    // a path leg WALKED: the heavy man sent down a path at 2.0 m/s tops out at 2.0 × his factor — once, not twice
    { const to = foe.char.pos, was = [...heavy.char.pos]; let most = 0; Gd.goTo(g, heavy, to);
      await hushed(() => { for (let f = 0; f < 150 && heavy.pathI < heavy.path.length; f++) { Gd.followPath(g, heavy, DT, 2.0); most = Math.max(most, heavy.speed); } });
      F.verdict(heavy.path.length > 0 && Math.abs(most - 2.0 * kh) < 0.04, 'the heavy man walked down a path asked at 2.0 m/s: his top speed is 2.0 × his factor — the card weighed once', `top ${f3(most)} m/s · his factor ×${f3(kh)} → ${f3(2.0 * kh)} (twice would be ${f3(2.0 * kh * kh)}) · ${f2(Math.hypot(heavy.char.pos[0] - was[0], heavy.char.pos[2] - was[2]))} m walked`); }
    F.verdict((L.loadGait(g, light, 2.0 * kl) as number) <= 2 && (L.loadGait(g, light, 2.2 * kl) as number) > 2 && L.loadGait(g, foe, 2.0) === 2.0,
      'whether a step is a walk\'s or a run\'s is read off the pace he was asked for: the light man made quicker at the brisk walk (2.0) is not running; at 2.2 he is, as anybody', `his gait at ${f3(2.0 * kl)} m/s reads ${f3(L.loadGait(g, light, 2.0 * kl))} · at ${f3(2.2 * kl)}: ${f3(L.loadGait(g, light, 2.2 * kl))}`);
    const sl = L.loadSeen(g, light) as number, sh = L.loadSeen(g, heavy) as number, hl = L.loadHeard(g, light) as number, hh = L.loadHeard(g, heavy) as number;
    F.verdict(sl < 1 && sl < sh * 0.9 && hl < hh * 0.9, 'a defender\'s eye builds its notice of the light man more slowly, and his footfall is quieter', `notice ×${f3(sl)} against ×${f3(sh)} · footfall ×${f3(hl)} against ×${f3(hh)}`);
    F.verdict(!!foe && legs(foe, 2.7) === Gd.teamPace(g, foe, 2.7) && L.loadSeen(g, foe) === 1 && L.loadHeard(g, foe) === 1 && L.loadOn(g, foe) === null, 'a defender has no card: his pace, notice and footfall are as they were', `asked for 2.7 he gets ${f3(legs(foe, 2.7))} · notice ×${L.loadSeen(g, foe)}`);
    KITLOAD.on = false;
    F.verdict(legs(light, 2.2) === legs(heavy, 2.2) && L.loadSeen(g, light) === 1, 'the switch off: both men\'s legs get the same, and nobody\'s notice is touched', `${f3(legs(light, 2.2))} and ${f3(legs(heavy, 2.2))} m/s`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── off = the build before
export async function kitloadOff(): Promise<boolean> {
  const F = family('kitload-off: the switch off is the build before, and the issued card plays as it did');
  await kept(async () => {
    const offL = await walk(YOU.light, { on: false, secs: 3 }), offL2 = await walk(YOU.light, { on: false, secs: 3 }), onL = await walk(YOU.light, { on: true, secs: 3 });
    const offI = await walk(YOU.issued, { on: false, secs: 3 }), onI = await walk(YOU.issued, { on: true, secs: 3 });
    F.verdict(offL.digest === offL2.digest && !!offL.digest, 'the same seeded walk twice with the switch off digests the same', `${offL.digest} and ${offL2.digest}`);
    F.verdict(onI.digest === offI.digest, 'the ISSUED card with the switch on digests as the switch off: the reference plays as it did', `on ${onI.digest} · off ${offI.digest}`);
    F.verdict(onL.digest !== offL.digest, 'a LIGHT card with the switch on does not: the rule moves a run', `on ${onL.digest} · off ${offL.digest} (${STAND} stand)`);
    // the squad: the room clear staged with four, told to fall in, and led for ten seconds
    const four = async (on: boolean, cut: boolean) => {
      Math.random = seeded(0x51c4); for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = K.kitDefault(i);
      const E = (SCENARIOS as any[]).find(e => e.id === 'room-clear-four'), W: any = await hushed(() => standUp({ seed: 2, uploadEvery: 4 })), g = W.game; g.godMode = true; rules(); KITLOAD.on = on;
      for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = K.kitDefault(i); if (cut) K.KIT.members[1] = card(1, { weapon: 'pistol', bangs: 0, charges: 0, frags: 0, smoke: 0 });
      const { why } = await hushed(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E)))); if (why) throw new Error(`room-clear-four: start refused — ${why}`);
      const no = await hushed(() => g.orders.give('fallIn', { kind: 'none', at: [g.player.char.pos[0], 0, g.player.char.pos[2]] })); if (no) throw new Error(`fall in refused — ${no}`);
      W.input.keys.add('KeyA'); await hushed(() => { for (let f = 0; f < 600; f++) W.step(DT); }); W.input.keys.delete('KeyA');
      const red = (teamOf(g) as any[]).find(t => K.kitIndex(t) === 1); return { d: hashDigest(digestGame(g)) as string, at: red ? `${f2(red.char.pos[0])}, ${f2(red.char.pos[2])}` : 'none' }; };
    const sOff = await four(false, false), sOn = await four(true, false), sCut = await four(true, true);
    F.verdict(sOn.d === sOff.d && !!sOn.d, 'FOUR AS ISSUED, told to fall in and led ten seconds: the switch on digests as the switch off — every man is his own reference', `on ${sOn.d} · off ${sOff.d} · Red One at ${sOn.at}`);
    F.verdict(sCut.d !== sOn.d, 'Red One cut to a pistol and nothing else, the switch on: the run moves', `${sCut.d} against ${sOn.d} · Red One at ${sCut.at} against ${sOn.at}`);
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── the card's face
export async function kitloadCard(): Promise<boolean> {
  const F = family('kitload-card: the two bars on a man\'s card');
  await kept(async () => {
    const { memberCard } = await import(`${ROOT}/src/ui/kitCard.ts`);
    const bars = (root: El) => root.all(e => e.cls.has('kc-bar')).map(b => ({ k: b.attrs['data-load'], score: parseFloat(b.attrs['data-score'] ?? 'NaN'), share: parseFloat(b.attrs['data-share'] ?? 'NaN'), fill: b.all(e => e.cls.has('fill'))[0]?.style.width ?? '', gain: b.all(e => e.cls.has('gain'))[0]?.style.width ?? '', loss: !!b.all(e => e.cls.has('gain'))[0]?.cls.has('loss'), more: !!b.all(e => e.cls.has('part'))[0]?.cls.has('more'), shown: b.all(e => e.cls.has('part'))[0]?.style.display !== 'none', part: b.all(e => e.cls.has('part'))[0]?.style.width ?? '', ref: b.all(e => e.cls.has('ref'))[0]?.style.left ?? '', text: b.textContent }));
    const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
    await withDom('', async root => {
      for (let i = 0; i < K.KIT_MEMBERS; i++) K.KIT.members[i] = K.kitDefault(i);
      KITLOAD.on = true; K.KIT.members[0] = card(0, YOU.issued);
      const host = new El('DIV') as any; root.appendChild(host); const c = memberCard(host, 0), R = L.loadRef(0);
      const B = bars(host), want = L.loadOf(0, K.KIT.members[0]);
      F.verdict(B.length === 2 && B[0].k === 'mob' && B[1].k === 'con' && B[0].fill === pct(want.mob) && B[1].fill === pct(want.con) && B[0].ref === pct(R.mob) && B[1].ref === pct(R.con) && B[0].fill === B[0].ref && B[1].fill === B[1].ref && B.every(b => b.gain === '0%'),
        'your card as issued: two bars, mobility then concealment, each grey to its score — and that is the notch, nothing gained or lost on it', B.map(b => `${b.k} fill ${b.fill} notch ${b.ref} gain ${b.gain}`).join(' · '));
      F.verdict(B.every(b => !/[0-9]/.test(b.text)), 'no digit on the bars: a label and a bar each', B.map(b => `'${b.text}'`).join(' · '));
      // the highlighted row's share: the top row is the guns
      const rows = K.kitRows(0) as any[], gun = rows.findIndex(r => r.field === 'weapon'); c.go(gun);
      const G = bars(host), share = L.loadShare(0, K.KIT.members[0], 'weapon');
      F.verdict(!!share && G[0].part === pct(share.mob) && G[1].part === pct(share.con) && share.mob > 0 && G.every(b => b.shown && !b.more), 'the highlight on the guns row: the outline past each bar\'s end is what the guns take', G.map(b => `${b.k} share ${b.part}`).join(' · '));
      { const big = rows.findIndex(r => r.field === 'big'); c.go(big); const H = bars(host), one = L.loadOf(0, { ...K.KIT.members[0], big: K.kitPeek(0, 'big', 1).value }), d = { mob: want.mob - one.mob, con: want.con - one.con };
        F.verdict(big >= 0 && d.mob > 0 && H[0].more && H[0].shown && H[0].part === pct(d.mob) && H[1].part === pct(d.con), 'the highlight on the big slot, which carries nothing: dashed, what the next thing there would take', H.map(b => `${b.k} one more ${b.part}${b.more ? ' dashed' : ''}`).join(' · ')); }
      // a row stepped: the bars move with it (the guns row to the pistol alone)
      K.kitSet(0, 'weapon', 'pistol'); c.refresh(); const P = bars(host), now = L.loadOf(0, K.KIT.members[0]);
      F.verdict(P[0].fill === pct(R.mob) && P[1].fill === pct(R.con) && P[0].gain === pct(now.mob - R.mob) && P[1].gain === pct(now.con - R.con) && P.every(b => !b.loss) && now.mob > want.mob && now.con > want.con && P[0].ref === pct(R.mob), 'the guns row stepped to the pistol alone: both bars gain past the notch (green), which stays', P.map(b => `${b.k} grey ${b.fill} + gained ${b.gain}, notch ${b.ref}`).join(' · '));
      K.KIT.members[0] = card(0, YOU.heavy); c.refresh(); { const Hv = bars(host), hv = L.loadOf(0, K.KIT.members[0]);
        F.verdict(Hv[0].loss && Hv[0].fill === pct(hv.mob) && Hv[0].gain === pct(R.mob - hv.mob), 'four smoke and the hammer: mobility falls under the notch, and what is lost is amber', Hv.map(b => `${b.k} grey ${b.fill} ${b.loss ? 'lost' : 'gained'} ${b.gain}`).join(' · ')); }
      KITLOAD.on = false; c.refresh();
      F.verdict(host.all((e: El) => e.cls.has('kc-load'))[0]?.cls.has('off') === true, 'the switch off: the bars are not shown', 'the block carries `off`');
      c.destroy();
    });
  });
  return F.done();
}

// ───────────────────────────────────────────────────────────── a checkpoint
export async function kitloadSave(): Promise<boolean> {
  const F = family('kitload-save: a checkpoint keeps the two scores');
  await kept(async () => {
    const R = await night(5, YOU.light, true), g = R.g; g.aiEnabled = false; R.step(30);
    const was = { ...g.player.kitLoad }, snap = R.W.snapshot('kitload', true), P = (snap as any)?.player ?? (snap as any)?.state?.player;
    g.player.kitLoad = { mob: 0.1, con: 0.1, refMob: 0.5, refCon: 0.5 }; R.W.restore(snap); const back = g.player.kitLoad;
    F.verdict(!!back && Math.abs(back.mob - was.mob) < 1e-9 && Math.abs(back.con - was.con) < 1e-9 && Math.abs(back.refMob - was.refMob) < 1e-9 && Math.abs(back.refCon - was.refCon) < 1e-9, 'saved with the switch on, changed, loaded: what his card weighs is the file\'s, his reference with it', `was ${f2(was.mob)} / ${f2(was.con)} against ${f2(was.refMob)} / ${f2(was.refCon)} · back ${back ? `${f2(back.mob)} / ${f2(back.con)} against ${f2(back.refMob)} / ${f2(back.refCon)}` : 'none'}${P ? ` · the file: ${JSON.stringify(P.kitLoad)}` : ''}`);
    KITLOAD.on = false; const bare = R.W.snapshot('kitload-off', true); g.player.kitLoad = { mob: 0.2, con: 0.3, refMob: 0.5, refCon: 0.5 }; R.W.restore(bare);
    F.verdict(!JSON.stringify(bare).includes('"kitLoad"') && Math.abs((g.player.kitLoad?.mob ?? -1) - was.mob) < 1e-9, 'saved with the switch off: the file says nothing of them, and a load leaves what the staging puts on him — his card\'s', `on him after the load: ${JSON.stringify(g.player.kitLoad)}`);
  });
  return F.done();
}

export async function kitloadCheck(only?: string): Promise<boolean> {
  const all: [string, () => Promise<boolean>][] = [['kitload-table', kitloadTable], ['kitload-you', kitloadYou], ['kitload-mates', kitloadMates], ['kitload-off', kitloadOff], ['kitload-card', kitloadCard], ['kitload-save', kitloadSave]];
  let ok = true; for (const [n, fn] of all) if (!only || only === n) ok = (await fn()) && ok;
  if (BROKEN) console.log('(KITLOAD_BREAK=1: kitload-you, kitload-mates and kitload-off are expected to FAIL)');
  return ok;
}
if (import.meta.main) process.exit((await kitloadCheck(process.argv[2])) ? 0 : 1);
