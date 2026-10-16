// THE TEAM & KIT PICTURE, EVERY LEVEL WITH A BLOCK (src/host/kitView.ts `?kitview`, staged from src/host/kitViewPlan.ts's plan — on a bespoke set where the way
// names one: src/host/kitViewSet.ts). The GENERIC rows: nothing here knows a level. What it holds a level-way to is read off the page's own plan
// (`__kitview.plan`: the anchor, the wall, the five places, the floor behind) and the game's own nav grid — so a level gets these rows by carrying a block.
// (The records office's own picture, row by row, is tools/qa/kitview-page.cjs; the plan without a browser is tools/qa/kitview-plan.ts.)
//
// The REAL page in headless Chromium on the software adapter, ONE page at a time, the engine's render stood in for by the world's pack (the picture is not this
// tool's question: nothing here is seen on a GPU), the game's clock run SCALE times faster. Per level-way, a squad of four:
//   · it boots to the loop with a plan, and says what it stands on (the anchor's kind, the set);
//   · THE PLAN HAS NO PROBLEMS (`__kitview.plan.problems`, as the page itself planned the way on the game's own floor: each is printed, any one FAILS the row);
//   · the mission's men (a squad of four; a quiet mission's own — Sam alone, or Sam and his partner) on the plan's places, each on free floor on the team's side of the wall's face, nobody else on the floor;
//   · EVERY TILE — Sam's gun, light, smoke, stun, frag, door charge, wand, camera, 40 mm (the launcher SHOULDERED down the wall and never fired: host/kitView.ts shellRow — on a card with no launcher the gun's row, said), wall charge; a teammate's gun, smoke, stun, frag, door charge — picked from rest:
//     its row begins within FRAMES display frames of the pick — or, picked while Sam is on his half step home or the leaf is not yet to, after the picture's
//     own wait, WAIT_MS at most — (a row the way cannot play — no leaf, a blank wall, no stretch to breach — is the GUN's row with
//     the reason kept: said, and a pass), and ends with every man home on his place and the world whole (the leaf hung and to, a wall anchor standing, no
//     charge left set, nobody hurt, no dissolve up) inside ROW_MS;
//     (a way anchored on a BLANK WALL: a row that needs an opening blows the wall charge on the span first and the hole is kept — 'the world whole' is then
//     the wall open at its hole and nothing else; the wall charge's own tile stands it again);
//     (a pick is a MESSAGE: the loop's own next turn of the old tile may begin on a frame before the page hears it. The row waited for is the first begun
//      after the pick was HEARD; the turn begun in between is said, and held to: cut by the pick, no mark made, nothing left set, nobody off his place);
//     and a wall anchor's flag and its wall never disagree: `hole` exactly when the span is open on the nav grid;
//   · A WALL SPAN, the light, then the gun, then the light again: the gun's burst goes through the kept hole and the SECOND light plays through that same hole —
//     no charge again, no restage, the wall never stood again under it (a mend that stood the wall with the flag still up lit a blank wall);
//   · A WALL SPAN, the wall charge's own tile with its STAND-CLEAR gate held shut (`__kitview.standClear` off: the tool's own switch): the charge comes down
//     unblown under the dissolve, the wall standing — and on the loop's next turn of that tile nobody walks out again: the gun's row, `refused` saying why;
//   · THE LAST TEAMMATE'S CARD opened too (one pick: his gun's row): with it over no two men stand within 0.5 m of each other — the fourth man of four has a
//     place of his own by Sam's jamb while his card is open;
//   · A TEAMMATE'S STUN AND HIS FRAG ARE THROWN where the plan says the way has a throw (a door or a gap with the floor behind it: no "no room … for a throw"
//     among the plan's problems): the row's own mark ('bang' / 'frag': the door tools counted it) — or the picture said why not (`refused` naming the tile:
//     an order refused at its start is the gun's row, above). A row that ends 'lost' with nothing thrown and nothing said FAILS (it passed);
//   · what was thrown came to rest BEYOND the anchor's line (through the opening, or the hole) and hurt nobody;
//   · ON A SET OF A QUIET MISSION OR THE SOLO NIGHT the men are dressed as that mission dresses them (main.ts: host/kitViewSet.ts kitViewSetDress → setSuitAs):
//     the sneaking suit on every man of a quiet mission, on Sam of the solo night — read off `__charmat`. A loud mission's set, a level's own way and
//     LOOK=plain: said, nothing judged. (Where the rifle hangs is not read on the page: tools/qa/kitview-plan.ts G holds it headless.)
//   · NO LOOSE PROP THE PLAN HIDES STILL STANDS (`plan.hiddenProps` against the game's own props): as the page comes up, after the mend that follows a gun's
//     burst (the mend puts every prop back on its rest pose: the child must take the plan's away again), and at the end. No prop hidden: true of nothing, and said;
//   · the gun's burst hurt no man of the team;
//   · a row CUT mid-way by another pick leaves every man home and the world whole;
//   · THE PICTURE RAISED NO ALARM: the level's devices sense nothing (host/kitView.ts kitViewInert — the game's own two switches), no device reported, the
//     floor never went up, no alarm was placed — LATCHED ON EVERY DISPLAY FRAME (`__kvAlarm`) and judged IN EVERY TILE'S ROW, then once more over the whole
//     run: every restage goes through the encounter's restart, which clears the devices' log, the floor and the placed alarm, so one reading at the end saw
//     only what happened after the LAST restage. (A report made and cleared between two display frames is still not seen: the frame is the tool's eye.);
//   · `pins` is 0 (the game's own men never had to be held), and the console said nothing.
//
//   node tools/qa/kitview-levels.cjs    env: PORT (5199) · QUALITY (verylow) · WARM (6) · SCALE (2) · LEVEL (comma list of level names; default: every
//       levels/<name>.json with a block AND `office`, the bundled office — its block is levels/office.scenarios.ts, read through bun — the look twins left to
//       the page: it opens a level in its default look) · WAY (1-based; default: each of the block's) · LOOK=plain (the file as named, not its look twin)
//       · KIND (roomclear | nightbreach | rescue | quiet | solo: the mission asked for; default: the level's own first of those — the bundled OFFICE: every
//         kind its one block serves, a run each: the room clear, the rescue, the night breach). `KIND=solo LEVEL=<name>` is the plain night ON THAT FILE
//         (`solo&levelFile=<name>.json`: no mission list's row builds that link — a fixture's; it dropped the file and opened the office whatever LEVEL said)
//   THE DRESS ROW JUDGES NOTHING ON THE DEFAULT LIST: no level in the repo stages a quiet or a solo mission on a set. Its fixture is the one
//   tools/qa/kitview-plan.ts G holds (a quiet mission's level with its one way on that check's own set), written to a file that is never committed:
//       KITPLAN_FIXTURE=levels/kv-quiet-set.json bun run tools/qa/kitview-plan.ts --quiet
//       LEVEL=kv-quiet-set KIND=quiet node tools/qa/kitview-levels.cjs            (Sam alone, in the sneaking suit)
//       LEVEL=kv-quiet-set KIND=quiet SQUAD=1 node tools/qa/kitview-levels.cjs    (Sam and his partner, both in it)
//       LEVEL=kv-quiet-set KIND=solo node tools/qa/kitview-levels.cjs             (the plain night on that file: Sam in it)
//       rm levels/kv-quiet-set.json
//   (NEVER RUN as of this writing: the three rows above are owed a page.)
//       · SQUAD (0‥4; default 4, a quiet mission 0) — THE LINK IS THE MISSION'S OWN, as the start page asks for the picture (ui/kitView.ts: the loadout's Deploy
//         query — game/loadout.ts squadSearch over the list row's scenarioQuery, read through bun): no size is written here that the page would not write (a
//         quiet mission alone carries NO `squad` key), and the row's link is printed · ROW_MS (a row's patience on the wall clock, 240000) · FRAMES (4)
//   KITLEVELS_BREAK=1: with HOME switched off a man is shoved a metre off his place as the cut row's picture settles — a teammate, or SAM HIMSELF where the
//       mission has him alone (a solo or a quiet mission: out from the wall, along the plan's own normal) — 'every man home' must FAIL (exit 1).
// Exit 0: every row passed. 1: a row failed. 2: no level asked about carries a block.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', WARM = +(process.env.WARM || 6), SCALE = +(process.env.SCALE || 2);
const ROW_MS = +(process.env.ROW_MS || 240000), FRAMES = +(process.env.FRAMES || 4), WAIT_MS = +(process.env.WAIT_MS || 3000), BREAK = process.env.KITLEVELS_BREAK === '1', PLAIN = process.env.LOOK === 'plain';
const SW = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|Failed to load resource|Failed to fetch/;
const BASE = `http://localhost:${PORT}/`, T0 = Date.now(), DIR = path.join(__dirname, '../../levels');
let bad = 0, rows = 0;
const row = (ok, what, detail) => { rows++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); if (!ok) bad++; };
const SAM = ['weapon', 'light', 'smoke', 'bangs', 'frags', 'charges', 'wand', 'cams', 'shells', 'walls'], MATE = ['weapon', 'smoke', 'bangs', 'frags', 'charges'], THROWN = ['smoke', 'bangs', 'frags'];

