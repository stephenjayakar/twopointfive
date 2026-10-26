// THE SAVE TIMELINE (src/game/savestate.ts SAVETIMELINE): the saves roll in two rings, each keeps a picture, a team on the floor is saved in memory, and every
// entry of the strip loads and plays on as the run it was taken from.
//   bun run tools/qa/savetimeline-check.ts          (probes.ts savetimeline; SAVETIMELINE_BREAK=1 leaves the switch off and must FAIL;
//                                                    SAVESINCE_BREAK=1 nudges one man after each put-back of a take since the base in (5b) and must FAIL)
// What it holds, on the plain night alone and on a yard with a pair on the floor (train-orders, once Training 5):
//   (1) the set ROLLS at its cap: seven autosaves and seven saves by hand leave the newest five of each — neither kind pushes out the other — and the strip
//       (`timeline`) lists the ten in the mission clock's order;
//   (2) every entry LOADS, and the ten seconds after the load digest as the ten seconds after the save did (checkpoint-identity's terms: one seed, sampled once a second);
//   (3) the slots of the build BEFORE the switch (three autosaves, the one manual, the same index) are read, listed and loaded with it on — and its slots by a
//       build with it off;
//   (4) a PICTURE handed in is kept with its save and with no other; a store that will not take it, or that throws, costs nothing but the picture; a save that
//       does not fit has the pictures thrown out for it;
//   (5) WITH A PAIR ON THE FLOOR a save is kept (no file can be: the unit refusal stands for files), rolls in its own rings, loads and plays on as the run it
//       was taken from; the files in the store are not taken back by it; a lesson's own autosave lands; F5 saves and a bare Enter once down goes back;
//   (6) what one save weighs.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { yardRow } from './yards.ts';
import { digestRun } from './checkpoint-probes.ts';
const SS = await import(`${ROOT}/src/game/savestate.ts`);
const { SAVETIMELINE, CKPT, canSave } = SS;
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
const { ambientState } = await import(`${ROOT}/src/game/dialogue.ts`);
const { MOVES, TURN } = await import(`${ROOT}/src/game/character.ts`);
const { takeSnapshot, snapshotBytes, stateHash, restoreSnapshot } = await import(`${ROOT}/src/game/rollback.ts`);
const { roomOf } = await import(`${ROOT}/src/game/chronicle.ts`);
const { hostileTo } = await import(`${ROOT}/src/game/teams.ts`);

const DT = 1 / 60, BREAK = process.env.SAVETIMELINE_BREAK === '1', VERBOSE = !!process.env.SAVETIMELINE_VERBOSE, P = 'twopointsix.save.';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function hushed<T>(f: () => T | Promise<T>): Promise<T> { const log = console.log, warn = console.warn; if (!VERBOSE) console.log = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.warn = warn; } }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const steps = (W: any, secs: number) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) W.step(DT); };
/** THE CAMERA IS THE HOST'S: no save holds it, and the aim is read through it — so 'plays on as its save did' is held with the camera as it stood at the save
 *  (kept here, put back after the load; the page cuts it onto the man instead, and the first frames of his aim ease from there) */
const camKeep = (W: any): any => { const o: any = {}; for (const k of Object.keys(W.cam)) { const v = W.cam[k]; if (typeof v !== 'function') o[k] = structuredClone(v); } return o; };
const camPut = (W: any, o: any) => { for (const k of Object.keys(o)) W.cam[k] = structuredClone(o[k]); };
const WALK = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
const short = (k: string | undefined) => (k ?? '?').replace(P, '');
const kb = (n: number) => (n / 1024).toFixed(1);

