// SQUADS FROM THE ROOMS — the check behind src/game/squaddeal.ts (SQUADDEAL.on: on in the page, ?nosquaddeal; off on the frozen stand, TPS_SQUADDEAL=1).
//   bun run tools/qa/squaddeal-check.ts        (also `probes.ts squaddeal`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
// The switch is thrown by the check, and the radio check with it (enemysquads.ts SQUADS.radioCheck: the quiet answer is its men — a frozen stand without it
// has nobody miss a silent post, which is another check's business). The floors are staged as tools/qa/answers.ts stages them (the mission's own row, no
// teammates, Sam out of everybody's sight), and (c) (d) (e) are that tool's own reading of ONE level of LEVELS:
//   (a) THE CUT, on every level of LEVELS as its mission deals it: squads are staged; every room of the structure is in exactly one of them; every squad has
//       a man; as many squads as the men call for (`one` or fewer: one · `two` or fewer: two · more: three); their names are the table's; the room clear's
//       own squads check (roomclear.ts checkSquads) has nothing to say against the block;
//   (b) THE FILE WINS: a level that names its squads is handed back as it is (the same object), and its squads are the file's;
//   (c) A LOUD WAY IN AT THE FRONT draws men to the noise, their word on the net `LEAD_S` or more before the first of them is there;
//   (d) A QUIET ONE AT THE BACK draws men to the silent post, their word on the net `LEAD_S` or more before the first of them is there — and they are not
//       the move (c) drew;
//   (e) A BLOWN WALL CHANGES THE WAY THEY COME: the same loud way in with a hole blown, the frame before, in the first wall between the first man who came
//       and the noise — his way is shorter by the walk grid, and he goes through the hole;
//   (f) THE SWITCH OFF = THE BASE: the loud way in of (c) on a stand with the switch off — no squads are staged, no squad says a word, and the run digests
//       as one on a stand the rule was never thrown on (a run the rule changes when it is on: the break path's digest differs);
//   (g) THE MISSION SHEET SAYS SO: Hard on a level the rule cuts into squads is worded as the squads' (difficulty.ts squadsHeld), and as the one pool's with
//       the rule off; the row's own fact (squadsOf: what its level FILE says) is untouched either way.
// SQUADDEAL_BREAK=1 = the rule left OFF for (a) (c) (d) (g) and ON for (f): each must fail.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a line on the net is a string, a boot is an event. Nobody has seen or heard any of this in play.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
/** the listed missions whose level file names no squads (the office's own structure too: room-clear-pair has no file) */
const ROWS = ['depot-four', 'records-pair', 'killhouse-four', 'hall-four', 'floodlit-four', 'defuse-four', 'snatch-four', 'room-clear-pair'];
const FILE_WINS = 'warehouse-four', LEAD_S = 1.5;