// the level-ways: every level file with a block (a look twin is the page's to open: `<name>-gwot` is asked about only by name)
const asked = (process.env.LEVEL || '').split(',').map(s => s.trim().replace(/\.json$/, '')).filter(Boolean);
const names = asked.length ? asked : [...fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.endsWith('-gwot.json') && !f.includes('.lint.') && f !== 'office.json').map(f => f.slice(0, -5)), 'office'].sort();
/** the bundled office's scenario data is code (levels/office.scenarios.ts): read through bun, the repo's own runner */
const officeScenarios = () => { try { return JSON.parse(require('child_process').execFileSync('bun', ['-e', `import { OFFICE_SCENARIOS as S } from ${JSON.stringify(path.join(DIR, 'office.scenarios.ts'))}; console.log(JSON.stringify(S));`], { encoding: 'utf8' })); } catch (e) { console.log(`(the office's scenarios could not be read through bun: ${String(e).slice(0, 160)})`); return {}; } };
/** THE MISSION'S OWN LINK (no leading '?'): the mission list's row of that kind on that level (none: a row of the kind's own size) deployed with `n` teammates, built
 *  by the two functions the start page builds it with (scene/scenarios.ts scenarioQuery, game/loadout.ts squadSearch) — through bun, the repo's own runner. The
 *  solo night's is `solo` (ui/missions.ts SOLO_KEY). A link that cannot be built is no run: the tool stops (exit 1). */
const SRC = path.join(__dirname, '../../src');
const missionQuery = (name, kind, n) => { if (kind === 'solo') return name === 'office' ? 'solo' : `solo&levelFile=${name}.json`;   // (the plain night on the level asked about: the file kept)
  const code = `import { ALL_MISSIONS } from ${JSON.stringify(path.join(SRC, 'scene/scenarioList.ts'))}; import { scenarioQuery } from ${JSON.stringify(path.join(SRC, 'scene/scenarios.ts'))}; import { squadSearch } from ${JSON.stringify(path.join(SRC, 'game/loadout.ts'))};
    const file = ${JSON.stringify(name === 'office' ? null : name + '.json')} ?? undefined, kind = ${JSON.stringify(kind)}, e = ALL_MISSIONS.find(x => x.kind === kind && x.level === file) ?? { id: '', title: '', kind, squad: kind === 'quiet' ? 0 : 2, ...(file ? { level: file } : {}) };
    console.log(squadSearch(scenarioQuery(e), ${+n}, e.squad).replace(/^\\?/, ''));`;
  try { const q = require('child_process').execFileSync('bun', ['-e', code], { encoding: 'utf8' }).trim(); if (!q) throw new Error('an empty link'); return q; }
  catch (e) { console.log(`kitview-levels: the mission's own link for ${name} (${kind}, ${n}) could not be built through bun: ${String(e).slice(0, 300)}`); process.exit(1); } };