/** the animator's two switches as the first stand-up left them (the frozen stand's holds them off, the shipped one's has them on) */
let stoodAnim: { moves: number; turn: number } | null = null;
/** the plain night alone, quiet enough to save at will: nobody sees him, nobody misses anybody, no autosave of the game's own */
async function night(seed: number, on: boolean): Promise<any> {
  Math.random = seeded(seed);
  const W: any = await hushed(() => standUp()); const g = W.game;
  SAVETIMELINE.on = on;   // (after the stand-up: the frozen stand's holds it off, the shipped one's raises it)
  stoodAnim ??= { moves: MOVES.on, turn: TURN.on };
  MOVES.on = 0; TURN.on = SAVETIMELINE.turn ? stoodAnim.turn : 0;   // (a FILE's terms — savestate.ts, its head: the animator's own momentum is not in a file, so 'plays on as its save did' is the file's claim with the movement pass off, as the frozen stand has it; a turn's weight IS in one under SAVETIMELINE.turn and stays as the stand has it then — with that switch off no file holds a turn and the weight goes off with the movement pass, as it did; a save in memory holds both, and (5) runs with them as the stand has them)
  g.player.visibility = 0.02; g.godMode = true; g.playerInvisible = true; g.saves.enabled = false; for (const gd of g.guards) gd.heardUpTo = 1e12; rollcallState(g).nextAt = 1e9;
  steps(W, 0.5); return W;
}
/** a stage yard as a row would start it (the yards were Training 5 and 1: no row and no lesson of their own since 2026-10-23; their rows are tools/qa/yards.ts) */
async function lesson(id: string, seed: number, on: boolean): Promise<any> {
  const E = yardRow(id); if (!E) throw new Error(`no yard '${id}'`);
  Math.random = seeded(seed);
  const W: any = await hushed(() => standUp({ level: levelOfFile(E.level) })); const g = W.game;
  SAVETIMELINE.on = on;
  if (stoodAnim) { MOVES.on = stoodAnim.moves; TURN.on = stoodAnim.turn; }   // (the animator as the stand has it: a save in memory holds its momentum)
  const { why } = await hushed(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E) as string))); if (why) throw new Error(`${id}: start refused — ${why}`);
  g.godMode = true; g.playerInvisible = true;
  steps(W, 1); return W;
}

