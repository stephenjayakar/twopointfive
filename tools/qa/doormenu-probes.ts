// The 'doormenu' family: X ON A DOOR IS THAT DOOR'S MENU, THE SAME ONE IN EVERY SCENARIO (the maintainer, 10-05, off the hostage rescue: "the two man hostage
// situation doesn't have the door tools menu? this should all be consistent"). The menu's rows never differed by scenario — what differed is how often the
// cursor ON A DOORWAY AS DRAWN was taken for a spot of floor: through an OPEN doorway its ray lands on the room's floor past the frame line, and the floor's
// menu has no door rows — and the rescues are the scenarios whose doors stand open. Run through probes.ts:
//   bun run tools/qa/probes.ts doormenu | doormenu-drawn | doormenu-open | doormenu-rows | doormenu-man | doormenu-knobs
// PASS / FAIL each, all headless (the Game of headless.ts stood up on each row's own level; nothing is drawn — "as drawn" is the cursor's ray against the same
// boxes the picture is made of, so this is the rule held to itself over every door, NOT a picture looked at). THE SCENARIOS are scene/scenarioList.ts
// SCENARIOS, row by row, each started as a click on its row starts it.
//   doormenu-drawn   in each scenario, every door as the scenario stages it: Sam on each free spot round it, the camera settled, the doorway's rectangle
//                    sampled across and up; every sample where the doorway IS DRAWN (nothing of the scene nearer along the cursor's ray than the doorway —
//                    men and glass looked past — or the door's own leaf there) must pick THAT door. Counted apart, as the rule has them: a teammate under
//                    the cursor (his menu), Sam's own body under it (his), another door nearer the landing point (that door's), another door's OWN LEAF seen through this doorway (that door's: a leaf the cursor is on is the
//                    door, orders.ts targetUnder — two doors swung open in one corner). A door never
//                    drawn from any spot is a FAIL (nothing was checked on it). The line also says how many the nearness rule alone (ORDERS.doorRay off:
//                    the build as it was) takes for the door.
//   doormenu-open    the same with every door of the level stood open: the cursor through an open doorway is the door, in every scenario
//   doormenu-rows    in each scenario: X on a shut door and on an open one (the cursor THROUGH the opening), the panel read — the first page's rows and keys,
//                    the row that opens the tools on 5, then 5 pressed and the tools page read. Every scenario must show the same rows on the same keys (the
//                    four's 'wait for my word' row counted apart) with at least one tool usable on the shut door; a tool that cannot be used there (a
//                    charge on an open door, no bangs left) is LISTED, greyed, with its reason — never absent. Row 4 of the tools is read under the
//                    stand's own rule: the turn to the threshold's page and that page's rows, or (DOORTOOLS.outsidePlain, on in the page) the one order
//                    'clear from outside', which 4 pressed must give
//   doormenu-man     what the rule leaves alone: a teammate stood in a doorway, the cursor on his chest — X is HIS menu and T is him, the knob on or off
//                    (one door a scenario)
//   doormenu-knobs   ORDERS.doorRay off is the pick as it was: the same cursor positions, taken by targetAt of the ray's landing point alone — and fewer
//                    of them the door
// The family's own red path: DOORMENU_BREAK=1 bun run tools/qa/probes.ts doormenu-drawn must FAIL (the doorway rule switched off under the probe).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { DOORTOOLS, TOOLS_PAGE, THR_PAGE } = await import(`${ROOT}/src/game/doortools.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { ORDERS, WORD_HEAD } = await import(`${ROOT}/src/game/orders.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const clone = (o: any) => JSON.parse(JSON.stringify(o));
// (startFromQuery writes the scenarios' team-start knobs — NIGHTBREACH.samAt, RESCUE.opsAt … — per level: put back with the rest, as the sibling families do)
const DEFAULTS = { DT: clone(DOORTOOLS), RC: clone(ROOMCLEAR), NB: clone(NIGHTBREACH), RS: clone(RESCUE), ORD: clone(ORDERS) };
const reset = () => { Object.assign(DOORTOOLS, clone(DEFAULTS.DT)); Object.assign(ROOMCLEAR, clone(DEFAULTS.RC)); Object.assign(NIGHTBREACH, clone(DEFAULTS.NB)); Object.assign(RESCUE, clone(DEFAULTS.RS)); Object.assign(ORDERS, clone(DEFAULTS.ORD)); };
/** every probe leaves the knob tables as it found them, and one that throws is a FAIL line, not a crash of the runner */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const quiet = <T>(fn: () => T): T => { if (VERBOSE) return fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '—';

interface Scn { name: string; query: string; level?: string; squad: 2 | 4 }
const LIST: Scn[] = SCENARIOS.map((e: any) => ({ name: e.title as string, query: scenarioQuery(e) as string, level: e.level as string | undefined, squad: e.squad as 2 | 4 }));

/** One game on the scenario's own level, the scenario started as its row starts it. step() keeps Sam dark and the defenders dazzled: this family is about what
 *  the cursor is on, not the fight. */
async function rig(scn: Scn, seed = 33) {
  reset(); Math.random = seeded(0xd00e + seed * 7919);
  let W: any;
  { const log = console.log, err = console.error, warn = console.warn; if (!VERBOSE) console.log = console.error = console.warn = () => { };
    try { W = await standUp({ uploadEvery: 1, ...(scn.level ? { level: levelOfFile(scn.level) } : {}) }); W.game.godMode = true; startFromQuery(W.game, new URLSearchParams(scn.query)); }
    finally { console.log = log; console.error = err; console.warn = warn; } }
  const game = W.game, input = W.input, O = game.orders, world = game.engine.world, CW = W.canvas.clientWidth as number, CH = W.canvas.clientHeight as number;
  if (process.env.DOORMENU_BREAK) ORDERS.doorRay = false;   // the family's red path
  const R = { W, game, input, O, scn, CW, CH,
    hostiles(): any[] { return [...(game.nightBreach.hostiles ?? []), ...(game.rescue.hostiles ?? [])]; },
    step(n = 1) { quiet(() => { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; for (const h of R.hostiles()) if (h.state !== 'dead') h.dazzledUntil = game.time + 5; W.step(DT); } }); },
    press(code: string) { input.pressed.add(code); R.step(); },
    /** the frame line of a door: along it, its normal, its centre, its width */
    frame(d: any) { const th = d.def.closedDir; return { ax: Math.cos(th), az: Math.sin(th), nx: -Math.sin(th), nz: Math.cos(th), c: d.frameCentre as number[], w: d.def.width as number }; },
    /** the free spots round a door Sam is stood on: either face, square on and off to each side, with a clear line to the doorway */
    spots(d: any): number[][] {
      const F = R.frame(d), out: number[][] = [];
      for (const off of [1.6, -1.6, 2.6, -2.6]) for (const lat of [0, 1.2, -1.2]) {
        const p = [F.c[0] + F.nx * off + F.ax * lat, 0, F.c[2] + F.nz * off + F.az * lat]; if (game.col.nav.isBlocked(p[0], p[2])) continue;
        if (game.col.solidBlocked([p[0], 1.2, p[2]], [F.c[0] + F.nx * Math.sign(off) * 0.3, 1.2, F.c[2] + F.nz * Math.sign(off) * 0.3])) continue;
        out.push(p); }
      return out;
    },
    /** Sam put there, the camera on him and settled (it is damped: a pick taken mid-glide is a pick of another picture) */
    stand(p: number[]) { quiet(() => game.teleportPlayer(p)); W.cam.target = [p[0], 0, p[2]]; R.step(40); },
    /** the doorway's rectangle, sampled: 7 across (a hand in from each jamb) × 6 up (shin to head height) */
    samples(d: any): number[][] {
      const F = R.frame(d), out: number[][] = [];
      for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) { const u = (i / 6 - 0.5) * (F.w - 0.16), y = 0.15 + j / 5 * 1.8; out.push([F.c[0] + F.ax * u, y, F.c[2] + F.az * u]); }
      return out;
    },
    /** A point of a doorway as the camera has it now: where on the screen (null: off it), whether the doorway is DRAWN there, and what the ray lands on.
     *  DRAWN, read off the boxes the frame is made of: along the cursor's ray — through glass, on past men and their kit — the first landing is the door's
     *  own leaf, or lies no nearer than the sample (the doorway is open there and the room shows through it, or the leaf is shut in it). `through`: the
     *  landing is past the frame line by more than a stride AND farther than doorPickM from the doorway (an open doorway looked through, where nearness alone
     *  does not say door). `man` / `sam`: a teammate's / Sam's own body is under the cursor. `at`: the
     *  point the cursor's own ray lands on (what targetAt is asked about). */
    look(d: any, q: number[]): { sx: number; sy: number; drawn: boolean; through: boolean; own: boolean; man: boolean; sam: boolean; at: number[] | null; leafOf: any } | null {
      const [sx, sy, front] = W.cam.project(q, CW, CH); if (!front || sx < 2 || sy < 2 || sx > CW - 2 || sy > CH - 2) return null;
      const ray = W.cam.ray(sx / CW, sy / CH), tq = Math.hypot(q[0] - ray.ro[0], q[1] - ray.ro[1], q[2] - ray.ro[2]);
      const first = world.raycast(ray.ro, ray.rd, 200, undefined, PLAYER_ID), at = first ? [0, 1, 2].map(k => ray.ro[k] + ray.rd[k] * first.t) : null;
      const man = O.squad().some((gd: any) => gd.state !== 'dead' && gd.char.rayHit(ray.ro, ray.rd, first ? first.t + 0.3 : 200) >= 0);
      const sam = game.player.char.rayHit(ray.ro, ray.rd, first ? first.t + 0.3 : 200) >= 0;
      const out = (drawn: boolean, through: boolean, own: boolean, leafOf: any = null) => ({ sx, sy, drawn, through, own, man, sam, at, leafOf });   // (`leafOf`: the OTHER door whose own leaf the ray lands on, seen through this doorway)
      let t0 = 0, skip = PLAYER_ID;
      for (let k = 0; k < 24; k++) {
        const ro = [0, 1, 2].map(i => ray.ro[i] + ray.rd[i] * t0), hit = world.raycast(ro, ray.rd, 200, BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass, skip);
        if (!hit) return out(true, true, false);
        const b = world.all[hit.index];
        if (b === d.box) return out(true, false, true);
        if (b.owner) { t0 += hit.t + 0.02; skip = b.owner; continue; }
        const t = t0 + hit.t, far = Math.hypot(ray.ro[0] + ray.rd[0] * t - d.frameCentre[0], ray.ro[2] + ray.rd[2] * t - d.frameCentre[2]);
        return out(t >= tq - 0.12, t > tq + 0.6 && far > ORDERS.doorPickM, false, game.doors.list.find((x: any) => x.box === b && !x.off) ?? null);
      }
      return out(false, false, false);
    },
    /** what X would open on with the cursor at that pixel */
    pick(sx: number, sy: number): any { input.mouseX = sx; input.mouseY = sy; return O.targetUnder(input, W.cam, W.canvas); },
    /** every door of the level stood open and held there (the closer off, as the Director's doors.open(…, {hold}) does it) */
    openAll() { for (const d of game.doors.list) { const a = Math.abs(d.maxA) >= Math.abs(d.minA) ? Math.min(d.maxA, 1.3) : Math.max(d.minA, -1.3); d.latched = false; d.closing = false; d.angle = a; d.vel = 0; d.quietT = -3600; d.place(); } R.step(4); },
    /** X pressed with the cursor at that pixel, a few frames with every key up: the panel's menu (or null) */
    openX(sx: number, sy: number): any { if (O.menu) O.close(); input.mouseX = sx; input.mouseY = sy; R.press(ORDERS.key); R.step(3); return O.hud().menu; },
  };
  R.step(30);
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;
const what = (t: any, d: any) => t.kind === 'door' ? (t.door === d ? 'door' : `the ${t.door.def.name} door`) : t.kind === 'floor' ? 'floor' : t.man ? 'a teammate' : 'nothing / Sam';

