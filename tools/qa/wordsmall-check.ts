// THE WORD SENDS A SMALL SQUAD IN FROM ITS STACK (src/game/doortools.ts DOORTOOLS.wordSmall: on in the page, ?wordsmall=0; off in the module and on the
// frozen stand, TPS_WORDSMALL=1). One or two teammates stacked on a door by a plain 'stack up' wait on the word's key as the squad of four does.
//   bun run tools/qa/wordsmall-check.ts            (also `probes.ts wordsmall`, in families doortools and squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/wordsmall-check.ts      — the same lines on the page's stand
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) two teammates, the room clear: the quick key on a door stacks them; the panel then offers the word on its key, the door carries the key's mark
//       and it would go now; the key pressed files 'go' for both, an open-and-clear of that door is made from the stack, and a man is through it;
//   (3) one teammate: the same;
//   (4) the rule off, two teammates: no line, no mark, the key files no order and makes no door order of the stack — as it was;
//   (5) a charge set on the door they are stacked on: the stack does not wait on the word — the key is the trigger's, the charge goes, no 'go' is filed;
//       (true with the rule off too: the line is there so that the rule never makes a word of that stack)
//   (6) a charge set on another door: it goes with the word;
//   (6b) the key again a second after the word: the men stay on the entry it made (nothing that reads the key after the door tools takes them off it);
//   (6c) the orders going to one man of the two: the word is his alone, and the other keeps his stack;
//   (7) the squad of four is not touched: the same hand with the rule on and off, the same order book and the same game by digest;
//   (8) a recording from before the key replays with it off; the page's boot: no flag = on, ?wordsmall=0 = off.
// WORDSMALL_BREAK=1 = the switch left off where the lines want it on: they are asked all the same and must fail on what they find.   exit 0 = all hold · 1 = one does not
// Headless: the lines are the game's own state. Never seen on a GPU; nobody has played it.
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { OWNBLOW } = await import(`${ROOT}/src/game/ownblow.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { PLAN, floorPlan } = await import(`${ROOT}/src/game/floorplan.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);

const DT = 1 / 60, F = 'KeyF';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** the room clear with `squad` teammates, the rule as asked, the team stacked on the nearest door it can stack on by the quick key */
async function rig(squad: number, rule: boolean) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  // (one line gives the word to one man of the two, outside plan mode: the rule that only plan mode picks a part of the squad is held off in this rig and has its own lines, wholesquad-check)
  try { Object.assign(NIGHTBREACH, { squad }); Math.random = seeded(5); W = await standUp(); (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.wholeSquad = false; AUTOPILOT.on = true; PLAN.on = true; DOORTOOLS.wordSmall = rule; W.game.godMode = true; why = W.game.roomClear.start(5); }
  finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const g = W.game, O = g.orders, D = g.doorTools, I = W.input;
  const R = { W, g, O, D, why: why ? String(why) : null as string | null, door: null as any, n0: 0,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    aim(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); R.step(2); return O.hover?.() ?? null; },
    aimOf(d: any): number[] | null { const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
      for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; const h = R.aim(p); if (h?.kind === 'door' && h.door === d) return p; } return null; },
    press(k: string) { I.keys.add(k); I.pressed.add(k); R.step(); I.keys.delete(k); },
    /** the panel's lines that carry a key, and the notes among them */
    lines(): string[] { return O.hud().status.flatMap((s: any) => s.opts.map((o: any) => `${o.key ? `[${o.key}] ` : ''}${o.text}`)); },
    wordLine(): string | null { return R.lines().find((l: string) => l.startsWith('[F] go · ')) ?? null; },
    mark(): any { return floorPlan(g).doors.find((x: any) => x.door === R.door && x.why === 'stack') ?? null; },
    filed(): string[] { return O.log.slice(R.n0).map((r: any) => `${r.order} ${r.who.join('+')}`); },
    op(): any { return D.ops.find((o: any) => o.door === R.door) ?? null; },
    stacked() { return R.team.every((m: any) => m.state === 'dead' || (O.of(m)?.order === 'stack' && O.of(m)?.arrived)); },
  };
  R.step(30); for (const m of R.team) m.god = true;
  if (R.why) return R;
  const stackDef = O.defs.find((d: any) => d.id === 'stack'), all = () => O.men('all');
  for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, g.player.char.pos) - dist(b.frameCentre, g.player.char.pos))) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door' || t.door !== d) continue; const far = g.cleared.roomBy(t.door, t.side > 0 ? -1 : 1); if (!far || g.cleared.isKnown(far)) continue; if (!O.whyNot(stackDef, O.forMen(t, all()), all()) && R.aimOf(d)) { R.door = d; break; } }
  if (!R.door) { R.why = 'no door to stack on'; return R; }
  R.press(ORDERS.quickKey);
  if (!R.until(() => R.stacked(), 40)) { R.why = `not stacked after 40 s: ${R.team.map((m: any) => `${m.callsign} ${O.of(m)?.order}/${O.of(m)?.there}`).join(', ')}`; return R; }
  R.step(30); const p = g.player.char.pos; R.aim([p[0] + 0.4, 0.04, p[2] + 0.4]); R.n0 = O.log.length;
  return R;
}