export async function savetimelineCheck(): Promise<boolean> {
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log(`\n=== savetimeline: the saves roll, keep a picture, hold with a team on the floor, and each one loads${BREAK ? ' (SAVETIMELINE_BREAK: the switch left off)' : ''} ===`);
  const was = { ...SAVETIMELINE }, anim = { moves: MOVES.on, turn: TURN.on }, rnd = Math.random, ON = !BREAK, SEED = 60606, SECS = 10;
  const weights: string[] = [];
  try {
    // ---- (1) (2) the plain night: the rings, the strip, every entry loads and plays on
    {
      const W = await night(8080, ON), g = W.game, S = g.saves; const fails: string[] = [];
      const ref = new Map<string, string>();   // the label of a save → the digest of the ten seconds that followed it
      const cams = new Map<string, any>();
      const made: { kind: 'auto' | 'manual'; label: string }[] = [];
      for (let i = 0; i < 14; i++) {
        const kind = i % 2 ? 'manual' : 'auto', label = `${kind} #${i >> 1}`;
        W.input.keys.clear(); steps(W, 3);   // (he stands still at a save and the camera has come to rest on him: the camera is the host's, no save holds it, and the aim is read through it)
        for (let k = 0; k < 20 * 60 && ambientState(g).run; k++) W.step(DT);   // (no conversation under way at a save: a load cuts one short, by design — checkpoint-identity's own term)
        const r = S.write(g, kind, label); if (!r.ok) { fails.push(`${label}: ${r.why}`); continue; }
        if (i === 0) weights.push(`the plain night, a file: ${kb(r.bytes)} KB`);
        made.push({ kind, label }); cams.set(label, camKeep(W)); W.input.keys.add(WALK[i % 4]); ref.set(label, digestRun(W, SECS, SEED).hash);   // (each save a different moment: he walks on from it — the same key held after its load below)
      }
      W.input.keys.clear();
      const slots = S.slots() as any[], autos = slots.filter(x => x.slot === 'auto'), hands = slots.filter(x => x.slot === 'manual');
      const want = (k: string) => made.filter(m => m.kind === k).slice(-5).map(m => m.label).sort().join(',');
      if (autos.length !== 5 || hands.length !== 5) fails.push(`${autos.length} autosaves and ${hands.length} by hand are kept (want five and five)`);
      if (autos.map(x => x.label).sort().join(',') !== want('auto')) fails.push(`the autosaves kept are ${autos.map(x => x.label).sort().join(',')} (want the newest five: ${want('auto')})`);
      if (hands.map(x => x.label).sort().join(',') !== want('manual')) fails.push(`the saves by hand kept are ${hands.map(x => x.label).sort().join(',')} (want the newest five: ${want('manual')})`);
      const tl = S.timeline() as any[]; let ordered = true; for (let i = 1; i < tl.length; i++) if (tl[i].missionT < tl[i - 1].missionT) ordered = false;
      if (tl.length !== slots.length || !ordered) fails.push(`the strip lists ${tl.length} of ${slots.length} saves${ordered ? '' : ', not in the mission clock\'s order'}`);
      line(!fails.length, '(1) seven autosaves and seven saves by hand: the newest five of each are kept, neither kind pushes out the other, the strip lists them in time order',
        `${slots.length} stored: ${tl.map(x => `${short(x.key)}='${x.label}'`).join(' · ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
      const f2: string[] = []; let same = 0;
      for (const x of tl) { const why = S.load(g, x.key); if (why) { f2.push(`${x.label}: would not load — ${why}`); continue; } camPut(W, cams.get(x.label)); W.input.keys.clear(); W.input.keys.add(WALK[Number(x.label.split('#')[1]) * 2 % 4 + (x.slot === 'manual' ? 1 : 0)]); const d = digestRun(W, SECS, SEED).hash; if (d === ref.get(x.label)) same++; else f2.push(`${x.label}: the ${SECS} s after its load digest ${d}, after its save ${ref.get(x.label)}`); }
      line(!f2.length && same === tl.length && same > 0, `(2) every entry of the strip loads, and the ${SECS} s after the load digest as the ${SECS} s after the save`, `${same} of ${tl.length} alike${f2.length ? '\n    ✗ ' + f2.join('\n    ✗ ') : ''}`);
    }
    // ---- (3) the slots of the build before the switch, and this build's slots read with it off
    {
      const W = await night(4242, false), g = W.game, S = g.saves; const fails: string[] = [];
      for (let i = 0; i < 4; i++) { const r = S.write(g, 'auto', `old auto #${i}`); if (!r.ok) fails.push(`old auto #${i}: ${r.why}`); steps(W, 1); }
      { const r = S.write(g, 'manual', 'old by hand'); if (!r.ok) fails.push(`old manual: ${r.why}`); }
      const old = (S.slots() as any[]).map(x => short(x.key)).sort().join(',');
      if (old !== 'auto.0,auto.1,auto.2,manual') fails.push(`with the switch off the store holds ${old} (want auto.0,auto.1,auto.2,manual — the build as it was)`);
      SAVETIMELINE.on = ON; steps(W, 1);
      const seen = (S.slots() as any[]), strip = (S.timeline() as any[]);
      if (seen.length !== 4 || strip.length !== 4) fails.push(`${seen.length} old slots listed, ${strip.length} on the strip (want 4 and 4)`);
      for (const x of seen) { const why = S.load(g, x.key); if (why) fails.push(`${short(x.key)} '${x.label}' would not load: ${why}`); steps(W, 0.2); }
      const r = S.write(g, 'manual', 'new by hand'); const keys = (S.slots() as any[]).map(x => short(x.key)).sort().join(',');
      if (!r.ok || !(S.slots() as any[]).some(x => x.label === 'old by hand') || (S.slots() as any[]).length !== 5) fails.push(`a save by hand beside the old one: ${r.ok ? keys : r.why} (want the old manual kept and a fifth slot)`);
      // …and back: a build with the switch off reads what this one wrote
      SAVETIMELINE.on = false; const back = S.slots() as any[]; const why = back.length ? S.load(g, S.newest()!.key) : 'nothing listed';
      if (back.length !== 5 || why) fails.push(`with the switch off again: ${back.length} listed, the newest ${why ? 'refused: ' + why : 'loads'}`);
      line(!fails.length, '(3) three autosaves and the one manual written with the switch off are listed, on the strip and load with it on; a save by hand goes beside them; the switch off again reads them all',
        `before: ${old} · after: ${keys}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    }
    // ---- (4) pictures, and a store that is full or throws
    {
      const W = await night(1717, ON), g = W.game, S = g.saves; const fails: string[] = [];
      const asked: any[] = []; S.picture = (info: any) => { asked.push(info); };
      const PIC = (n: number) => 'data:image/jpeg;base64,' + 'A'.repeat(n);
      const a = S.write(g, 'manual', 'one'); steps(W, 1); const b = S.write(g, 'auto', 'two'); steps(W, 1);
      if (asked.length !== 2) fails.push(`the host was asked for ${asked.length} pictures of 2 saves`);
      if (a.ok && b.ok) {
        if (!S.setPicture(a.info, PIC(6000)) || S.pictureOf(a.info) !== PIC(6000)) fails.push('a picture handed in is not the one read back');
        if (S.pictureOf(b.info) !== null) fails.push('a save with no picture reads one');
        // the slot taken by a later save: the picture is not that save's, and the old save's late picture is not kept
        for (let i = 0; i < 5; i++) { S.write(g, 'manual', `later #${i}`); steps(W, 0.2); }
        const now = (S.slots() as any[]).find(x => x.key === a.info.key);
        if (!now || now.label === 'one') fails.push('five more saves by hand did not take the first one\'s slot');
        else { if (S.pictureOf(now) !== null) fails.push('the save that took the slot reads the old save\'s picture'); if (S.setPicture(a.info, PIC(100))) fails.push('a late picture of a save that is gone was kept'); }
        // a store that will not take a picture, then one that throws: the game runs, the saves stand
        const set0 = S.store.set.bind(S.store);
        S.store.set = (k: string, v: string) => k.includes('.pic.') ? false : set0(k, v);
        if (S.setPicture(b.info, PIC(6000)) || S.pictureOf(b.info) !== null) fails.push('a picture the store refused reads as kept');
        S.store.set = (k: string, v: string) => { if (k.includes('.pic.')) throw new Error('QuotaExceededError'); return set0(k, v); };
        let threw = ''; try { if (S.setPicture(b.info, PIC(6000))) fails.push('a picture the store threw on reads as kept'); const r = S.write(g, 'auto', 'after a throw'); if (!r.ok) fails.push(`a save after the store threw on a picture: ${r.why}`); steps(W, 1); } catch (e) { threw = (e as Error).message; }
        if (threw) fails.push(`the store's throw reached the game: ${threw}`);
        // a store with no room: the save that does not fit has the pictures thrown out for it
        S.store.set = set0; for (const x of S.slots() as any[]) S.setPicture(x, PIC(20000));
        const used = () => { let n = 0; for (const [k, v] of S.store.map as Map<string, string>) n += k.length + v.length; return n; };
        const cap = used() + 2000, pics0 = [...(S.store.map as Map<string, string>).keys()].filter(k => k.includes('.pic.')).length;
        S.store.set = (k: string, v: string) => { const old = (S.store.map as Map<string, string>).get(k); if (used() - (old ? old.length : -k.length) + v.length > cap) return false; return set0(k, v); };
        const r = S.write(g, 'auto', 'no room'); const pics1 = [...(S.store.map as Map<string, string>).keys()].filter(k => k.includes('.pic.')).length;
        if (!r.ok) fails.push(`a save into a full store was given up with ${pics0} pictures to throw out: ${r.why}`); else if (pics1 >= pics0) fails.push(`the save fitted without a picture going (${pics0} → ${pics1})`);
        // …and with nothing left to throw out it is refused with its reason, and the game goes on
        S.store.set = () => false; const r2 = S.write(g, 'manual', 'refused'); let ran = true; try { steps(W, 1); } catch { ran = false; }
        if (r2.ok || !r2.why || !ran) fails.push(`a store that takes nothing: ok ${r2.ok}, why '${r2.why}', the game ${ran ? 'ran on' : 'threw'}`);
        S.store.set = set0;
        line(!fails.length, '(4) a picture is kept with its save and no other; a store that refuses or throws costs only the picture; a save with no room has the pictures thrown out for it; a store that takes nothing leaves the game running',
          `${pics0} pictures before the full store's save, ${pics1} after${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
      } else line(false, '(4) pictures', `the two saves: ${a.why ?? 'ok'} / ${b.why ?? 'ok'}`);
    }
    // ---- (5) a room clear with a pair on the floor (the yard that was Training 5)
    {
      const W = await lesson('train-orders', 11, ON), g = W.game, S = g.saves; const fails: string[] = [], notes: string[] = [];
      const units = g.guards.filter((x: any) => x.unit).length; if (!units) fails.push('no unit on the floor: the lesson did not stand its pair');
      if (!/unit/.test(canSave(g) ?? '')) fails.push(`a FILE is not refused for the unit here: '${canSave(g)}'`);
      const files0 = (S.store.map as Map<string, string>).size;
      // a lesson's own autosave: the step's request, by the gates
      { const n0 = S.stats.autosaves; S.enabled = true; S.request(g, 'lesson', 'training 1/5'); steps(W, CKPT.debounceSecs + 1.5); if (S.stats.autosaves !== n0 + 1) fails.push(`the lesson's request wrote ${S.stats.autosaves - n0} autosaves (gate: ${S.gate(g) ?? 'clear'})`); else notes.push('a lesson step\'s request lands as an autosave'); S.enabled = false; }
      const ref = new Map<string, string>(), cams = new Map<string, any>();
      for (let i = 0; i < 7; i++) {
        W.input.keys.clear(); steps(W, 3);
        const label = `hand #${i}`, r = S.write(g, 'manual', label); if (!r.ok) { fails.push(`${label}: ${r.why}`); continue; }
        if (!r.info?.mem) fails.push(`${label} is not kept in memory`);
        cams.set(label, camKeep(W)); W.input.keys.add(WALK[i % 4]); ref.set(label, digestRun(W, SECS, SEED).hash);
      }
      W.input.keys.clear();
      const tl = S.timeline() as any[], hands = tl.filter(x => x.slot === 'manual');
      if (hands.length !== 5 || hands.map(x => x.label).join(',') !== 'hand #2,hand #3,hand #4,hand #5,hand #6') fails.push(`by hand kept: ${hands.map(x => x.label).join(',')} (want the newest five, in order)`);
      if (!tl.some(x => x.slot === 'auto')) fails.push('the autosave was pushed out by the saves by hand');
      let same = 0; for (const x of hands) { const why = S.load(g, x.key); if (why) { fails.push(`${x.label}: would not load — ${why}`); continue; } camPut(W, cams.get(x.label)); W.input.keys.clear(); W.input.keys.add(WALK[Number(x.label.split('#')[1]) % 4]); const d = digestRun(W, SECS, SEED).hash; if (d === ref.get(x.label)) same++; else fails.push(`${x.label}: the ${SECS} s after its load digest ${d}, after its save ${ref.get(x.label)}`); }
      notes.push(`${same} of ${hands.length} loads play on as their save did`);
      if ((S.timeline() as any[]).length !== tl.length) fails.push(`a load took saves off the strip (${tl.length} → ${(S.timeline() as any[]).length})`);
      if ((S.store.map as Map<string, string>).size !== files0) fails.push(`the store went from ${files0} to ${(S.store.map as Map<string, string>).size} entries with a team on the floor`);
      // F5, and a bare Enter once down
      { const n0 = S.stats.manual, t0 = g.mission.stats.elapsed; W.input.pressed.add('F5'); W.step(DT); if (S.stats.manual !== n0 + 1) fails.push('F5 wrote no save'); steps(W, 3);
        g.godMode = false; g.player.down = true; W.input.pressed.add('Enter'); W.step(DT); g.godMode = true;
        const dt = g.mission.stats.elapsed - t0; if (g.player.down || Math.abs(dt) > 0.2) fails.push(`a bare Enter once down: down ${g.player.down}, the mission clock ${dt.toFixed(2)} s off the F5 save`); else notes.push('F5 saves; a bare Enter once down goes back to it'); steps(W, 1); }
      // what it weighs
      { const t0 = performance.now(); const snap = takeSnapshot(g); const ms = performance.now() - t0; const B = snapshotBytes(snap); weights.push(`train-orders with its pair, kept in memory: ${(B.bytes / 1048576).toFixed(1)} MB, ${B.objects} objects, ${ms.toFixed(0)} ms to take here`); }
      // the rooms an autosave is named for are this level's own, not the office's table
      { const here = roomOf(g.player.char.pos, g.level), had = (S as any).roomRef; if (had !== here) fails.push(`the controller has him in '${had}', the level says '${here}'`); else notes.push(`room '${here}'`); }
      // what a load must NOT take back: the host's hook (called once), the autosave switch, a tune row, the sandbox row
      { let put = 0; S.onPutBack = () => { put++; }; const first = (S.timeline() as any[]).find(x => x.mem);
        S.enabled = false; const row = Object.keys(g.tune).find(k => typeof g.tune[k] === 'number')!, tuned = g.tune[row] + 1; g.tune[row] = tuned; const ammo = !g.infiniteAmmo; g.infiniteAmmo = ammo;
        const why = S.load(g, first.key);
        if (why) fails.push(`the oldest save in memory would not load: ${why}`);
        else if (put !== 1 || S.enabled || g.tune[row] !== tuned || g.infiniteAmmo !== ammo) fails.push(`a load took the host's side back: hook called ${put}×, autosave ${S.enabled ? 'back on' : 'off'}, tune.${row} ${g.tune[row]} (set ${tuned}), unlimited ammo ${g.infiniteAmmo} (set ${ammo})`);
        else notes.push('a load leaves the hook, the autosave switch, the tune row and the sandbox row as they are now');
        g.tune[row] = tuned - 1; g.infiniteAmmo = !ammo; S.enabled = true; S.onPutBack = null; }
      // regret with a team up: every defender is a unit too — one of THEM alert straight after an autosave marks it, and the cards pass over it
      { steps(W, CKPT.minGapSecs + 1); const r = S.write(g, 'auto', 'soon regretted'); const foe = g.guards.find((x: any) => x.state !== 'dead' && hostileTo(x, 'player'));
        if (!r.ok || !foe) fails.push(`the regret case could not be staged: save ${r.ok ? 'ok' : r.why}, a defender ${foe ? 'found' : 'missing'}`);
        else { steps(W, 1); foe.hold = false; foe.pinned = true; foe.state = 'alert'; foe.awareness = 1; foe.lastKnown = [...g.player.char.pos]; W.step(DT);
          const info = (S.slots() as any[]).find(x => x.key === r.info.key), nw = S.newest(true);
          if (!foe.unit) notes.push('(the defender here is no unit)');
          if (!info?.regret) fails.push(`${foe.callsign} (a unit: ${!!foe.unit}) alert a second after an autosave in memory left it unmarked`); else if (nw?.key === r.info.key) fails.push('the cards still offer the regretted save with sound ones kept'); else notes.push(`regret: '${info.regret}'`); } }
      // a bare Enter once down onto a save that will not load: refused in the step, and the restart it always fell back on happens; a new run lets the old run's saves go
      { const m0 = g.mission; g.godMode = false; g.player.down = true; g.puppet = { goal: null, aim: null }; W.input.pressed.add('Enter'); W.step(DT); g.puppet = null; g.godMode = true; steps(W, 0.5);
        if (g.mission === m0 || g.player.down) fails.push(`Enter once down with the save refused: the run was ${g.mission === m0 ? 'not restarted' : 'restarted'}, down ${g.player.down}`);
        if ((S.slots() as any[]).some(x => x.mem)) fails.push('a restart kept the old run\'s saves in memory'); }
      line(!fails.length, '(5) train-orders, a pair on the floor: a save is kept where no file can be, the newest five by hand beside the autosave, each loads and plays on as its save did, the store untouched; F5 saves, Enter once down goes back; a restart lets them go',
        `${units} units · ${notes.join(' · ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    }
    // ---- (5b) the same pair, each save in memory taken SINCE the one before it (SAVETIMELINE.since; SAVESINCE_BREAK=1: one man is nudged after each put-back and 'to the bit' must FAIL)
    {
      const SECS_B = 4, BREAK_B = process.env.SAVESINCE_BREAK === '1';
      const play = async (since: boolean) => {
        const W = await lesson('train-orders', 11, ON), g = W.game, S = g.saves, shelf = (S as any).shelf; S.enabled = false; SAVETIMELINE.since = since;
        const out = { refs: [] as string[], kinds: [] as boolean[], loads: [] as string[], pairs: 0, bits: 0, thrown: '', fails: [] as string[] }, cams = new Map<string, any>(), ref = new Map<string, string>();
        const walk = (label: string) => WALK[Number(label.split('#')[1]) % 4], pairs: [string, any, any][] = [];
        const save = (label: string): any => {
          W.input.keys.clear(); steps(W, 3); const base = shelf.last;
          // (the moment before the save, taken the way the save is about to be — since the shelf's own base — and whole: put back side by side below. The save's
          //  own snapshot cannot stand beside a whole take: the controller writes its books on both sides of it inside the one call)
          if (since && base) pairs.push([label, takeSnapshot(g, base), takeSnapshot(g)]);
          const r = S.write(g, 'manual', label); if (!r.ok) { out.fails.push(`${label}: ${r.why}`); return null; }
          if (!r.info?.mem) out.fails.push(`${label} is not kept in memory`);
          out.kinds.push(!!base && shelf.get(r.info.key)?.snap.chain === base.chain);   // (taken since the base: it stands on the base's own chain — a whole walk begins a new one)
          cams.set(label, camKeep(W)); W.input.keys.add(walk(label)); const d = digestRun(W, SECS_B, SEED).hash; ref.set(label, d); out.refs.push(d); return r.info;
        };
        const load = (x: any) => {
          const why = S.load(g, x.key); if (why) { out.fails.push(`${x.label}: would not load — ${why}`); return; }
          camPut(W, cams.get(x.label)); W.input.keys.clear(); W.input.keys.add(walk(x.label)); const d = digestRun(W, SECS_B, SEED).hash; out.loads.push(d);
          if (d !== ref.get(x.label)) out.fails.push(`${x.label}: the ${SECS_B} s after its load digest ${d}, after its save ${ref.get(x.label)}`);
        };
        for (let i = 0; i < 7; i++) save(`since #${i}`);   // (seven into a ring of five: the two oldest are gone, and with them the snapshots the third was taken since)
        const hands = (S.timeline() as any[]).filter(x => x.slot === 'manual');
        if (hands.length !== 5) out.fails.push(`by hand kept: ${hands.map(x => x.label).join(',')}`);
        for (const x of hands) load(x);   // (each a put-back; oldest first, so the newest is put back over a game that has been four others since it was taken)
        // a save made after a put-back is taken since the snapshot put back: it loads, and so do one older and one newer than the one it was taken since
        if (hands.length === 5) { load(hands[1]); const late = save('since #7'); load(hands[4]); if (late) load(late); load(hands[2]); }
        // TO THE BIT: each of those put back, then the whole take of the same moment — the state word of what the game reaches is the same word (last, so
        // that nothing above runs on from a put-back that went round the controller). The red path nudges one man after the first put-back: every pair must part.
        const word = (snap: any, nudge: boolean) => { restoreSnapshot(snap); if (nudge) { const c = g.guards[0].char.pos; c[0] += Math.max(1e-3, Math.abs(c[0]) * 1e-5); } return stateHash(g); };
        out.pairs = pairs.length;
        for (const [label, mine, whole] of pairs) { const a = word(mine, BREAK_B), b = word(whole, false); if (a === b) out.bits++; else out.fails.push(`before ${label}: taken since the base on the shelf and put back, the state word is ${a}; a whole take of the same moment gives ${b}`); }
        // A TAKE THAT THROWS HALF WAY (rollback.ts Chain.busy): the next take since a snapshot of that chain is a whole one on a new chain and is the game as it
        // stands; a snapshot of the marked chain still goes back
        if (since && pairs.length) { const base = shelf.last, G = g as any;
          Object.defineProperty(G, 'zzThrows', { enumerable: true, configurable: true, get() { throw new Error('thrown in the walk'); } });
          let threw = false; try { takeSnapshot(g, base); } catch { threw = true; } delete G.zzThrows;
          const after = takeSnapshot(g, base), whole = takeSnapshot(g), a = word(after, false), b = word(whole, false); let back = true; try { restoreSnapshot(base); } catch { back = false; }
          out.thrown = !threw ? 'the take did not throw' : after.chain === base.chain ? 'the take after a thrown one went on in the same chain' : a !== b ? 'the take after a thrown one is not the game as it stood' : !back ? 'a snapshot of the marked chain would not go back' : '';
          if (out.thrown) out.fails.push(out.thrown); }
        W.input.keys.clear(); return out;
      };
      const on = await play(true), off = await play(false), fails = [...on.fails.map(f => `since: ${f}`), ...off.fails.map(f => `whole: ${f}`)];
      const sinceN = on.kinds.filter(Boolean).length;
      if (on.kinds[0]) fails.push('the first save of the run reads as taken since another');
      if (sinceN < on.kinds.length - 2) fails.push(`${sinceN} of ${on.kinds.length} saves were taken since the one before (want all but the first; one whole walk forced by a stale chain is let by)`);
      if (off.kinds.some(Boolean)) fails.push('with the switch off a save reads as taken since another');
      if (on.refs.join() !== off.refs.join()) fails.push('the run is not the same run with the saves taken since one another (the seconds after each save, by digest)');
      if (on.loads.join() !== off.loads.join()) fails.push('a load plays on differently from a save taken since another than from a whole one');
      if (!on.pairs || on.bits !== on.pairs) fails.push(`${on.bits} of ${on.pairs} takes since the base on the shelf, put back, are to the bit a whole take of the same moment`);
      line(!fails.length, '(5b) train-orders, a pair on the floor: a save in memory taken since the one before it is the same save — each of the five kept loads and plays on as its save did with the snapshots it was taken since gone from the ring, a save made after a put-back loads and so do an older and a newer one, the run and the seconds after every load are those of whole takes, and the moment before each save, taken since the base on the shelf and put back, is to the bit a whole take of it; after a take that throws half way the next is a whole one and right; switch off = every save a whole take',
        `${sinceN} of ${on.kinds.length} taken since another · ${on.loads.length} loads · ${on.bits} of ${on.pairs} put back beside a whole take, the same state word${BREAK_B ? ' (SAVESINCE_BREAK: one man nudged after each put-back)' : ''}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    }
    // ---- (6) weights: a lesson alone, in play
    {
      const W = await lesson('train-move', 5, ON), g = W.game; g.saves.enabled = false; steps(W, 20);
      const r = g.saves.write(g, 'manual', 'weigh'); if (r.ok) weights.push(`train-move alone, a file: ${kb(r.bytes)} KB`); else weights.push(`train-move alone: ${r.why}`);
      console.log(`  one save weighs — ${weights.join(' · ')} · a picture ${SAVETIMELINE.picPx} px wide is the page's (a few KB of JPEG; the page check weighs it)`);
    }
  } catch (e) { line(false, 'the check ran', String((e as Error).stack ?? e)); }
  finally { Object.assign(SAVETIMELINE, was); MOVES.on = anim.moves; TURN.on = anim.turn; Math.random = rnd; }
  return all;
}

if (import.meta.main) process.exit(await savetimelineCheck() ? 0 : 1);