export async function squaddealCheck(): Promise<boolean> {
  const { SQUADDEAL, squadDeal } = await import(`${ROOT}/src/game/squaddeal.ts`);
  const { SQUADS, squadsReport, squadsLive } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const { checkSquads } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { wallAt, WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`), { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { squadsOf, squadsHeld, difficultyWords } = await import(`${ROOT}/src/game/difficulty.ts`);
  const { answer, answerRow, answerSetup, answerStand, seeded, quiet } = await import('./answers.ts');
  const DT = 1 / 60, rnd0 = Math.random, was = { ...SQUADDEAL, names: [...SQUADDEAL.names] }, rc0 = SQUADS.radioCheck, walls0 = { d: DESTRUCTION.on, w: WALLCHARGE.on, o: WALLCHARGE.outer }; let all = true;
  const BREAK = process.env.SQUADDEAL_BREAK === '1';
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== squaddeal: a level whose file names no squads is handed some cut from its rooms ===');
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  /** the switches as this check runs them (a stand-up writes the held ones again: thrown after every one, and by `rule` inside a run of the answers tool) */
  const throwOn = (on: boolean) => { Object.assign(SQUADDEAL, was, { on, names: [...was.names] }); SQUADS.radioCheck = true; };
  const row = (id: string) => (SCENARIOS as any[]).find(e => e.id === id);
  const stand = async (id: string, on: boolean, seed = 7): Promise<any> => {
    Math.random = seeded(seed);
    const { W, why } = await answerStand(row(id), () => throwOn(on)); if (why) throw new Error(`${id} did not start: ${why}`);
    await quiet(async () => { for (let i = 0; i < 90; i++) W.step(DT); });
    return W;
  };
  try {
    // (a) the cut, level by level
    const on = !BREAK, bad: string[] = [], said: string[] = [];
    for (const id of ROWS) {
      const W = await stand(id, on), g = W.game, S = g.roomClear.structure, R: any[] = squadsReport(g);
      if (!S) { bad.push(`${id}: no structure`); continue; }
      if (!squadsLive(g) || !R.length) { bad.push(`${id}: no squads staged`); continue; }
      const dealt = squadDeal(S, (g.roomClear.placement as any[]).map(p => p.room)), Q: any[] = dealt?.squads ?? [];
      const men = R.reduce((a, q) => a + q.men, 0), want = Math.min(men <= was.one ? 1 : men <= was.two ? 2 : 3, new Set((g.roomClear.placement as any[]).map(p => p.room)).size);
      const owner = new Map<string, number>(); for (const q of Q) for (const r of q.rooms ?? []) owner.set(r, (owner.get(r) ?? 0) + 1);
      if (R.length !== want) bad.push(`${id}: ${R.length} squads for ${men} men (the rule: ${want})`);
      if (R.some(q => q.men < 1)) bad.push(`${id}: a squad with no man (${R.map(q => `${q.name} ${q.men}`).join(', ')})`);
      if (S.rooms.some((r: any) => owner.get(r.id) !== 1)) bad.push(`${id}: a room in no squad or in two (${S.rooms.filter((r: any) => owner.get(r.id) !== 1).map((r: any) => r.id).join(', ')})`);
      if (R.some((q, i) => q.name !== was.names[i])) bad.push(`${id}: names ${R.map(q => q.name).join(', ')}`);
      const sound = checkSquads(g, dealt); if (sound.length) bad.push(`${id}: the room clear's own check says ${sound.join(' · ')}`);
      said.push(`${id} ${R.map(q => `${q.name} ${q.men}`).join(' + ')}`);
    }
    line(!bad.length, '(a) every listed level with no squads block is cut into squads: each room in one, a man in each, the count the men call for, the room clear\'s own check silent', bad.length ? bad.join('\n    ') : said.join(' · '));

    // (b) the file wins
    { const W = await stand(FILE_WINS, true), g = W.game, S = g.roomClear.structure, R: any[] = squadsReport(g);
      const same = squadDeal(S, (g.roomClear.placement as any[]).map(p => p.room)) === S, names = R.map(q => q.name), file = (S.squads as any[]).filter(q => !q.arrive).map(q => q.name ?? q.id);
      line(same && names.join() === file.join(), '(b) a level that names its squads keeps them: the structure is handed back as it is', `${FILE_WINS}: ${names.join(', ')} (the file: ${file.join(', ')})${same ? '' : ' — a copy was made'}`); }

    // (c) (d) the loud way in and the quiet one, as the answers tool reads them, on the first level that draws both
    answerSetup({ seed: 7 });
    const rule = (v: boolean) => (g: any) => { void g; throwOn(v); };
    let loud: any = null, hush: any = null, where = '';
    for (const id of [...new Set(['killhouse-four', 'hall-four', ...ROWS])]) {   // (the first two draw NOBODY to a loud way in at standard without the rule: the break path's (c) is read there)
      throwOn(on); const E = answerRow(id); if (!E) continue;
      // (the stand-up inside writes the held switches again: the hook throws ours the frame before the plan — too late for the staging, so the staging is
      // done under a stand whose env says so; see `pin`)
      const L = await pin(on, () => answer(E, 'loud', rule(on))), H = await pin(on, () => answer(E, 'quiet', rule(on)));
      if (!loud || (L.kind === 'counter' && H.kind === 'look')) { loud = L; hush = H; where = id; }
      if (L.kind === 'counter' && H.kind === 'look') break;
    }
    line(loud?.kind === 'counter' && loud.lead >= LEAD_S, `(c) a loud way in at the front draws men to the noise, their word ${LEAD_S} s or more before the first is there`,
      `${where}: ${loud?.kind} · ${loud?.men.join(', ') || 'nobody'} · word ${f1(loud?.word)} s · there ${f1(loud?.lands)} s (lead ${f1(loud?.lead)}) · "${loud?.line ?? ''}"`);
    line(hush?.kind === 'look' && hush.lead >= LEAD_S, `(d) a quiet one at the back draws men to the silent post, their word ${LEAD_S} s or more before the first is there`,
      `${where}: ${hush?.kind} · ${hush?.men.join(', ') || 'nobody'} · word ${f1(hush?.word)} s · there ${f1(hush?.lands)} s (lead ${f1(hush?.lead)}) · "${hush?.line ?? ''}"`);

    // (e) a blown wall changes the way they come
    { let done = false; const tried: string[] = [], shutWalls = () => { DESTRUCTION.on = walls0.d; WALLCHARGE.on = walls0.w; WALLCHARGE.outer = walls0.o; };
      for (const id of ROWS) {
        const E = answerRow(id); if (!E) continue;
        const openWalls = (g?: any) => { DESTRUCTION.on = true; WALLCHARGE.on = true; WALLCHARGE.outer = true; if (g) g.tune.chaos = Math.max(g.tune.chaos, 0.5); };   // (walls that open, as in the page: a frozen stand holds them shut and its chaos knob at nothing — raised before the stand-up, which builds the floor's walls, and again after it)
        openWalls(); const A0: any = await pin(true, () => answer(E, 'loud', g => { rule(true)(g); openWalls(g); }, openWalls)); if (A0.kind !== 'counter' || !A0.noise) { shutWalls(); tried.push(`${id}: ${A0.kind}`); continue; }
        const reach = (T: any) => T.pts.some((p: number[]) => flat(p, A0.noise) <= Math.min(6, flat(T.pts[0], A0.noise) / 2));
        const first = A0.tracks.find(reach); if (!first) { shutWalls(); tried.push(`${id}: nobody's track reaches the noise`); continue; }
        const post: number[] = first.pts[0]; let hole: number[] | null = null, way0 = NaN, way1 = NaN, walls = 0, took = 0;
        const way = (g: any) => { const p = g.col.nav.findPath(post, A0.noise, 20000); if (!p?.length) return Infinity; let L = 0, q = post; for (const w of p) { L += flat(q, w); q = w; } return L; };
        openWalls(); const A1: any = await pin(true, () => answer(E, 'loud', async (g: any, W: any) => {
          throwOn(true); openWalls(g); way0 = way(g);
          // the first wall on the straight line from the noise back to his post that takes a charge (from the noise's side: the team's)
          const d = flat(post, A0.noise), n = Math.ceil(d / 0.25);
          for (let i = 2; i < n - 2 && !hole; i++) { const a = [A0.noise[0] + (post[0] - A0.noise[0]) * (i - 1) / n, 0, A0.noise[2] + (post[2] - A0.noise[2]) * (i - 1) / n], b = [A0.noise[0] + (post[0] - A0.noise[0]) * i / n, 0, A0.noise[2] + (post[2] - A0.noise[2]) * i / n];
            if (!g.col.solidBlocked([a[0], 0.35, a[2]], [b[0], 0.35, b[2]])) continue;
            walls++; const w = wallAt(g, b, a); if (!w?.ok) continue; took++;
            g.wallCharge.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); g.wallCharge.blow(g.wallCharge.set[g.wallCharge.set.length - 1]); for (let k = 0; k < 30; k++) W.step(DT);
            if (g.wallCharge.holeAt(w)) hole = b; }
          way1 = way(g);
        }, openWalls));
        shutWalls();
        if (!hole || !(way1 < way0 - 1)) { tried.push(`${id}: ${first.who} from ${flat(post, A0.noise).toFixed(1)} m, ${walls} solid step(s) on his line, ${took} take a charge, ${hole ? `hole, way ${f1(way0)} → ${f1(way1)} m` : 'no hole'}`); continue; }
        const T1 = A1.tracks.find((T: any) => T.who === first.who), near = T1 ? Math.min(...T1.pts.map((p: number[]) => flat(p, hole!))) : Infinity;
        done = true; const detail = `${id}: ${first.who}'s way to the noise ${f1(way0)} m, ${f1(way1)} m with the hole; with it blown he passes ${f1(near)} m from it (${A1.kind}, ${A1.men.join(', ') || 'nobody'})`;
        line(way1 < way0 - 1 && near <= 1.5, '(e) a blown wall changes the way they come: the first man\'s way is shorter and he goes through the hole', detail);
        break;
      }
      if (!done) line(false, '(e) a blown wall changes the way they come', `no level of the list has a wall between the first man who came and the noise whose hole shortens his way\n    ${tried.join('\n    ')}`); }

    // (f) the switch off = the base, on the loud way in of (c): a run the rule changes
    { const id = where || ROWS[0], E = answerRow(id), squadLine = new RegExp(`\\(radio\\): (${was.names.join('|')}): `);
      const base: any = await pin(false, () => answer(E, 'loud', rule(false))), again: any = await pin(BREAK, () => answer(E, 'loud', rule(BREAK)));
      const squadSaid = (again.lines as string[]).filter(s => squadLine.test(s));
      line(!again.squads && !squadSaid.length && again.digest === base.digest && !!base.digest, '(f) the switch off = the base: no squads staged, no squad says a word, the loud way in digests the same',
        `${id}: ${again.squads ? `${again.squads} squads STAGED` : 'no squads staged'} · ${squadSaid.length} squad line(s) · ${again.kind} · digest ${again.digest} against ${base.digest}`); }

    // (g) the mission sheet words Hard by what holds the level
    { throwOn(on); const E = row(ROWS[0]), F = row(FILE_WINS), words = difficultyWords('hard', squadsHeld(E)) as string;
      throwOn(false); const pool = difficultyWords('hard', squadsHeld(E)) as string;
      throwOn(true); const fact = squadsOf(E) === false && !!squadsOf(F);
      line(/squads are a drilled garrison/.test(words) && /come at you together/.test(pool) && fact, '(g) the mission sheet words Hard on a level cut into squads as the squads\', and as the one pool\'s with the rule off; the row\'s own fact is the level file\'s',
        `${ROWS[0]}: "${words.slice(0, 64)}…" · rule off: "${pool.slice(0, 64)}…" · squadsOf ${squadsOf(E)} (${FILE_WINS}: ${squadsOf(F)})`); }
  } finally { Object.assign(SQUADDEAL, was); SQUADS.radioCheck = rc0; DESTRUCTION.on = walls0.d; WALLCHARGE.on = walls0.w; WALLCHARGE.outer = walls0.o; Math.random = rnd0; delete process.env.TPS_SQUADDEAL; if (env0 !== undefined) process.env.TPS_SQUADDEAL = env0; }
  console.log(`=== squaddeal: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
const f1 = (x: number | undefined) => typeof x === 'number' && Number.isFinite(x) ? x.toFixed(1) : '—';
/** a run of the answers tool with the stand's own word for the switch set, so its stand-up stages the floor with the rule as asked (standup.ts reads
 *  TPS_SQUADDEAL when a held switch is written) */
const env0 = process.env.TPS_SQUADDEAL;
async function pin<T>(on: boolean, fn: () => Promise<T>): Promise<T> { process.env.TPS_SQUADDEAL = on ? '1' : '0'; try { return await fn(); } finally { if (env0 === undefined) delete process.env.TPS_SQUADDEAL; else process.env.TPS_SQUADDEAL = env0; } }

if (import.meta.main) process.exit((await squaddealCheck()) ? 0 : 1);