const WAYS = [];
for (const name of names) { let S;
  if (name === 'office') S = officeScenarios(); else { try { S = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')).scenarios || {}; } catch { continue; } }
  const K = S.kitView; if (!K || !Array.isArray(K.ways)) continue;
  // (the bundled office's ONE block is staged by three kinds of mission, each from its own start: by default each is run — a rescue and the night breach stage way 1)
  const first = S.roomClear ? 'roomclear' : S.rescue ? 'rescue' : S.nightBreach ? 'nightbreach' : S.quiet ? 'quiet' : 'solo';
  const kinds = process.env.KIND ? [process.env.KIND] : name === 'office' ? [S.roomClear && 'roomclear', S.rescue && 'rescue', S.nightBreach && 'nightbreach'].filter(Boolean) : [first];
  for (const kind of kinds.length ? kinds : [first]) {
    const squad = process.env.SQUAD !== undefined ? Math.max(0, Math.min(kind === 'quiet' ? 1 : 4, +process.env.SQUAD || 0)) : kind === 'quiet' || kind === 'solo' ? 0 : 4;
    let own_ = null; const OWN = () => own_ ?? (own_ = missionQuery(name, kind, squad));   // (built once per level and kind, and only for a way that is run)
    K.ways.forEach((y, k) => { if (process.env.WAY && +process.env.WAY !== k + 1) return; if (kinds.length > 1 && kind !== 'roomclear' && k > 0) return;
      WAYS.push({ name, k, kind, squad, own: OWN, said: `${name} way ${k + 1} (${y.door || 'span'}${y.set ? ', set ' + y.set : ''}${kind === 'roomclear' && squad === 4 ? '' : `; ${kind}, ${squad ? 'Sam and ' + squad : 'Sam alone'}`})` }); }); } }

async function one(browser, L) {
  const t0 = Date.now(), ctx = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(scale => {
    { let e; Object.defineProperty(window, '__engine', { configurable: true, get: () => e, set: v => { e = v; if (v) v.render = () => { v.world.upload(); }; } }); }
    // (THE ALARM'S LATCH: what the devices reported, how high the floor went and whether an alarm was placed, kept across the encounter's restarts — each
    //  restage clears all three in the game)
    const A = window.__kvAlarm = { reports: [], level: 0, placed: false, frames: 0 };
    const latch = () => { const g = window.__game; if (!g) return; try { A.frames++; for (const r of (g.devices && g.devices.log) || []) { const s = `${r.device} ${r.what}`; if (!A.reports.includes(s)) A.reports.push(s); } A.level = Math.max(A.level, g.escalation || 0); if (g.alarm && g.alarm.placed) A.placed = true; } catch { /* a game not yet whole */ } };
    const tick = () => { requestAnimationFrame(tick); const k = window.__kitview; if (k && typeof k.rest === 'function' && k.state !== 'none' && window.__timeScale !== scale) window.__timeScale = scale; if (k && k.state !== 'none') latch(); };
    requestAnimationFrame(tick);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
    /** the picture as it stands, against its own plan */
    window.__kvl = () => { const k = window.__kitview, g = window.__game, P = k.plan; if (!P) return { state: k.state, plan: null, why: `state ${k.state} · refused '${k.refused || ''}' · room clear ${g.roomClear.active ? 'on' : 'OFF'}${g.roomClear.end ?? g.roomClear.result ? ' ENDED' : ''} · ${g.guards.filter(x => x.team === 'operative' && x.state !== 'dead').length} teammate(s) up · Sam ${g.player.down ? 'DOWN' : 'up'}` };
      const A = P.anchor, sg = Math.sign(dot([P.ref[0] - A.mid[0], P.ref[1] - A.mid[1]], A.n)) || 1, out = (x, z) => dot([x - A.mid[0], z - A.mid[1]], A.n) * sg;
      const team = g.guards.filter(x => x.team === 'operative'), d = A.door ? g.doors.byName(A.door) : null;
      const men = k.men.map(m => { const s = P.slots[m.slot]; return { name: m.name, slot: m.slot, off: s ? Math.hypot(m.x - s[0], m.z - s[1]) : 99, free: !g.col.nav.isBlocked(m.x, m.z), out: out(m.x, m.z) }; });
      const dress = (() => { try { const M = window.__charmat; return M ? [M.get('sam'), ...team.map(x => M.get(g.guards.indexOf(x)))].map(x => x && x.suit ? 'suit' : 'issue') : null; } catch { return null; } })();   // (who is drawn in the sneaking suit, as the game says it — main.ts __charmat: said on every way, JUDGED on a set of a quiet mission or the solo night)
      // (the loose props the plan hides — indexes into the game's props as it was built, `all` — that still stand: `props` is that list less what was taken away)
      const hid = P.hiddenProps || [], props = { hid: hid.length, up: hid.filter(i => { const p = g.props.all[i]; return !!p && g.props.props.includes(p); }).length };
      return { state: k.state, dress, props, locked: !!A.locked, level: g.level.name || '', kind: A.kind, door: A.door, set: P.set, face: P.wall.face, reachIn: P.reachIn, hole: P.hole, sunk: P.sunk, hand: P.hand, indoors: P.indoors, men,
        apart: (() => { let m = 99, a = '', b = ''; for (let i = 0; i < k.men.length; i++) for (let j = i + 1; j < k.men.length; j++) { const d = Math.hypot(k.men[i].x - k.men[j].x, k.men[i].z - k.men[j].z); if (d < m) { m = d; a = k.men[i].name; b = k.men[j].name; } } return { m, a, b }; })(),   // (the two men nearest each other, as they stand)
        offMax: Math.max(0, ...men.map(m => m.off)), hurt: team.filter(x => x.wound || x.state === 'dead').length + (g.player.down ? 1 : 0), alive: team.filter(x => x.state !== 'dead').length,
        others: g.guards.concat(g.civilians).filter(x => x.team !== 'operative' && x.char.pos[0] > -30).length,
        leaf: d ? { ajar: Math.abs(d.angle - (d.def.angle || 0)), off: !!d.off } : null, problems: P.problems || [],
        // (a wall anchor STANDS when every point along its span — a quarter metre apart, a tenth in from each end — is shut on the game's own nav grid)
        wallUp: A.kind === 'wall' ? (() => { const n = Math.max(2, Math.ceil(A.width * 0.8 / 0.25)); for (let i = 0; i <= n; i++) { const u = 0.1 + 0.8 * i / n; if (!g.col.nav.isBlocked(A.a[0] + (A.b[0] - A.a[0]) * u, A.a[1] + (A.b[1] - A.a[1]) * u)) return false; } return true; })() : null,
        set_: g.doorTools.set.length, ops: g.doorTools.ops.length, puppet: !!g.puppet, dz: k.dissolve.phase, settled: !!k.settled, beat: k.beat ? { n: k.beat.n, field: k.beat.field, i: k.beat.i, t: k.beat.t, phase: k.beat.phase } : null,
        wc: g.wallCharge ? g.wallCharge.set.length + g.wallCharge.ops.length : 0, last: k.last ? { n: k.last.n, field: k.last.field, how: k.last.how, marks: (k.last.marks || []).slice(), restOut: k.last.rest ? out(k.last.rest[0], k.last.rest[2]) : null } : null,
        alarm: (() => { const A = window.__kvAlarm; for (const r of (g.devices && g.devices.log) || []) { const s = `${r.device} ${r.what}`; if (!A.reports.includes(s)) A.reports.push(s); } A.level = Math.max(A.level, g.escalation || 0); if (g.alarm && g.alarm.placed) A.placed = true;   // (the latch, and this very moment folded into it)
          return { reports: A.reports.slice(), level: A.level, placed: A.placed, sensing: !!(g.tune.devices || g.tune.lasers), frames: A.frames }; })(),
        refused: k.refused, pins: k.pins || 0, shots: k.shots || 0, cuts: k.cuts, restarts: k.restarts, hits: { ...(k.hits || {}) }, blocked: k.blocked }; };
    /** a pick, then every display frame until a NEW beat is up (`began`: frames and ms from the telling), until it is over and the picture has settled (`ended`) —
     *  or, `cutAt` given: until the beat is that many game seconds in, when `cutTo` is picked over it and THAT row is waited out. `ms`: the patience.
     *  A NEW beat is one begun after the pick was HEARD, not after it was told: a message is a task, and a display frame may run before the page hears it —
     *  the loop's own next turn of the tile still under the highlight can begin on that frame, for the card still open (records' front way, 10-16: Sam's wall
     *  charge came up again on the frame teammate 1's card was asked for, was cut by the pick a frame later, and was read as the pick's row). This listener is
     *  added after the director's, so it runs once the director has heard the same message: every beat begun by then is the loop's, and `stray` says what
     *  that beat was and what the pick's cut left of it (`how`, its marks, anything still set) — a row holds it to nothing */
    window.__kvRow = (msg, ms, cutAt, cutTo, shove) => new Promise(res => { const k = window.__kitview, g = window.__game, w0 = performance.now();
      // (`msg` null: nothing is told — the beat that is up now, or the loop's next, is the one waited out)
      let n0 = k.beat ? k.beat.n - (msg ? 0 : 1) : k.last ? k.last.n : 0, frames = 0, began = null, cut = null, shoved = false, far = 0, said; const cuts0 = k.cuts;   // (`said`: `refused` on the first frame the row is over — the loop's next beat clears it as it begins)
      /** the furthest any man stands off his place of the plan, this frame (`far`: the most of it from the beat's first frame on) */
      const offNow = () => { const P = k.plan; if (!P) return 0; let m = 0; for (const x of k.men) { const s = P.slots[x.slot]; if (s) m = Math.max(m, Math.hypot(x.x - s[0], x.z - s[1])); } return m; };
      let stray = null;
      if (msg) { const heard = e => { const m = e.data; if (e.source !== window || !m || m.kv !== msg.kv || m.who !== msg.who || m.field !== msg.field) return; window.removeEventListener('message', heard);
          const n1 = Math.max(k.beat ? k.beat.n : 0, k.last ? k.last.n : 0);   // (beats are numbered as they begin: the highest begun by now)
          const b = k.beat && k.beat.n === n1 ? k.beat : k.last;
          if (!(n1 > n0 && k.queue.length) || (b.i === (msg.who || 0) && b.field === msg.field)) return;   // (nothing began in between — or the director took no pick from it: the tile was already the one under the highlight — or what began is that member's turn of that very tile: the row asked for, as before)
          stray = { n: n1, frames, ms: performance.now() - w0, field: b.field, i: b.i, how: null, left: null };
          // (another card's pick cuts in the message's own task: what that cut left is read here, before the picked row's first frame can set anything of its own)
          if (!k.beat && k.last && k.last.n === n1) stray.left = { set: g.doorTools.set.length, ops: g.doorTools.ops.length, wc: g.wallCharge ? g.wallCharge.set.length + g.wallCharge.ops.length : 0, far: offNow() };
          n0 = n1; began = null; far = 0; };
        window.addEventListener('message', heard); window.postMessage(msg, location.origin); }
      const f = () => { frames++; const el = performance.now() - w0;
        if (stray && stray.how === null && k.last && k.last.n >= stray.n) Object.assign(stray, k.last.n === stray.n ? { how: k.last.how, t: k.last.t, marks: (k.last.marks || []).slice() } : { how: 'never read', t: 0, marks: [] });
        if (!began && k.beat && k.beat.n > n0) began = { frames, ms: el, field: k.beat.field, i: k.beat.i, n: k.beat.n, refused: k.refused, prelude: k.beat.marks.includes('prelude') };
        if (began) far = Math.max(far, offNow());
        if (began && said === undefined && k.last && k.last.n >= began.n) said = k.last.n === began.n ? k.refused || null : null;
        if (began && cutAt !== undefined && !cut && k.beat && k.beat.n === began.n && k.beat.t >= cutAt) { cut = { at: k.beat.t, phase: k.beat.phase, field: k.beat.field }; window.postMessage(cutTo, location.origin); }
        if (cutAt !== undefined && began && !cut && k.last && k.last.n >= began.n) { n0 = began.n; began = null; }   // (over before it could be cut: the loop plays it again — wait for that one)
        const over = began && k.last && k.last.n >= began.n && (cutAt === undefined || (cut && k.cuts > cuts0));
        // (over: the picture SETTLED with its leaf hung — or the loop's NEXT beat is up: a row that keeps the leaf for its next turn never settles between two, and what a
        //  charge broke is mended under the dissolve as the next row begins)
        const d = k.plan && k.plan.anchor.door ? g.doors.byName(k.plan.anchor.door) : null, next = over && k.beat && k.beat.n > (cut ? began.n + 1 : began.n);
        if (shoved) { res({ began, cut, stray, cuts: k.cuts - cuts0, ended: { ms: el, frames, by: 'settled' }, at: window.__kvl() }); return; }
        if (over && ((k.settled && !(d && d.off)) || next)) { const by = next && !k.settled ? 'next' : 'settled';
          if (shove && !shoved) { shoved = true; k.home = false; const x = g.guards.find(x => x.team === 'operative' && x.state !== 'dead'); if (x) { const c = x.char.pos; x.char.pos = [c[0] + 1, c[1], c[2]]; x.path = []; x.pathGoal = null; }
            else { const c = g.player.char.pos, n = k.plan.anchor.n; g.player.char.pos = [c[0] + n[0], c[1], c[2] + n[1]]; g.puppet = null; }   // (Sam alone: there is no teammate to shove — the break acted on nobody and the tool said 0 FAIL)
            requestAnimationFrame(f); return; }   // (read on the NEXT frame: the readout's men are the frame's)
          res({ began, cut, stray, far, said: said || null, cuts: k.cuts - cuts0, ended: { ms: el, frames, by }, at: window.__kvl() }); return; }
        if (el > ms) { res({ began, cut, stray, cuts: k.cuts - cuts0, ended: null, at: window.__kvl() }); return; }
        requestAnimationFrame(f); };
      requestAnimationFrame(f); });
  }, SCALE);
  const page = await ctx.newPage(); page.setDefaultTimeout(0);
  let errors = 0; const errs = [];
  page.on('pageerror', e => { errors++; errs.push(String(e).slice(0, 200)); });
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) { errors++; errs.push(m.text().slice(0, 200)); } });
  // (THE MISSION'S OWN LINK — missionQuery above: the bundled office names no level file, a solo night no scenario, a quiet mission alone no size — and the way in)
  const w = L.said, N = L.squad, own = L.own(), url = `${BASE}?${own}&way=${L.k + 1}&kitview=${WARM}&mute&noreplay&quality=${QUALITY}${PLAIN ? '&look=plain' : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let ready = true;
  for (let i = 0; ; i++) {
    try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 600000 }); await page.evaluate(() => window.__ready); break; }
    catch (e) { if (i >= 3 || !/navigation|destroyed/i.test(String(e))) { ready = false; break; } await page.waitForLoadState('domcontentloaded').catch(() => {}); }
  }
  const up = ready && await page.waitForFunction(() => { const s = window.__kitview && window.__kitview.state; return s === 'none' || s === 'rest' || s === 'beat' || s === 'swap'; }, null, { timeout: 300000 }).then(() => true, () => false);
  const a = up ? await page.evaluate(() => window.__kvl()) : { state: ready ? 'never staged' : 'never ready', plan: null };
  const live = up && a.plan !== null && a.state !== 'none';
  row(live, `${w}: the page boots to the loop on a plan`, live ? `${a.state} on '${a.level}' · the anchor a ${a.kind}${a.door ? ` '${a.door}'` : ''}${a.set ? `, on the set '${a.set}'` : ', the level\'s own'} · hand ${a.hand} · ${a.indoors ? 'indoors' : 'under the sky'} · ${a.sunk} boxes out of the picture · ${a.reachIn.toFixed(2)} m of floor behind · asked as the mission's own '?${own}&way=${L.k + 1}' · ${((Date.now() - t0) / 1000).toFixed(0)} s` : `${a.state} (asked as '?${own}&way=${L.k + 1}')${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
  if (!live) { row(errors === 0, `${w}: the console said nothing`, errs.slice(0, 4).join(' | ') || 'no error'); await ctx.close(); return; }
  row(a.problems.length === 0, `${w}: the plan the page made has no problems`, a.problems.length ? a.problems.map((p, i) => `${i + 1}. ${p}`).join('\n    ') : 'none (`__kitview.plan.problems`: the way planned on the game\'s own floor)');
  const menSaid = s => s.men.map(m => `${m.name} place ${m.slot} ${m.off.toFixed(2)} m off${m.free ? '' : ' NOT FREE'} ${m.out.toFixed(2)} m out`).join(' · ');
  // (the first picture may be mid-beat: wait for rest once, then read the places)
  const r0 = await page.evaluate(ms => window.__kvRow({ kv: 'sel', who: 0, field: 'weapon' }, ms), ROW_MS);
  row(r0.at.men.length === N + 1 && r0.at.offMax <= 0.3 && new Set(r0.at.men.map(m => m.slot)).size === N + 1, `${w}: ${N + 1 === 5 ? 'five men' : N ? `Sam and ${N}` : 'Sam alone'}, each on a place of the plan`, `${menSaid(r0.at)}${r0.at.dress ? ` · dressed (Sam first): ${r0.at.dress.map(d => d === 'suit' ? 'the sneaking suit' : 'the issue dress').join(', ')}` : ''}`);
  row(r0.at.men.every(m => m.free && m.out >= r0.at.face - 0.01) && r0.at.blocked === 0, `${w}: every man on free floor, on the team's side of the wall's face (${r0.at.face} m), nobody in a wall`, `${menSaid(r0.at)} · ${r0.at.blocked} place(s) the plan had to step over`);
  row(r0.at.others === 0, `${w}: nobody else on the floor`, `${r0.at.others} who are not the team within the world`);
  // THE DRESS ON A SET IS THE MISSION'S (a set is staged as a room clear, whose men wear the issue dress: main.ts says the mission's own dress in this window —
  // host/kitViewSet.ts kitViewSetDress). A quiet mission dresses every man in the sneaking suit, the solo night Sam; a loud mission's set: nothing judged
  if (r0.at.set && (L.kind === 'quiet' || L.kind === 'solo')) { const D = r0.at.dress, who = L.kind === 'quiet' ? (D || []).map((_, i) => i) : [0];
    row(PLAIN || (!!D && D.length === N + 1 && who.every(i => D[i] === 'suit')), `${w}: on the set the men are dressed as the mission dresses them — the sneaking suit on ${L.kind === 'quiet' ? 'every man' : 'Sam'}`,
      PLAIN ? 'LOOK=plain: the look is off and nobody is drawn in it — said, not judged' : D ? `${D.map((d, i) => `${i ? 'teammate ' + i : 'Sam'}: ${d === 'suit' ? 'the sneaking suit' : 'THE ISSUE DRESS'}`).join(', ')} (${D.length} of ${N + 1} read)` : 'THE DRESS COULD NOT BE READ (no __charmat on the page)'); }
  // (read as the picture SETTLED: every man on his place, the leaf to, nothing set, no dissolve up. Read as the loop's NEXT beat came up: every man but that beat's own
  //  on his place and the leaf HUNG — ajar is the row's own use of it, an order or a dissolve the new beat's)
  // (HOME_M: every man within it of his place. SAM AT A WALL LEFT OPEN — what the charge threw down may lie on his place: his half step home is given up within
  //  SAM_GIVE of it, and where he stands is then his place: host/kitView.ts KIT_VIEW_LOOP.samGive, the same number)
  const HOME_M = 0.35, SAM_GIVE = 0.5, off = (s, by) => Math.max(0, ...s.men.filter(m => !(by === 'next' && s.beat && m.slot === (s.beat.i === 0 ? 0 : 1))).map(m => m.slot === 0 && s.hole ? Math.max(0, m.off - (SAM_GIVE - HOME_M)) : m.off));
  // (A WALL ANCHOR'S FLAG AND ITS WALL NEVER DISAGREE: `hole` exactly when the span is open)
  const whole = (s, by) => off(s, by) <= HOME_M && s.hurt === 0 && s.alive === N && (!s.leaf || (!s.leaf.off && (by === 'next' || s.leaf.ajar < 0.05))) && (s.wallUp === null || s.hole === !s.wallUp) && (by === 'next' || (s.set_ === 0 && s.ops === 0 && !s.puppet && s.dz === ''));
  const wholeSaid = (s, by) => `the furthest man ${off(s, by).toFixed(2)} m off his place${by === 'next' ? ' (the next beat\'s own man apart)' : ''} · ${s.hurt} hurt, ${s.alive} of ${N} up${s.leaf ? ` · the leaf ${s.leaf.off ? 'OFF' : s.leaf.ajar.toFixed(2) + ' rad ajar'}` : ''}${s.wallUp !== null ? ` · the wall ${s.wallUp ? (s.hole ? 'STANDS WITH ITS HOLE FLAG UP' : 'stands') : s.hole ? 'open: the hole its charge left, kept' : 'OPEN, NO HOLE KEPT'}` : ''} · ${s.set_} charge(s) set, ${s.ops} door op(s)${s.puppet ? ' · Sam still a puppet' : ''}${s.dz ? ` · dissolve '${s.dz}'` : ''}`;
  const throwsSeen = [], guns = [], blown = [], mended = []; let burstOf = null;
  // (THE WAY HAS A THROW, as the plan says it: a door or a gap, and no problem of the floor behind it. The row's own word for the thing gone: the door tools' count)
  const throwWay = a.kind !== 'wall' && !a.problems.some(p => /for a throw/.test(p)), WORD = { smoke: 'smoke', bangs: 'bang', frags: 'frag' };
  const tile = async (who, f, timed) => { const b = await page.evaluate(() => window.__kvl()); let r = await page.evaluate(([msg, ms]) => window.__kvRow(msg, ms), [{ kv: 'sel', who, field: f }, ROW_MS]);
    // (A BLANK WALL OPENS ONCE: the row that needs an opening was the wall charge on the span — the hole is kept and the loop plays the row asked through it: that one is waited out too)
    // (THE PICTURE WENT OUT under the row — no plan left to read the men against: said with what the page knows, and the rows end here)
    if (r.at.plan === null || b.plan === null) { const x = r.at.plan === null ? r.at : b; throw new Error(`THE PICTURE WENT OUT at ${who ? `teammate ${who}'s` : 'Sam\'s'} ${f}: ${x.why}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`); }
    const opened = !b.hole && r.at.hole && !!r.began && !!r.ended;
    if (opened) { blown.push({ who, f, sam: (r.at.hits.sam || 0) - (b.hits.sam || 0), team: (r.at.hits.team || 0) - (b.hits.team || 0), hurt: r.at.hurt, off: r.at.offMax });   // (read as the charge's own row ended: the blast's frame is behind it)
      const r2 = await page.evaluate(ms => window.__kvRow(null, ms), ROW_MS); r = { ...r2, began: r.began, ended: r2.began && r2.began.field === f ? r2.ended : null }; }
    // (the mend that follows a burst runs as the NEXT row begins: this row's reading is the first after it)
    if (burstOf) { mended.push({ after: burstOf, up: r.at.props.up }); burstOf = null; }
    const whoSaid = who ? `teammate ${who}'s` : 'Sam\'s', own = r.began && r.began.field === f && r.began.i === who, guns_ = r.began && r.began.field === 'weapon' && f !== 'weapon' && !!r.began.refused, held = b.puppet || (b.leaf && b.leaf.ajar >= 0.03), inTime = !timed || (r.began && (r.began.frames <= FRAMES || (held && r.began.ms <= WAIT_MS)));   // (`held`: the row's own WAIT — Sam on his half step home, the leaf not yet to — is the picture's rule, not a late row: WAIT_MS at most)
    // (THE LOOP'S OWN TURN, begun on a frame the pick had not yet been heard on — __kvRow's `stray`: the pick must have CUT it, with no mark made (nothing
    //  fired, thrown, set or blown; a wall charge's prelude is its first word, not a deed), nothing left set by it and no man walked off his place)
    const Y = r.stray, strayOk = !Y || (Y.how === 'cut' && Y.marks.every(m => m === 'prelude') && (!Y.left || (Y.left.set === 0 && Y.left.ops === 0 && Y.left.wc === 0 && Y.left.far <= HOME_M)));
    const straySaid = !Y ? '' : ` · (the loop's own turn of ${Y.i ? `teammate ${Y.i}'s` : 'Sam\'s'} ${Y.field} began before the pick was heard, ${Y.frames} frame(s), ${Y.ms.toFixed(0)} ms after it was told: ${Y.how === 'cut' ? `cut by the pick ${Y.t.toFixed(2)} s in` : `NOT CUT BY THE PICK (${Y.how})`}, marks [${(Y.marks || []).join(', ')}]${Y.left ? `, left ${Y.left.set} charge(s) set, ${Y.left.ops} door op(s), ${Y.left.wc} on the wall, the furthest man ${Y.left.far.toFixed(2)} m off his place` : ''})`;
    // (A TEAMMATE'S STUN AND FRAG, THROWN: his own row on a way with a throw ends with the thing gone — or with the picture's word why not. 'lost', nothing said: FAIL)
    const L_ = r.at.last && r.at.last.field === f ? r.at.last : null, must = who >= 1 && (f === 'bangs' || f === 'frags') && own && throwWay && !!r.ended, threw = !!L_ && L_.marks.includes(WORD[f]), why = r.said && r.said.startsWith(`${f}:`) ? r.said : null;
    const thrownSaid = !must ? '' : ` · ${threw ? `thrown (marks [${L_.marks.join(', ')}])` : why ? `not thrown, and said: '${why}'` : `NEVER THROWN and nothing said (marks [${L_ ? L_.marks.join(', ') : ''}]${r.at.locked ? '; the plan\'s door is locked' : ''}): the plan says this way has a throw`}`;
    // (NO ALARM UNDER THIS ROW: what the latch gained since the reading before the pick — a report, the floor up, an alarm placed — or the devices sensing now)
    const al = r.at.alarm, al0 = b.alarm, rang = al.reports.length > al0.reports.length || al.level > al0.level || (al.placed && !al0.placed) || al.sensing;
    const rangSaid = !rang ? '' : ` · AN ALARM UNDER THIS ROW: ${al.sensing ? 'the devices ARE SENSING · ' : ''}${al.reports.length > al0.reports.length ? 'reported: ' + al.reports.slice(al0.reports.length).slice(0, 4).join(', ') + ' · ' : ''}the floor ${al0.level} → ${al.level}${al.placed && !al0.placed ? ' · an alarm placed' : ''}`;
    row(!!r.began && (own || guns_) && inTime && strayOk && !!r.ended && whole(r.at, r.ended && r.ended.by) && (!must || threw || !!why) && !rang, `${w}: ${whoSaid} ${f} — its row begins on the pick${timed ? '' : ' (as his card opens: he walks to the head of the file first)'}${must ? ', the thing is thrown' : ''} and ends with every man home, the world whole and no alarm raised`,
      `${!r.began ? 'NO ROW BEGAN' : `${own ? `the ${f} row` : guns_ ? `THE GUN'S ROW ('${r.began.refused}')` : `ANOTHER ROW (${r.began.field}, member ${r.began.i}${r.began.refused ? `, '${r.began.refused}'` : ''})`} up ${r.began.frames} frame(s), ${r.began.ms.toFixed(0)} ms after the pick${held && r.began.frames > FRAMES ? ' (the row\'s own wait: ' + (b.puppet ? 'Sam on his half step home' : 'the leaf not yet to') + ')' : ''}`} · ${r.ended ? `over and ${r.ended.by === 'next' ? 'the loop\'s next beat up' : 'settled'} ${(r.ended.ms / 1000).toFixed(1)} s on (${r.at.last ? r.at.last.how : '?'})` : `NEVER SETTLED in ${ROW_MS / 1000} s (${r.at.state}${r.at.beat ? ', ' + r.at.beat.field + '/' + r.at.beat.phase : ''})`} · ${wholeSaid(r.at, r.ended && r.ended.by)}${opened ? ' · (the wall was opened for it first: its charge, then the row through the hole)' : ''}${thrownSaid}${straySaid}${rangSaid}`);
    if (own && THROWN.includes(f) && r.at.last && r.at.last.field === f) throwsSeen.push({ who, f, out: r.at.last.restOut, how: r.at.last.how, hurt: r.at.hurt, hitsSam: (r.at.hits.sam || 0) - (b.hits.sam || 0), kept: r.at.refused });
    if (f === 'weapon') { guns.push({ who, shots: r.at.shots - b.shots, hurt: r.at.hurt }); if (r.at.shots > b.shots) burstOf = `${whoSaid} gun (${r.at.shots - b.shots} round(s))`; }
    return r; };
  for (const f of SAM) await tile(0, f, f !== 'weapon');   // (his gun is the tile already under the highlight: the loop's own turn of it is what comes up, not a pick's)
  let first = true; if (N >= 1) for (const f of MATE) { await tile(1, f, !first); first = false; }
  // THE LAST TEAMMATE'S CARD (one pick more: teammate 1's is the head of the stack already, and every row above is his or Sam's): opened, its man walks to where
  // his card stands him — the fourth of a squad of four to a place of his own by Sam's jamb (host/kitViewPlan.ts kitPlanAct4: on a wide opening that place as
  // written fell 0.39 m from Sam's) — his gun's row plays, and with it over NO TWO MEN STAND WITHIN A BODY of each other (APART_M, centre to centre)
  const APART_M = 0.5;
  if (N >= 2) { const r = await page.evaluate(([msg, ms]) => window.__kvRow(msg, ms), [{ kv: 'sel', who: N, field: 'weapon' }, ROW_MS]);
    if (r.at.plan === null) throw new Error(`THE PICTURE WENT OUT at teammate ${N}'s card: ${r.at.why}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
    const own = !!r.began && r.began.field === 'weapon' && r.began.i === N, x = r.at;
    row(own && !!r.ended && x.apart.m >= APART_M && x.hurt === 0 && x.alive === N && x.men.length === N + 1, `${w}: the last teammate's card (teammate ${N}) opens, his gun's row plays from where his card stands him, and with it over no two men are within ${APART_M} m of each other`,
      `${!r.began ? 'NO ROW BEGAN' : own ? `his gun's row up ${(r.began.ms / 1000).toFixed(1)} s after the pick` : `ANOTHER ROW (${r.began.field}, member ${r.began.i})`} · ${r.ended ? `over and ${r.ended.by === 'next' ? 'the loop\'s next beat up' : 'settled'} ${(r.ended.ms / 1000).toFixed(1)} s on` : `NEVER SETTLED in ${ROW_MS / 1000} s (${x.state})`} · the two nearest: ${x.apart.a} and ${x.apart.b}, ${x.apart.m.toFixed(2)} m apart · ${x.hurt} hurt, ${x.alive} of ${N} up · ${x.men.map(m => `${m.name} ${m.out.toFixed(2)} m out`).join(', ')}`); }
  // what was thrown: beyond the anchor's line (a throw the way kept on the belt, or that never left the hand, has no resting place: said)
  { const lay = throwsSeen.filter(t => t.out !== null), wrong = lay.filter(t => !(t.out < 0)), hurt = throwsSeen.filter(t => t.hurt > 0 || t.hitsSam > 0);
    row(wrong.length === 0 && hurt.length === 0, `${w}: what was thrown came to rest beyond the anchor's line and touched nobody`, throwsSeen.length ? throwsSeen.map(t => `${t.who ? 'teammate ' + t.who : 'Sam'} ${t.f}: ${t.out === null ? `no resting place (${t.how}${t.kept ? `, '${t.kept}'` : ''})` : `${(-t.out).toFixed(2)} m beyond the line`}${t.hurt ? `, ${t.hurt} HURT` : ''}${t.hitsSam ? ', SAM IN THE BLAST' : ''}`).join(' · ') : 'no throw played on this way (each was the gun\'s row: above)'); }
  row(guns.length === (N >= 1 ? 2 : 1) && guns.every(x => x.hurt === 0), `${w}: the gun's burst hits no man`, guns.map(x => `${x.who ? 'teammate ' + x.who : 'Sam'}: ${x.shots} round(s), ${x.hurt} hurt`).join(' · '));
  // a row cut mid-way by another pick (Sam's card again: his smoke, cut by his gun's tile)
  { await page.evaluate(([msg, ms]) => window.__kvRow(msg, ms), [{ kv: 'sel', who: 0, field: 'weapon' }, ROW_MS]);
    const r = await page.evaluate(([msg, ms, to, shove]) => window.__kvRow(msg, ms, 0.6, to, shove), [{ kv: 'sel', who: 0, field: 'smoke' }, ROW_MS, { kv: 'sel', who: 0, field: 'weapon' }, BREAK]);
    row(!!r.cut && r.cuts >= 1 && !!r.ended && whole(r.at, r.ended && r.ended.by), `${w}: a row cut mid-way by another pick leaves every man home and the world whole`, `${r.cut ? `Sam's ${r.cut.field} cut ${r.cut.at.toFixed(2)} s in (${r.cut.phase}) by his gun's tile` : 'NOTHING WAS CUT'} · ${r.cuts} cut(s) · ${r.ended ? `${r.ended.by === 'next' ? 'the next beat up' : 'settled'} ${(r.ended.ms / 1000).toFixed(1)} s on` : 'NEVER SETTLED'} · ${wholeSaid(r.at, r.ended && r.ended.by)}${BREAK ? ' · (KITLEVELS_BREAK: a man shoved off his place with HOME off — this row must FAIL)' : ''}`); }
  // A WALL SPAN'S BLAST TOUCHES NOBODY: each charge that opened the wall for a row — no man of the team dazzled or staggered by it (`hits.team`: the picture puts
  // such a hit out and counts it), Sam not in it, nobody wounded
  if (a.kind === 'wall' && N >= 1) row(blown.length >= 1 && blown.every(x => x.sam === 0 && x.team === 0 && x.hurt === 0), `${w}: the charge that opens the wall span touches nobody (no teammate dazzled or staggered, Sam not in it, nobody wounded)`,
    blown.length ? blown.map(x => `opened for ${x.who ? 'teammate ' + x.who : 'Sam'}'s ${x.f}: ${x.team} hit(s) on the team, ${x.sam} on Sam, ${x.hurt} hurt, the furthest man ${x.off.toFixed(2)} m off his place as its row ended`).join(' · ') : 'THE WALL WAS NEVER OPENED by a row that needs an opening');
  // A WALL SPAN: the light (its charge opens the wall where it still stands), the gun through the hole, the light again — through the SAME hole
  if (a.kind === 'wall' && N >= 1) {
    const pick = (f, ms) => page.evaluate(([msg, ms]) => window.__kvRow(msg, ms), [{ kv: 'sel', who: 0, field: f }, ms]), wait = () => page.evaluate(ms => window.__kvRow(null, ms), ROW_MS);
    // (MARGIN: bursts through a kept hole are counted — KIT_VIEW_LOOP.holeBursts of them and the next row stages the room again, which this row would read as the
    //  wall stood under its flag. The tiles above left some on the count, and one burst of the loop's own between two picks was enough to trip it: the wall
    //  charge's own tile first — at a wall left open it stands the wall again before anything else, and a staging starts the count at none)
    await pick('walls', ROW_MS); await pick('weapon', ROW_MS); let l1 = await pick('light', ROW_MS);
    if (l1.began && l1.began.prelude && l1.ended && l1.at.hole) { const n = await wait(); l1 = { ...n, began: n.began }; }   // (the wall stood: its charge first, then the light itself — waited out too)
    const s1 = l1.at, g1 = await pick('weapon', ROW_MS), s2 = g1.at, l2 = await pick('light', ROW_MS), s3 = l2.at;
    const lit = r => !!r.began && r.began.field === 'light' && r.began.i === 0 && !r.began.prelude && !r.began.refused && !!r.ended;
    row(lit(l1) && s1.hole && s1.wallUp === false && !!g1.began && g1.began.field === 'weapon' && !!g1.ended && s2.shots > s1.shots && s2.hole && s2.wallUp === false && lit(l2) && s3.hole && s3.wallUp === false && s3.restarts === s1.restarts && whole(s3, l2.ended && l2.ended.by),
      `${w}: light, gun, light on the wall span — the gun's burst goes through the kept hole and the second light plays through that same hole (no charge again, no restage, the wall never stood under its flag)`,
      `the first light: ${lit(l1) ? 'its own row' : `NOT ITS ROW (${l1.began ? `${l1.began.field}${l1.began.prelude ? ', the charge' : ''}${l1.began.refused ? `, '${l1.began.refused}'` : ''}` : 'none began'})`}, after it the wall ${s1.wallUp ? 'STANDS' : 'open'}, hole ${s1.hole} · the gun: ${g1.began ? g1.began.field : 'NO ROW'}, ${s2.shots - s1.shots} round(s), after it the wall ${s2.wallUp ? 'STANDS' : 'open'}, hole ${s2.hole} · the second light: ${lit(l2) ? 'its own row, at once' : `NOT ITS ROW (${l2.began ? `${l2.began.field}${l2.began.prelude ? ', THE CHARGE AGAIN' : ''}${l2.began.refused ? `, '${l2.began.refused}'` : ''}` : 'none began'})`}, after it the wall ${s3.wallUp ? 'STANDS' : 'open'}, hole ${s3.hole} · restarts ${s1.restarts} → ${s3.restarts} · ${wholeSaid(s3, l2.ended && l2.ended.by)}`); }
  // A WALL SPAN, THE WALL CHARGE'S OWN TILE WITH NOBODY ABLE TO STAND CLEAR (the gate held shut by the picture's own switch): the charge is set, waited on, and
  // comes down UNBLOWN under the dissolve — the wall standing, nothing left on it — and the way REMEMBERS: the loop's next turn of that tile is the gun's row
  // with the reason, and nobody is walked out again (last of the rows: the tile stays the gun's on this page from here on)
  if (a.kind === 'wall' && N >= 1) {
    const b = await page.evaluate(() => { window.__kitview.standClear = false; return window.__kvl(); });
    const r1 = await page.evaluate(([msg, ms]) => window.__kvRow(msg, ms), [{ kv: 'sel', who: 0, field: 'walls' }, ROW_MS]), s1 = r1.at;
    const r2 = await page.evaluate(ms => window.__kvRow(null, ms), ROW_MS), s2 = r2.at;
    await page.evaluate(() => { window.__kitview.standClear = true; });
    const why = /could not stand clear of the wall charge/, m1 = (s1.last && s1.last.marks) || [];
    const down = !!r1.began && r1.began.field === 'walls' && r1.began.i === 0 && !!r1.ended && !!s1.last && s1.last.field === 'walls' && m1.includes('set') && !m1.includes('blow') && why.test(s1.refused || '') && s1.wallUp === true && !s1.hole && s1.wc === 0 && s1.restarts === b.restarts + (b.hole ? 2 : 1) && s1.hurt === 0;
    const kept = !!r2.began && r2.began.field === 'weapon' && r2.began.i === 0 && /^walls: /.test(r2.began.refused || '') && why.test(r2.began.refused || '') && !!r2.ended && r2.far <= HOME_M && s2.restarts === s1.restarts && s2.wallUp === true && s2.wc === 0 && whole(s2, r2.ended && r2.ended.by);
    row(down && kept, `${w}: the wall charge's own tile with nobody able to stand clear (the gate held shut) — the charge comes down unblown under a restage, and the refusal is remembered: the next turn of the tile is the gun's row, nobody walks out`,
      `the first turn: ${r1.began ? `${r1.began.field} by member ${r1.began.i}` : 'NO ROW'}, marks [${m1.join(', ')}], ${r1.ended ? `over ${(r1.ended.ms / 1000).toFixed(1)} s on` : 'NEVER OVER'}, refused '${s1.refused || ''}', the wall ${s1.wallUp ? 'stands' : 'OPEN'}, ${s1.wc} charge(s) or order(s) left on it, restarts ${b.restarts} → ${s1.restarts} (${b.hole ? 'the open wall stood again first, then ' : ''}the charge down under one) · the next turn: ${r2.began ? `${r2.began.field} by member ${r2.began.i}, refused '${r2.began.refused || ''}'` : 'NO ROW'}, the furthest man ${(r2.far || 0).toFixed(2)} m off his place under it, restarts ${s1.restarts} → ${s2.restarts} · ${wholeSaid(s2, r2.ended && r2.ended.by)}`); }
  const z = await page.evaluate(() => window.__kvl());
  // NO LOOSE PROP THE PLAN HIDES STILL STANDS (host/kitView.ts dropProps: in place(), and again after mend()'s reset of the props)
  row(a.props.up === 0 && mended.every(m => m.up === 0) && z.props.up === 0, `${w}: no loose prop the plan hides still stands — as the page came up, after a gun burst's mend, at the end`,
    `${a.props.hid} prop(s) hidden by the plan${a.props.hid ? '' : ' (true of nothing: this way hides no prop)'} · standing as the page came up: ${a.props.up} · ${mended.length ? mended.map(m => `after the mend that followed ${m.after}: ${m.up}`).join(' · ') : 'NO BURST WAS FOLLOWED BY ANOTHER ROW: the mend was not read'} · at the end: ${z.props.up}`);
  row(z.alarm.reports.length === 0 && z.alarm.level === 0 && !z.alarm.placed && !z.alarm.sensing && z.alarm.frames > 0, `${w}: the picture raised no alarm over the whole run — no device reported, the floor never went up (latched on every display frame, across every restage)`,
    `the level's devices ${z.alarm.sensing ? 'ARE SENSING' : 'sense nothing (host/kitView.ts kitViewInert)'} · ${z.alarm.reports.length ? 'REPORTED: ' + z.alarm.reports.slice(0, 4).join(', ') : 'no report in the devices\' log'} · the floor never over ${z.alarm.level}${z.alarm.placed ? ' · AN ALARM PLACED' : ''} · ${z.alarm.frames} frame(s) latched, ${z.restarts} restart(s)`);
  row(z.pins === 0, `${w}: the game's own men never had to be held (pins 0)`, `${z.pins} man-frames pinned · ${z.restarts} restart(s), ${z.cuts} cut(s) in all`);
  row(errors === 0, `${w}: the console said nothing`, errs.slice(0, 4).join(' | ') || 'no error');
  console.log(`  [${((Date.now() - T0) / 1000).toFixed(0)}s] ${w}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await ctx.close();
}

(async () => {
  if (!WAYS.length) { console.log(`kitview-levels: no level asked about carries a kitView block (${names.join(', ') || 'none'})`); process.exit(2); }
  console.log(`kitview-levels: ${WAYS.length} level-way(s) — ${WAYS.map(x => x.said).join(' · ')}${BREAK ? '\nKITLEVELS_BREAK=1: a man (a teammate; Sam where he is alone) is shoved off his place with HOME off as the cut row settles — that row must FAIL' : ''}`);
  const browser = await chromium.launch({ headless: true, args: SW });
  for (const L of WAYS) { try { await one(browser, L); } catch (e) { row(false, `${L.said}: the rows ran`, String(e).slice(0, 300)); } }
  await browser.close();
  console.log(`\nkitview-levels: ${rows - bad} PASS, ${bad} FAIL of ${rows} rows on ${WAYS.length} level-way(s) in ${((Date.now() - T0) / 60000).toFixed(1)} min${BREAK ? ' (under KITLEVELS_BREAK=1: a FAIL is the expected answer)' : ''}`);
  process.exit(bad ? 1 : 0);
})();