/** every door of a rig from every spot round it: the samples where it is drawn, and what each picks */
interface Sweep { doors: number; spots: number; drawn: number; hit: number; through: number; throughHit: number; was: number; hidden: number; onMan: number; atSam: number; other: number; leaf: number; misses: string[]; unseen: string[] }
function sweep(R: Rig): Sweep {
  const S: Sweep = { doors: 0, spots: 0, drawn: 0, hit: 0, through: 0, throughHit: 0, was: 0, hidden: 0, onMan: 0, atSam: 0, other: 0, leaf: 0, misses: [], unseen: [] };
  for (const d of R.game.doors.list) {
    S.doors++; let seen = 0;
    for (const p of R.spots(d)) {
      R.stand(p); S.spots++;
      for (const q of R.samples(d)) {
        const L = R.look(d, q); if (!L) continue; if (!L.drawn) { S.hidden++; continue; }
        const t = R.pick(L.sx, L.sy), ok = t.kind === 'door' && t.door === d;
        // what the rule gives to something else, each counted apart: a teammate under the cursor, Sam's own body, a door nearer the landing point
        if (!ok && L.man && t.kind === 'none' && t.man) { S.onMan++; continue; }
        if (!ok && L.sam && t.kind !== 'door') { S.atSam++; continue; }
        if (!ok && t.kind === 'door' && L.at && R.O.targetAt(L.at).door === t.door) { S.other++; continue; }   // (nearer the landing point by doorPickM, as ever — a wrong door off the ray is a miss)
        if (!ok && t.kind === 'door' && L.leafOf === t.door) { S.leaf++; continue; }   // (another door's own leaf shows through this doorway and the cursor is on it: the leaf under the cursor is its door, before any doorway — orders.ts targetUnder)
        S.drawn++; seen++; if (ok) S.hit++; if (L.through) { S.through++; if (ok) S.throughHit++; }
        if (!ok && S.misses.length < 6) S.misses.push(`${d.def.name} from ${p[0].toFixed(1)},${p[2].toFixed(1)} at height ${q[1].toFixed(2)}: ${what(t, d)}${L.at ? ` (the ray lands ${Math.hypot(L.at[0] - d.frameCentre[0], L.at[2] - d.frameCentre[2]).toFixed(2)} m from the doorway)` : ''}`);
        if (!process.env.DOORMENU_BREAK) { ORDERS.doorRay = false; const t0 = R.pick(L.sx, L.sy); ORDERS.doorRay = true; if (t0.kind === 'door' && t0.door === d) S.was++; }
      }
    }
    if (!seen) S.unseen.push(d.def.name);
  }
  return S;
}
const sweepWords = (S: Sweep) => `${S.doors} doors from ${S.spots} spots: the doorway drawn under the cursor ${S.drawn} times, that door's menu ${S.hit} (${pct(S.hit, S.drawn)}); `
  + `of them through an open doorway ${S.through}, that door's ${S.throughHit}${process.env.DOORMENU_BREAK ? '' : `; by nearness alone, as it was: ${S.was} (${pct(S.was, S.drawn)})`}`
  + `\n    not counted: hidden behind a wall or furniture ${S.hidden} · a teammate's body under the cursor ${S.onMan} · Sam's own body under the cursor ${S.atSam} · another door nearer ${S.other} · another door's own leaf seen through the doorway ${S.leaf}`
  + (S.unseen.length ? `\n    NEVER DRAWN from any spot: ${S.unseen.join(', ')}` : '') + (S.misses.length ? `\n    NOT THE DOOR: ${S.misses.join(' | ')}` : '');