export async function wordsmallCheck(): Promise<boolean> {
  const BREAK = process.env.WORDSMALL_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== wordsmall: the word sends one or two teammates in from a plain stack${BREAK ? ' — WORDSMALL_BREAK: the rule never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const knobs0 = knobsCopy(), rnd0 = Math.random, keep = { ap: AUTOPILOT.on, plan: PLAN.on };
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { await quiet(() => standUp({})); const shipped = process.env.TPS_PROFILE === 'shipped', stood = DOORTOOLS.wordSmall, env = process.env.TPS_WORDSMALL, want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS['DOORTOOLS.wordSmall'];
      line(stood === want && typeof row === 'string' && row.includes('TPS_WORDSMALL=1'), `the stand, DOORTOOLS.wordSmall: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · TPS_WORDSMALL ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); }

    // (2) (3) the word, for two teammates and for one
    for (const n of [2, 1]) {
      const R = await quiet(() => rig(n, RULE));
      if (R.why) { line(false, `${n === 2 ? 'two teammates' : 'one teammate'}: the word from a plain stack`, `not staged: ${R.why}`); continue; }
      const names = R.team.map((m: any) => m.callsign), word = R.wordLine(), mark = R.mark(), side0 = R.team.map((m: any) => sideOf(R.door, m.char.pos));
      await quiet(() => R.press(F)); const filed = R.filed(), op = R.op(), opMen = op ? op.men.map((m: any) => m.callsign) : [];
      const through = await quiet(() => R.until(() => R.team.some((m: any, i: number) => sideOf(R.door, m.char.pos) !== side0[i]), 25));
      const went = filed.length === 1 && filed[0] === `go ${names.join('+')}`, made = !!op && op.kind === 'openClear' && names.every((c: string) => opMen.includes(c)) && op.beats.some((b: any) => String(b.what).startsWith('from the stack'));
      line(!!word && !!mark && mark.key === 'F' && mark.now === true && went && made && through,
        `${n === 2 ? 'two teammates' : 'one teammate'}, stacked on a door by the quick key: the panel offers the word on its key and the door carries its mark; the key files 'go' for ${n === 2 ? 'both' : 'him'}, an open-and-clear is made from the stack, and a man goes through the door`,
        `${R.door.def.name} · the panel: ${word ?? 'NO LINE'} · the door's mark: ${mark ? `${mark.key ?? 'no key'}${mark.now ? ', now' : ', not now'}` : 'NONE'} · filed: ${filed.join(', ') || 'NOTHING'} · the door's order: ${op ? `${op.kind} (${opMen.join(', ')}) ${op.beats.map((b: any) => b.what).slice(0, 3).join(' → ')}` : 'NONE'} · ${through ? 'a man is through' : 'NOBODY THROUGH in 25 s'}`);
    }

    // (4) the rule off: as it was
    { const R = await quiet(() => rig(2, false));
      if (R.why) line(false, 'the rule off, two teammates', `not staged: ${R.why}`);
      else { const word = R.wordLine(), mark = R.mark(), dig0 = R.D.ops.length; await quiet(() => { R.press(F); R.step(60); });
        line(!word && !mark && R.filed().length === 0 && R.D.ops.length === dig0, 'the rule off, two teammates stacked: no line for the word, no mark at the door, the key files no order and no door order is made of the stack — as it was (the press is left to whoever read it before: here the room clear\'s own drill)',
          `the panel: ${word ?? 'no line'} · the door's mark: ${mark ? 'ONE' : 'none'} · filed: ${R.filed().join(', ') || 'nothing'} · door orders under way: ${R.D.ops.length} · the men after it: ${R.team.map((m: any) => `${m.callsign} ${R.O.of(m)?.order ?? 'no order'}`).join(', ')} · the drill ${R.g.nightBreach.state}`); } }

    // (5) (6) a set charge: on the stacked door the key is its trigger; on another door it goes with the word (his own, where ownblow.ts is on, stands: the word is the squad's)
    for (const same of [true, false]) {
      const R = await quiet(() => rig(2, RULE));
      if (R.why) { line(false, same ? 'a charge on the stacked door' : 'a charge on another door', `not staged: ${R.why}`); continue; }
      const sam = R.g.player.char.pos, other = [...R.g.doors.list].filter((d: any) => d !== R.door).sort((a: any, b: any) => dist(b.frameCentre, sam) - dist(a.frameCentre, sam))[0], cd = same ? R.door : other;
      R.D.set.push({ door: cd, side: sideOf(cd, sam), t: R.g.time, by: 'Sam' });
      const word = R.wordLine(), waits = R.D.stackWaits(R.O.recipients()).length, b0 = R.D.stats.blown; await quiet(() => { R.press(F); R.step(20); });
      const filed = R.filed(), gone = R.D.set.length === 0, blew = R.D.stats.blown - b0;   // (blown, not merely gone: a charge is also taken off a door that came open)
      if (same) line(!word && waits === 0 && gone && blew === 1 && filed.length === 0, 'a charge set on the door they are stacked on: the stack does not wait on the word — the key is the trigger, the charge goes, and no \'go\' is filed',
        `${cd.def.name} · the panel: ${word ?? 'no line for the word'} · stacks waiting on the word: ${waits} · the charge: ${gone ? 'gone' : 'STILL SET'}, blown ${blew} · filed: ${filed.join(', ') || 'nothing'}`);
      else line(!!word && waits === 1 && gone === !OWNBLOW.on && blew === (OWNBLOW.on ? 0 : 1) && filed.length === 1 && filed[0].startsWith('go '), OWNBLOW.on ? 'a charge of his own set on another door: the word sends the stack in and his charge stands (ownblow.ts: where that is on, it is his own action\'s, not the key\'s)' : 'a charge set on another door: the word sends the stack in and the charge goes with it',
        `stacked on ${R.door.def.name}, the charge on ${cd.def.name} · the panel: ${word ?? 'NO LINE'} · stacks waiting on the word: ${waits} · the charge: ${gone ? 'gone' : 'STILL SET'} · filed: ${filed.join(', ') || 'NOTHING'}`);
    }

    // (6b) the word AGAIN a second later: the men it sent in are not pulled back out (the room clear's drill reads the key after the door tools)
    { const R = await quiet(() => rig(2, RULE));
      if (R.why) line(false, 'a second press a second after the word', `not staged: ${R.why}`);
      else { await quiet(() => { R.press(F); R.step(60); }); const op = R.op(), drill0 = R.g.nightBreach.state; await quiet(() => { R.press(F); R.step(30); });
        const op2 = R.op(), on = !!op2 && op2 === op && R.team.every((m: any) => op2.men.includes(m));
        line(!!op && on && R.g.nightBreach.state === drill0 && R.filed().length === 1, 'the key again a second after the word: the two men stay on the entry the word made — nothing else takes them off it, and nothing more is filed',
          `after the word: ${op ? `${op.kind} · ${op.phase}` : 'NO DOOR ORDER'} · after the second press: ${op2 ? `${op2.kind} · ${op2.phase} (${op2.men.map((m: any) => m.callsign).join(', ')})` : 'THE DOOR ORDER IS GONE'} · the drill ${drill0} → ${R.g.nightBreach.state} · filed: ${R.filed().join(', ') || 'NOTHING'}`); } }

    // (6c) the orders going to ONE of the two: the word is his alone — the panel names him, the door's mark would go now, the other keeps his stack
    { const R = await quiet(() => rig(2, RULE));
      if (R.why) line(false, 'the orders to one man of two', `not staged: ${R.why}`);
      else { await quiet(() => { for (let i = 0; i < 4 && R.O.recipients().length !== 1; i++) R.press(ORDERS.whoKey); });
        const one = R.O.recipients(), him = one.length === 1 ? one[0] : null, other = R.team.find((m: any) => m !== him), word = R.wordLine(), mark = R.mark();
        await quiet(() => { R.press(F); R.step(30); }); const filed = R.filed(), op = R.op(), kept = !!other && R.O.of(other)?.order === 'stack';
        line(!!him && !!word && word.includes(him.callsign) && !!mark && mark.now === true && filed.length === 1 && filed[0] === `go ${him.callsign}` && !!op && op.men.length === 1 && op.men[0] === him && kept,
          'the orders going to one man of the two: the panel names him, the door\'s mark would go now, the key files \'go\' for him alone and the other keeps his stack',
          `orders to: ${one.map((m: any) => m.callsign).join(', ') || 'NOBODY'} · the panel: ${word ?? 'NO LINE'} · the door's mark: ${mark ? (mark.now ? 'now' : 'NOT NOW') : 'NONE'} · filed: ${filed.join(', ') || 'NOTHING'} · the door's order: ${op ? op.men.map((m: any) => m.callsign).join(', ') : 'NONE'} · ${other ? `${other.callsign} ${R.O.of(other)?.order ?? 'no order'}` : ''}`); } }

    // (7) the squad of four: the rule is not its word
    { const play = async (rule: boolean) => { const R = await quiet(() => rig(4, rule)); if (R.why) return { why: R.why, log: '', digest: '' };
        await quiet(() => { R.press(F); R.step(300); }); return { why: null as string | null, log: R.O.log.map((r: any) => `${r.t.toFixed(3)} ${r.order} ${r.who.join('+')} ${r.target}`).join(' | '), digest: hashDigest(digestGame(R.g, true)) as string }; };
      const on = await play(true), off = await play(false);
      line(!on.why && !off.why && on.log === off.log && on.digest === off.digest && / go /.test(on.log), 'the squad of four, the same hand (the quick key on a door, the word, five seconds) with the rule on and off: the same order book and the same game by digest',
        on.why || off.why ? `not staged: ${on.why ?? off.why}` : `on: digest ${on.digest} · off: digest ${off.digest} · ${on.log === off.log ? 'the same order book' : 'THE ORDER BOOKS DIFFER'} · ${on.log.split(' | ').map((r: string) => r.split(' ')[1]).join(', ')}`); }

    // (8) a recording from before the key; the page's own boot
    { const R = await quiet(() => rig(2, RULE)), g = R.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g))), T = DOORTOOLS as any;
      T.wordSmall = true; const old = snap(); delete old.tables.DOORTOOLS.wordSmall; JOURNAL.applyKnobs(g, old); const without = T.wordSmall;
      const own = snap(); own.tables.DOORTOOLS.wordSmall = true; JOURNAL.applyKnobs(g, own); const withIt = T.wordSmall;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = T.wordSmall; PROFILE.pageSwitches(new URLSearchParams('wordsmall=0')); const b = T.wordSmall; PROFILE.pageSwitches(new URLSearchParams('standfire=0')); const c = T.wordSmall;
      line(without === false && withIt === true && a === true && b === false && c === true, 'DOORTOOLS.wordSmall: a recording from before the key replays with it off, one that carries it on plays with it on; the page\'s boot: no flag → on · ?wordsmall=0 → off · another flag leaves it on',
        `applyKnobs with no key → ${without} · with the key on → ${withIt} · '' → ${a} · 'wordsmall=0' → ${b} · 'standfire=0' → ${c}`); }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; AUTOPILOT.on = keep.ap; PLAN.on = keep.plan; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== wordsmall: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await wordsmallCheck()) ? 0 : 1);