async function drawnFamily(title: string, open: boolean): Promise<boolean> {
  const F = family(title); let tot = 0, hit = 0, was = 0;
  for (const scn of LIST) {
    const R = await rig(scn); if (open) R.openAll();
    const S = sweep(R); tot += S.drawn; hit += S.hit; was += S.was;
    F.verdict(S.drawn > 0 && S.hit === S.drawn && !S.unseen.length, `${scn.name}: the cursor on a door as drawn is that door${open ? ', every door stood open' : ''}`, sweepWords(S));
    reset();
  }
  console.log(`  all ${LIST.length} scenarios: ${hit} of ${tot} (${pct(hit, tot)}); by nearness alone ${was} (${pct(was, tot)})`);
  return F.done();
}
export const doormenuDrawn = guarded(() => drawnFamily("doormenu-drawn: X on a door as it is drawn opens that door's menu, in every scenario", false));
export const doormenuOpen = guarded(() => drawnFamily('doormenu-open: the cursor through an OPEN doorway is the door, in every scenario', true));

/** the panel's rows of an open menu: [the who row, one row an order …, (the four's wait row), the cancel row] */
interface PanelRow { id: string; key: string; text: string; off: boolean; why: string | null; opens: string | null }
function panel(R: Rig): { rows: PanelRow[]; wait: boolean; page: string | null } {
  const M = R.O.menu, hud = R.O.hud().menu, body = (hud?.rows ?? []).slice(1, 1 + M.rows.length);
  const rows: PanelRow[] = M.rows.map((d: any, i: number) => ({ id: d.id, key: String(body[i]?.opts?.[0]?.key ?? ''), text: String(body[i]?.opts?.[0]?.text ?? ''), off: !!body[i]?.off, why: M.why[i] ?? null, opens: d.opens ?? null }));
  return { rows, wait: !!M.wordRow && hud?.rows?.[1 + M.rows.length]?.label === WORD_HEAD, page: M.page ?? null };
}
const shape = (rows: PanelRow[]) => rows.map(r => `${r.key} ${r.id}${r.opens ? ' ▸' : ''}`).join(' · ');
/** a door of the rig with a spot and a pixel where the cursor is on it as asked: `through` an open doorway, or on the shut leaf */
function find(R: Rig, through: boolean): { d: any; sx: number; sy: number } | null {
  for (const d of R.game.doors.list) { if ((Math.abs(d.angle) > 0.6) !== through) continue;
    for (const p of R.spots(d)) { R.stand(p); for (const q of R.samples(d)) { const L = R.look(d, q); if (L && L.drawn && L.through === through && (through || L.own)) return { d, sx: L.sx, sy: L.sy }; } } }
  return null;
}
export const doormenuRows = guarded(async () => {
  const F = family('doormenu-rows: the same door menu, the same tools page, the same keys in every scenario — on a shut door and through an open one');
  let ref: { first: string; tools: string; thr: string; from: string } | null = null as any;
  for (const scn of LIST) {
    const R = await rig(scn); const bad: string[] = [], said: string[] = [];
    // one door stood open (the first with floor by it), the rest as staged — the level's own shut doors are the shut case
    const read = (label: string, through: boolean) => {
      const at = find(R, through); if (!at) { bad.push(`no ${label} found to put the cursor on`); return; }
      const hud = R.openX(at.sx, at.sy); if (!hud || !R.O.menu) { bad.push(`${label}: X opened no menu`); return; }
      if (R.O.menu.target.kind !== 'door' || R.O.menu.target.door !== at.d) { bad.push(`${label} (${at.d.def.name}): the menu is on ${what(R.O.menu.target, at.d)}`); R.O.close(); return; }
      const first = panel(R), opener = first.rows.find(r => r.opens === TOOLS_PAGE);
      if (!opener) bad.push(`${label}: no row opens the door tools`); else if (opener.key !== '5') bad.push(`${label}: the door tools row is on "${opener.key}"`);
      R.press('Digit5'); R.step(2);
      const tools = R.O.menu ? panel(R) : null; if (!tools || tools.page !== TOOLS_PAGE) { bad.push(`${label}: 5 did not turn to the tools page`); if (R.O.menu) R.O.close(); return; }
      if (scn.squad === 4 && !tools.wait) bad.push(`${label}: the four's tools page has no 'wait for my word' row`);
      if (scn.squad === 2 && tools.wait) bad.push(`${label}: the pair's tools page has a 'wait for my word' row`);
      // row 4 of the tools, read under the stand's own rule (as doortools-menu reads it). The pages as they were: the page of threshold work behind it (both
      // forms of the order, on 1 and 2). DOORTOOLS.outsidePlain (on in the page): no page — row 4 IS the one order, 'clear from outside', and 4 pressed gives it
      // to the men on that door; nothing of the tools turns to the threshold's page any more
      let c3 = '', thrSaid = '', thrRows: PanelRow[] = [];
      if (!DOORTOOLS.outsidePlain) {
        const deeper = tools.rows.find(r => r.opens === THR_PAGE); if (!deeper) bad.push(`${label}: no row of the tools opens the threshold's page`); else if (deeper.key !== '4') bad.push(`${label}: the threshold row is on "${deeper.key}"`);
        R.press('Digit4'); R.step(2);
        const thr = R.O.menu ? panel(R) : null; if (!thr || thr.page !== THR_PAGE) { bad.push(`${label}: 5, 4 did not turn to the threshold's page`); if (R.O.menu) R.O.close(); return; }
        if ((scn.squad === 4) !== thr.wait) bad.push(`${label}: the threshold's page ${thr.wait ? 'has' : 'has no'} 'wait for my word' row for a squad of ${scn.squad}`);
        c3 = thrSaid = shape(thr.rows); thrRows = thr.rows;
      } else {
        const turn = tools.rows.find(r => r.opens === THR_PAGE), one = tools.rows.find(r => r.id === 'thresholdHold');
        if (turn) bad.push(`${label}: a row of the tools still turns to the threshold's page ("${turn.key} ${turn.text}")`);
        if (!one) bad.push(`${label}: no row of the tools is 'clear from outside'`);
        else if (one.key !== '4') bad.push(`${label}: 'clear from outside' is on "${one.key}"`);
        else if (!one.text.startsWith('clear from outside')) bad.push(`${label}: row 4 reads "${one.text}"`);
        const onDoor = () => (R.game.doorTools.ops as any[]).filter(op => op.kind === 'threshold' && op.door === at.d), before = onDoor();
        R.press('Digit4'); R.step(2);
        const given = onDoor().filter(op => !before.includes(op)), up = !!R.O.menu;
        if (one && !one.why) { if (!given.length) bad.push(`${label}: 4 gave no order on ${at.d.def.name}`); if (up) bad.push(`${label}: 4 gave the order and left the menu up (page ${R.O.menu.page ?? 'the first'})`); }
        else if (one && given.length) bad.push(`${label}: 'clear from outside' is greyed (${one.why}) and 4 gave the order all the same`);
        thrSaid = given.length ? `4 the order itself (the men to ${at.d.def.name}, from outside)` : `4 the order itself (not given here)`;
        // the men taken off that door again ('fall in', the first page's 3): the open doorway and the empty pouch below are read with nobody at work
        if (given.length) { if (R.O.menu) R.O.close(); R.openX(at.sx, at.sy); if (R.O.menu) { R.press('Digit3'); R.step(2); } if (onDoor().length) bad.push(`${label}: 'fall in' left the men on ${at.d.def.name}`); }
        else if (!R.O.menu) R.openX(at.sx, at.sy);
      }
      // (through an open doorway the charge's digit holds its stand-in, 'shut that door' — shutdoor.ts: the same page, the same digits)
      const a = shape(first.rows), b = through ? shape(tools.rows).replace('3 shutDoor', '3 charge') : shape(tools.rows);
      if (!ref) ref = { first: a, tools: b, thr: c3, from: `${scn.name}, ${label}` };
      if (c3 !== ref.thr) bad.push(`${label}: threshold page "${c3}" ≠ "${ref.thr}" (${ref.from})`);
      for (const r of thrRows) if (r.why && !(r.off && r.text.includes(r.why.replace(/\.$/, '')))) bad.push(`${label}: '${r.id}' cannot be used (${r.why}) but its row does not say so ("${r.text}"${r.off ? '' : ', not greyed'})`);
      if (a !== ref.first) bad.push(`${label}: first page "${a}" ≠ "${ref.first}" (${ref.from})`);
      if (b !== ref.tools) bad.push(`${label}: tools page "${b}" ≠ "${ref.tools}" (${ref.from})`);
      // a tool that cannot be used here is listed with its reason — on the panel too
      for (const r of tools.rows) if (r.why && !(r.off && r.text.includes(r.why.replace(/\.$/, '')))) bad.push(`${label}: '${r.id}' cannot be used (${r.why}) but its row does not say so ("${r.text}"${r.off ? '' : ', not greyed'})`);
      if (!through && !tools.rows.some(r => !r.why)) bad.push(`${label}: no tool can be used on it (${tools.rows.map(r => `${r.id}: ${r.why}`).join(' · ')})`);
      if (through) { const c = tools.rows.find(r => r.id === 'charge' || r.id === 'shutDoor'); if (!c) bad.push(`${label}: neither the charge row nor 'shut that door' is on the page`); else if (c.key !== '3') bad.push(`${label}: '${c.id}' is on "${c.key}"`); else if (c.id === 'charge' && !c.why) bad.push(`${label}: a charge on an open door is offered`); }
      said.push(`${label} (${at.d.def.name}): ${a} → ${shape(tools.rows)}${tools.wait ? ' + wait' : ''} → ${thrSaid}${[...tools.rows, ...thrRows].filter(r => r.why).map(r => ` [${r.id}: ${r.why}]`).join('')}`);
      if (R.O.menu) R.O.close(); R.step(2);
    };
    read('a shut door', false);
    // (the doors of the level in its own order, each stood open alone until one is seen THROUGH from a spot by it: a leaf that swings one way only —
    // DOORWAY.oneWay, on in the page — can stand across its own opening from every spot the cursor is tried from, and that door is then put back as it was
    // and the next one tried. Where a door swings both ways the first is the one, as ever. The line names the door it read.)
    if (!find(R, true)) for (const d of R.game.doors.list) { if (!R.spots(d).length) continue;
      const was = { latched: d.latched, closing: d.closing, angle: d.angle, vel: d.vel, quietT: d.quietT };
      const a = Math.abs(d.maxA) >= Math.abs(d.minA) ? Math.min(d.maxA, 1.3) : Math.max(d.minA, -1.3); d.latched = false; d.closing = false; d.angle = a; d.vel = 0; d.quietT = -3600; d.place(); R.step(4);
      if (find(R, true)) break;
      Object.assign(d, was); d.place(); R.step(4); }
    read('an open doorway', true);
    // nothing left to bang with: the row stays, greyed, with the reason
    { const at = find(R, false); if (at) { R.game.doorTools.bangs = 0; R.openX(at.sx, at.sy); if (R.O.menu) { R.press('Digit5'); R.step(2); const t = R.O.menu ? panel(R) : null, b = t?.rows.find(r => r.id === 'bangClear');
        if (!b) bad.push('no bangs left: the bang row is absent'); else if (!(b.off && b.why)) bad.push(`no bangs left: the bang row is not greyed with a reason ("${b.text}")`); else said.push(`no bangs left: ${b.key} ${b.text}`);
        if (t && ref && shape(t.rows) !== ref.tools) bad.push(`no bangs left: the tools page changed shape ("${shape(t.rows)}")`); if (R.O.menu) R.O.close(); } else bad.push('no bangs left: X opened no menu'); } }
    F.verdict(!bad.length, `${scn.name}: X on a door = the door's menu with the tools on 5, the tools page on 1 to 4, ${DOORTOOLS.outsidePlain ? `'clear from outside' the one order on its 4` : `the threshold's page behind its 4`}`, bad.length ? bad.join('\n    ') : said.join('\n    '));
    reset();
  }
  return F.done();
});

export const doormenuMan = guarded(async () => {
  const F = family('doormenu-man: a teammate under the cursor is still the teammate — his menu on X, him on T — doorway behind him or not');
  for (const scn of LIST) {
    const R = await rig(scn); const { game, O, CW, CH } = R; const bad: string[] = []; let said = '';
    const man = O.squad()[0]; if (!man) bad.push('no teammate');
    search: for (const d of man ? game.doors.list : []) {
      for (const p of R.spots(d).filter(p => Math.hypot(p[0] - d.frameCentre[0], p[2] - d.frameCentre[2]) > 2.2)) {
        R.stand(p);
        const F0 = R.frame(d), side = Math.sign((p[0] - F0.c[0]) * F0.nx + (p[2] - F0.c[2]) * F0.nz) || 1, at = [F0.c[0] + F0.nx * side * 0.35, 0, F0.c[2] + F0.nz * side * 0.35];
        if (game.col.nav.isBlocked(at[0], at[2])) continue;
        man.char.pos[0] = at[0]; man.char.pos[1] = 0; man.char.pos[2] = at[2]; O.give('hold', { kind: 'none', at: [...game.player.char.pos] }, 'all'); R.step(3);   // (put there FIRST: a hold is where he stands — told to hold and then moved, he walks back to where he was told, and at a walk he is still inside the tolerance below when the cursor is read)
        if (Math.hypot(man.char.pos[0] - at[0], man.char.pos[2] - at[2]) > 0.4) continue;   // he walked off it
        const [sx, sy, front] = R.W.cam.project([man.char.pos[0], 1.2, man.char.pos[2]], CW, CH); if (!front) continue;
        const ray = R.W.cam.ray(sx / CW, sy / CH); if (!(man.char.rayHit(ray.ro, ray.rd, 200) >= 0)) continue;
        if (!O.doorOnRay(ray.ro, ray.rd)) continue;   // his chest is not drawn over the doorway from here: another spot
        const on = R.pick(sx, sy); ORDERS.doorRay = false; const off = R.pick(sx, sy); ORDERS.doorRay = true;
        if (!(off.kind === 'none' && off.man === man)) continue;   // something hides him from here
        if (!(on.kind === 'none' && on.man === man)) bad.push(`${d.def.name}: the cursor on ${man.callsign} in the doorway is ${what(on, d)}`);
        R.input.mouseX = sx; R.input.mouseY = sy; R.press(ORDERS.whoKey); if (O.who !== O.squad().indexOf(man)) bad.push(`${d.def.name}: T on him gave who = ${String(O.who)}`);
        R.press(ORDERS.whoKey); R.step(1);
        const hud = R.openX(sx, sy), mt = O.menu?.target; if (!hud || !mt || mt.kind !== 'none' || mt.man !== man) bad.push(`${d.def.name}: X on him opened ${mt ? what(mt, d) : 'no menu'}`);
        else said = `${man.callsign} stood in the ${d.def.name} doorway, the cursor on his chest (drawn over the doorway): X → his menu (${shape(panel(R).rows)}), T → him; the same with the knob off`;
        if (O.menu) O.close();
        break search;
      }
    }
    if (!said && !bad.length) bad.push('no door found to stand a man in with his chest drawn over the doorway');
    F.verdict(!bad.length, `${scn.name}: a teammate in a doorway keeps his own menu`, bad.length ? bad.join('\n    ') : said);
    reset();
  }
  return F.done();
});

export const doormenuKnobs = guarded(async () => {
  const F = family('doormenu-knobs: ORDERS.doorRay off is the pick as it was (targetAt of the ray\'s landing point)');
  const two = [LIST.find(s => /rescue/i.test(s.name) && !s.level)!, LIST.find(s => s.level === 'registry.json')!].filter(Boolean);
  if (two.length < 2) F.verdict(false, 'the two rescues are on the start card', `found ${two.length}`);
  let allOff = 0, allOn = 0;
  for (const scn of two) {
    const R = await rig(scn); const { game, O } = R; let n = 0, same = 0, fewer = 0, now = 0;
    for (const d of game.doors.list) for (const p of R.spots(d).slice(0, 3)) { R.stand(p);
      for (const q of R.samples(d)) { const L = R.look(d, q); if (!L || L.man || !L.at) continue;
        const old = O.targetAt(L.at);
        ORDERS.doorRay = false; const off = R.pick(L.sx, L.sy); ORDERS.doorRay = true; const on = R.pick(L.sx, L.sy);
        n++; if (off.kind === old.kind && off.door === old.door && off.man === old.man) same++;
        if (L.drawn) { if (off.kind === 'door' && off.door === d) fewer++; if (on.kind === 'door' && on.door === d) now++; } } }
    // (the rule on never loses the door where the old pick had it; that it FINDS more is asked over the scenarios together below — at a real-size doorway the
    //  landing point's own pick already has the door at every drawn sample of the registry, 899 of 899, and there is nothing left for the ray to add there)
    allOff += fewer; allOn += now;
    F.verdict(n > 0 && same === n && fewer <= now, `${scn.name}: the knob off, the pick is the old rule's`, `${n} cursor positions: ${same} the same as targetAt of the landing point; the door where it is drawn: ${fewer} off, ${now} on`);
    reset();
  }
  F.verdict(allOff < allOn, 'over the two: the ray finds the door where it is drawn more often than the landing point did', `${allOff} off, ${allOn} on`);
  return F.done();
});
