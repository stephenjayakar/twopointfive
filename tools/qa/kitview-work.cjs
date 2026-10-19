// EVERY PICK ON TEAM & KIT SHOWS ITS KIT AT WORK (the maintainer, of the picture beside the cards: "some demos still don't really do anything (e.g. dynamic
// hammer here)" — Mousehole, the big slot's hammer picked, the squad standing in its stack). tools/qa/kitview-levels.cjs holds every tile's row to its
// TIMING and to what it leaves behind, and passes a pick that played the GUN's row instead with the reason kept. THIS tool asks the other question: of every
// pick a card offers — each tile of Sam's card and of a teammate's, each thing the big slot holds — did the picture play THAT thing, and did the thing do
// its work (the row's own mark: the door gave, the can went in, the lens is through)? A pick that played the gun's row, or its own row to no mark, is IDLE.
//
// The REAL page (`?kitview`) in headless Chromium on the software adapter, the engine's render stood in for by the world's pack, the game's clock run SCALE
// times faster: nothing here is seen on a GPU, and what a pick LOOKS like is not this tool's question (SHOTS=<dir> draws stills for an eye: below).
// Per level-way, the mission's own link (as the start page asks for the picture), every pick in turn:
//   · the card is written as the pick needs it (the big slot's tool put in it; nothing else is changed: a tile at none still plays) and the tile is picked;
//   · the FIRST row begun for that man after the pick was heard is read: the thing played, `refused`, the marks, how it ended (a blank wall is opened by a
//     charge first — the wall charge's row, marked `prelude` — and the row asked plays through the hole on the next turn: then that turn is the one read;
//     a row that ends as his gun's swap is not the turn read either: the tile's own row after it is);
//   · AT WORK = that turn played the pick's own thing and made its WORK mark (the table below). IDLE = anything else, with the page's own reason. The
//     loop's SECOND turn doing it is not a pass: the pick is what the maintainer watches.
//   · a pick IDLE on its first pick is picked twice more: idle again on either = IDLE, red. At work both times = a pass that says it MISSED ITS FIRST TURN
//     ONCE, counted in the tally (a thrown grenade that came back off the leaf, which the picture takes away: about one throw in twenty here).
// Exit 0: every pick at work, or idle on a way and for a reason the table EXCUSED names (each said). 1: a pick idle with no excuse, or a page that never
// staged. 2: no level asked about carries a block, or PICKS names no pick. KITWORK_BREAK=1: the hammer's and the shotgun's tile are read as the gun's (the page told `big` 'none'
// under the pick) — the rows must FAIL (exit 1).
//
//   node tools/qa/kitview-work.cjs   env: PORT (5199) · LEVEL (comma list; default every level with a block, the look twins left to the page) · WAY (1-based)
//       · KIND (roomclear | rescue | nightbreach | quiet | solo; default the level's own first) · SQUAD (default 4; a quiet mission its own) · SCALE (2)
//       · PICKS (comma list of pick names, e.g. `sam.big.hammer,mate.frags`; default all) · ROW_MS (a pick's patience on the wall clock, 150000) · TURNS (how many turns of the tile to wait for and print; the FIRST is the one judged; 1)
//       · SETS=1 (the squad kit sets and the member sets too: said, never judged)
//       · REPEAT=n (the picks n times over on one boot: how often a first turn holds)
//       · DEBUG_EVAL='<expression of g>' (sampled every frame of a pick's turn, printed as it changes: why a row was never offered)
//       · OUT=<file> (the table as JSON: one row per level-way and pick) · SHOTS=<dir> (a still as each new mark of the pick's row is made and as a tool comes into a hand, for an eye: the game's clock
//       all but stopped there and the REAL render run for FRAMES frames (5) — each takes the software adapter a good part of a minute)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', WARM = +(process.env.WARM || 6), SCALE = +(process.env.SCALE || 2);
const ROW_MS = +(process.env.ROW_MS || (process.env.SHOTS ? 3600000 : 150000)), FRAMES = +(process.env.FRAMES || 5), TURNS = +(process.env.TURNS || 1), BREAK = process.env.KITWORK_BREAK === '1', SHOTS = process.env.SHOTS || '', OUT = process.env.OUT || '';
const SW = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|Failed to load resource|Failed to fetch/;
const BASE = `http://localhost:${PORT}/`, T0 = Date.now(), DIR = path.join(__dirname, '../../levels'), SRC = path.join(__dirname, '../../src');
let bad = 0, rows = 0; const table = [], missed = [];
const row = (ok, what, detail) => { rows++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); if (!ok) bad++; };

// THE PICKS: a name, whose card, the tile's field, what is written on the card first (`set`), the thing the picture must play and the marks that are its work
// (a row's own word for its work, src/host/kitView.ts: the round out, the beam swept through the opening / the quiet picture's `beam`, the can venting, the door
//  giving, the lens through, the launcher at the shoulder, the turn made / the quiet picture's `lean`)
const WORK = { weapon: ['shot', 'burst', 'dark'], light: ['lit', 'beam'], smoke: ['smoke'], bangs: ['bang'], frags: ['frag'], charges: ['blow'], wand: ['through'], cams: ['stuck'], shells: ['up'], rings: ['up'], walls: ['hole', 'blow'], bigtool: ['gave'], turn: ['turn', 'lean'] };
const PICKS = [
  { name: 'sam.weapon', who: 0, field: 'weapon', thing: 'weapon' }, { name: 'sam.primary', who: 0, field: 'primary', thing: 'weapon' }, { name: 'sam.secondary', who: 0, field: 'secondary', thing: 'weapon' },
  { name: 'sam.suppressed', who: 0, field: 'suppressed', thing: 'weapon' }, { name: 'sam.sideCan', who: 0, field: 'sideCan', thing: 'weapon' }, { name: 'sam.light', who: 0, field: 'light', thing: 'light', set: { light: true } }, { name: 'sam.nvg', who: 0, field: 'nvg', thing: 'turn' },   // (the tree card's rows of yours — game/kittree.ts)
  { name: 'sam.smoke', who: 0, field: 'smoke', thing: 'smoke' }, { name: 'sam.bangs', who: 0, field: 'bangs', thing: 'bangs' },
  { name: 'sam.frags', who: 0, field: 'frags', thing: 'frags' }, { name: 'sam.shells', who: 0, field: 'shells', thing: 'shells' }, { name: 'sam.rings', who: 0, field: 'rings', thing: 'rings' }, { name: 'sam.charges', who: 0, field: 'charges', thing: 'charges' },
  { name: 'sam.cams', who: 0, field: 'cams', thing: 'cams' }, { name: 'sam.wand', who: 0, field: 'wand', thing: 'wand', set: { wand: true } },
  { name: 'sam.suit', who: 0, field: 'suit', thing: 'turn' }, { name: 'sam.trim', who: 0, field: 'trim', thing: 'turn' },
  { name: 'sam.big.shotgun', who: 0, field: 'big', thing: 'bigtool', set: { big: 'shotgun', walls: 0 } }, { name: 'sam.big.hammer', who: 0, field: 'big', thing: 'bigtool', set: { big: 'hammer', walls: 0 } },
  { name: 'sam.big.wall', who: 0, field: 'big', thing: 'walls', set: { big: 'none', walls: 1 } },
  { name: 'mate.weapon', who: 1, field: 'weapon', thing: 'weapon' }, { name: 'mate.primary', who: 1, field: 'primary', thing: 'weapon' }, { name: 'mate.secondary', who: 1, field: 'secondary', thing: 'weapon' }, { name: 'mate.suppressed', who: 1, field: 'suppressed', thing: 'weapon' }, { name: 'mate.sideCan', who: 1, field: 'sideCan', thing: 'weapon' }, { name: 'mate.light', who: 1, field: 'light', thing: 'light', set: { light: true } },
  { name: 'mate.nvg', who: 1, field: 'nvg', thing: 'turn' }, { name: 'mate.bangs', who: 1, field: 'bangs', thing: 'bangs' }, { name: 'mate.smoke', who: 1, field: 'smoke', thing: 'smoke' },
  { name: 'mate.charges', who: 1, field: 'charges', thing: 'charges' }, { name: 'mate.frags', who: 1, field: 'frags', thing: 'frags' }, { name: 'mate.wand', who: 1, field: 'wand', thing: 'wand', set: { wand: true } },
  { name: 'mate.suit', who: 1, field: 'suit', thing: 'turn' }, { name: 'mate.trim', who: 1, field: 'trim', thing: 'turn' },
  { name: 'mate.big.shotgun', who: 1, field: 'big', thing: 'bigtool', set: { big: 'shotgun', walls: 0 } }, { name: 'mate.big.hammer', who: 1, field: 'big', thing: 'bigtool', set: { big: 'hammer', walls: 0 } },
  { name: 'mate.big.wall', who: 1, field: 'big', thing: 'walls', set: { big: 'none', walls: 1 } },
];
// THE SETS (SETS=1, or named in PICKS): a squad kit set (slots.json `loadouts`) and a member's set (as issued / quiet / loud: here on Sam's card, the open one) are a whole card written at once,
// with no tile of their own. Each is put on through the page's own kit table (`__kit.loadout` / `__kit.preset`), told to the picture as the menu tells it,
// and what the picture then plays is SAID — never judged: the page has no row for a set, and what it shows is the open card's change, or the room staged again.
const SETS = [...['wall', 'stun', 'frag', 'quiet'].map(id => ({ name: `set.squad.${id}`, loadout: id })), ...['issued', 'quiet', 'loud'].map(id => ({ name: `set.member.${id}`, preset: id }))];
// EXCUSED: a pick that cannot show its kit on some way, and why — said as a pass where it is idle THERE and for no other reason; anywhere else it fails
const EXCUSED = [
  ...['sam.big.shotgun', 'sam.big.hammer', 'mate.big.shotgun', 'mate.big.hammer'].map(pick => ({ pick, when: (a, L) => L.name === 'hall', why: "the long hall issues its own kit (its level's issue block, kit.ts kitIssue): a card's big slot never reaches the men there — Player.bigKit stays 'none', no 'bigClear' order — so the door offers no tool and the gun's row plays" })),
  ...['sam.big.wall', 'mate.big.wall'].map(pick => ({ pick, when: (a, L) => L.name === 'pass', why: "the pass's gate set: no floor behind the wall beside the wicket for a wall charge (the game's own refusal), and the gun's row plays" })),
  { pick: 'sam.frags', when: (a, L) => L.name === 'pass', why: "the pass's wicket opens on the open yard: wherever the frag lies its burst has a line to the player, and the picture takes it away (kitView.ts reachesSam) — thrown, never burst" },
  ...['sam.big.wall', 'mate.big.wall'].map(pick => ({ pick, when: (a, L) => L.name === 'records' && L.k === 1, why: "the records' west door: too short a stretch of wall beside it for a wall charge (the game's own refusal), and the gun's row plays" })),
  { pick: 'mate.frags', when: (a, L) => L.kind === 'rescue', why: "a rescue: the squad's frag on order is refused with hostages on the floor (the game's own rule), and the gun's row plays" },
  { pick: 'sam.cams', when: a => a.reachIn >= 12, why: "the way in opens on a yard: no wall inside within the sticky camera's reach (kitView.ts camReach, 12 m of open floor behind the leaf or more) to stick it to" },
  { pick: 'sam.big.wall', when: a => a.men === 1, why: "Sam alone: the picture's wall charge is the squad's order (one man sets it, the rest stand off) and there is no squad to take it; his own hands' row at a wall is refused while the picture walks him" },
];
const askedPicks = (process.env.PICKS || '').split(',').map(s => s.trim()).filter(Boolean);
{ const known = [...PICKS, ...SETS].map(p => p.name), not = askedPicks.filter(n => !known.includes(n)); if (not.length) { console.log(`kitview-work: no such pick — ${not.join(', ')} (the picks: ${known.join(', ')})`); process.exit(2); } }

const asked = (process.env.LEVEL || '').split(',').map(s => s.trim().replace(/\.json$/, '')).filter(Boolean);
const names = asked.length ? asked : [...fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.endsWith('-gwot.json') && !f.includes('.lint.') && f !== 'office.json').map(f => f.slice(0, -5)), 'office'].sort();
const officeScenarios = () => { try { return JSON.parse(require('child_process').execFileSync('bun', ['-e', `import { OFFICE_SCENARIOS as S } from ${JSON.stringify(path.join(DIR, 'office.scenarios.ts'))}; console.log(JSON.stringify(S));`], { encoding: 'utf8' })); } catch (e) { console.log(`(the office's scenarios could not be read through bun: ${String(e).slice(0, 160)})`); return {}; } };
/** the mission's own link, as tools/qa/kitview-levels.cjs builds it (scene/scenarios.ts scenarioQuery, game/loadout.ts squadSearch — through bun) */
const missionQuery = (name, kind, n) => { if (kind === 'solo') return name === 'office' ? 'solo' : `solo&levelFile=${name}.json`;
  const code = `import { ALL_MISSIONS } from ${JSON.stringify(path.join(SRC, 'scene/scenarioList.ts'))}; import { scenarioQuery } from ${JSON.stringify(path.join(SRC, 'scene/scenarios.ts'))}; import { squadSearch } from ${JSON.stringify(path.join(SRC, 'game/loadout.ts'))};
    const file = ${JSON.stringify(name === 'office' ? null : name + '.json')} ?? undefined, kind = ${JSON.stringify(kind)}, e = ALL_MISSIONS.find(x => x.kind === kind && x.level === file) ?? { id: '', title: '', kind, squad: kind === 'quiet' ? 0 : 2, ...(file ? { level: file } : {}) };
    console.log(squadSearch(scenarioQuery(e), ${+n}, e.squad).replace(/^\\?/, ''));`;
  try { const q = require('child_process').execFileSync('bun', ['-e', code], { encoding: 'utf8' }).trim(); if (!q) throw new Error('an empty link'); return q; }
  catch (e) { console.log(`kitview-work: the mission's own link for ${name} (${kind}, ${n}) could not be built through bun: ${String(e).slice(0, 300)}`); process.exit(1); } };
const WAYS = [];
for (const name of names) { let S;
  if (name === 'office') S = officeScenarios(); else { try { S = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')).scenarios || {}; } catch { continue; } }
  const K = S.kitView; if (!K || !Array.isArray(K.ways)) continue;
  const kind = process.env.KIND || (S.roomClear ? 'roomclear' : S.rescue ? 'rescue' : S.nightBreach ? 'nightbreach' : S.quiet ? 'quiet' : 'solo');
  const squad = process.env.SQUAD !== undefined ? Math.max(0, Math.min(kind === 'quiet' ? 1 : 4, +process.env.SQUAD || 0)) : kind === 'quiet' || kind === 'solo' ? 0 : 4;
  let own_ = null; const OWN = () => own_ ?? (own_ = missionQuery(name, kind, squad));
  K.ways.forEach((y, k) => { if (process.env.WAY && +process.env.WAY !== k + 1) return;
    WAYS.push({ name, k, kind, squad, own: OWN, said: `${name} way ${k + 1} (${y.door || 'span'}${y.set ? ', set ' + y.set : ''}; ${kind}, ${squad ? 'Sam and ' + squad : 'Sam alone'})` }); }); }

async function one(browser, L) {
  const t0 = Date.now(), ctx = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([scale, still]) => {
    // (the engine's render stood in for by the world's pack. SHOTS: the real one is kept, and run only while a still is HELD — the game's clock all but stopped at a mark, `frames` frames drawn for the picture to settle)
    window.__kwReal = { on: false, n: 0 };
    { let e; Object.defineProperty(window, '__engine', { configurable: true, get: () => e, set: v => { e = v; if (!v) return; const real = v.render.bind(v); v.render = (...a) => { if (still && window.__kwReal.on) { window.__kwReal.n++; return real(...a); } v.world.upload(); }; } }); }
    const tick = () => { requestAnimationFrame(tick); const k = window.__kitview; const want = window.__kwReal.on ? 1e-4 : scale; if (k && typeof k.rest === 'function' && k.state !== 'none' && window.__timeScale !== want) window.__timeScale = want; };
    requestAnimationFrame(tick);
    /** the way as the page staged it */
    window.__kwWay = () => { const k = window.__kitview, g = window.__game, P = k.plan; if (!P) return null; const A = P.anchor, d = A.door ? g.doors.byName(A.door) : null;
      return { kind: A.kind, door: A.door || null, set: P.set || null, steel: !!(d && d.def.steel), locked: !!(d && d.locked), width: A.width, reachIn: P.reachIn, problems: (P.problems || []).slice(), men: k.men.length, quiet: k.quiet ? k.quiet.kind : null, cards: JSON.parse(JSON.stringify(window.__kit.KIT.members)) }; };
    /** the card written (`members` given: a kit message) and the tile picked; then every display frame, each row begun after the pick was heard for that man is
     *  read as it begins and as it ends, until `turns` of them have ended on their own (a cut by the pick itself is no turn) or `ms` is out */
    window.__kwPick = (members, who, field, turns, ms) => new Promise(res => { const k = window.__kitview, g = window.__game, w0 = performance.now();
      let heardAt = -1, cur = null; const seen = [];
      const N = window.__kwN = (window.__kwN || 0) + 1, told = { kv: 'sel', who, field, kwn: N };
      const heard = e => { const m = e.data; if (e.source !== window || !m || m.kwn !== N) return; window.removeEventListener('message', heard); heardAt = Math.max(k.beat ? k.beat.n : 0, k.last ? k.last.n : 0); };
      window.addEventListener('message', heard);
      if (members) window.postMessage({ kv: 'kit', members }, location.origin);
      window.postMessage(told, location.origin);
      /** what the tool in hand is, this frame: the big slot's tool out of a teammate's back (Guard.bigOut), Sam's own beat on the door (Player.kick's tool) */
      const dbg = window.__kwDbg ? new Function('g', 'window', 'return (' + window.__kwDbg + ')') : null;   // (DEBUG_EVAL: an expression of the game, sampled every frame of the turn and printed as it changes)
      const inHand = () => { try { const T = g.guards.filter(x => x.team === 'operative'), m = who > 0 ? T[who - 1] : null; if (m) return m.bigOut && m.bigOut.end < 0 ? 'out' : ''; const kk = g.player.kick; return kk && kk.tool ? String(kk.tool.kind || 'tool') : kk ? 'kick' : ''; } catch { return ''; } };
      const f = () => { const el = performance.now() - w0;
        if (heardAt >= 0) {
          const b = k.beat;
          if (b && b.n > heardAt && (!cur || cur.n !== b.n)) { cur = { n: b.n, i: b.i, field: b.field, refused: k.refused, prelude: b.marks.includes('prelude'), hand: '', phases: [b.phase], t: 0, marks: [], how: null, atMs: el, trace: [], dbg: [] }; seen.push(cur); }
          if (cur && b && b.n === cur.n) { const h = inHand(); cur.field = b.field; cur.marks = b.marks.slice();   // (a gun's swap is the tile's own row from its far point on: the field is read as it stands)
            { const at = `${b.marks.join('-')}${h ? '+' + h : ''}`; if (at && at !== cur.at) { cur.at = at; window.__kwAt = { k: `${N}.${b.n}.${at}`, at }; if (still && window.__kwShoot) { window.__kwReal.n = 0; window.__kwReal.on = true; window.__timeScale = 1e-4; } } }   // (held here until the still is taken: only under a pick whose stills are being read)
            if (h && !cur.hand.includes(h)) cur.hand += (cur.hand ? '+' : '') + h;
            if (dbg) try { const v = String(dbg(g, window)); if (cur.dbg[cur.dbg.length - 1] !== v && cur.dbg.length < 40) cur.dbg.push(v); } catch (e) { if (!cur.dbg.length) cur.dbg.push('threw: ' + e.message); }
            try { const o = g.doorTools.ops[0], tr = o ? `${o.phase}@${o.door.off ? 'off' : o.door.angle.toFixed(1)}` : 'no op'; if (cur.trace[cur.trace.length - 1] !== tr && cur.trace.length < 24) cur.trace.push(tr); } catch { }   // (the door order's own stage and the leaf's angle, as they change: said of an IDLE turn)
            if (cur.phases[cur.phases.length - 1] !== b.phase) cur.phases.push(b.phase); cur.t = b.t; if (!cur.refused && k.refused) cur.refused = k.refused; }
          for (const s of seen) if (s.how === null && k.last && k.last.n === s.n) { s.how = k.last.how; s.field = k.last.field; s.marks = (k.last.marks || []).slice(); s.t = k.last.t; s.phase = k.last.phase; if (!s.refused && k.refused) s.refused = k.refused; }
          const done = seen.filter(s => s.how !== null && s.how !== 'cut' && s.i === who && !s.prelude && s.field !== 'swap');
          if (done.length >= turns) { res({ seen, ms: el, state: k.state }); return; } }
        if (el > ms) { res({ seen, ms: el, state: k.state, timeout: true }); return; }
        requestAnimationFrame(f); };
      requestAnimationFrame(f); });
  }, [SCALE, !!SHOTS]);   // (`still` is read inside __kwPick too: the init script's own argument)
  const page = await ctx.newPage(); page.setDefaultTimeout(0);
  let errors = 0; const errs = [];
  page.on('pageerror', e => { errors++; errs.push(String(e).slice(0, 200)); });
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) { errors++; errs.push(m.text().slice(0, 200)); } });
  const w = L.said, own = L.own(), url = `${BASE}?${own}&way=${L.k + 1}&kitview=${WARM}&mute&noreplay&quality=${QUALITY}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let ready = true;
  for (let i = 0; ; i++) {
    try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 600000 }); await page.evaluate(() => window.__ready); break; }
    catch (e) { if (i >= 3 || !/navigation|destroyed/i.test(String(e))) { ready = false; break; } await page.waitForLoadState('domcontentloaded').catch(() => {}); }
  }
  const up = ready && await page.waitForFunction(() => { const s = window.__kitview && window.__kitview.state; return s === 'none' || s === 'rest' || s === 'beat' || s === 'swap'; }, null, { timeout: 300000 }).then(() => true, () => false);
  const a = up ? await page.evaluate(() => window.__kwWay()) : null;
  row(!!a, `${w}: the page boots to the loop on a plan`, a ? `the anchor a ${a.kind}${a.door ? ` '${a.door}'${a.steel ? ', steel' : ''}${a.locked ? ', locked' : ''}` : ''}${a.set ? `, on the set '${a.set}'` : ', the level\'s own'} · ${a.men} men${a.quiet ? ` · the quiet picture (${a.quiet})` : ''} · ${a.reachIn.toFixed(2)} m of floor behind · '?${own}&way=${L.k + 1}' · ${((Date.now() - t0) / 1000).toFixed(0)} s` : `never staged (asked as '?${own}&way=${L.k + 1}')${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
  if (!a) { await ctx.close(); return; }
  const once = PICKS.filter(p => (!askedPicks.length || askedPicks.includes(p.name)) && p.who < a.men), picks = Array.from({ length: Math.max(1, +(process.env.REPEAT || 1)) }, () => once).flat();   // (REPEAT=n: the list n times over on one boot — how often a pick's first turn holds)
  let moved = false;
  // (A FIRST TURN MISSED is asked twice more before it is called: a pick idle on its first pick and on either of the next two is IDLE and red — the gun's row
  //  played for a tool the way cannot take is idle every time; one that held both times after is a pass that SAYS it missed once, and is counted in the tally:
  //  a grenade that came back off the leaf, which the picture takes away before it bursts in the yard)
  const queue = picks.map(p => ({ p, n: 0, st: { why: '', said: '', idle: 0 } }));
  for (let qi = 0; qi < queue.length; qi++) { const { p, n: tryN, st } = queue[qi];
    const cards = JSON.parse(JSON.stringify(a.cards)); if (p.set) Object.assign(cards[p.who], BREAK && p.thing === 'bigtool' ? { big: 'none' } : p.set);
    // (the tile left first — the gun's, or for the gun's own the next card's none — so the pick is always a MOVE of the highlight: the page plays a pick, not a tile it already holds)
    await page.evaluate(([who, f]) => window.__kwPick(null, who, f, 0, 400), [p.who, p.thing === 'weapon' ? 'trim' : 'weapon']);
    const tell = p.set ? cards : moved ? JSON.parse(JSON.stringify(a.cards)) : null; moved = !!p.set;   // (a card the last pick wrote is put back as the way began before a pick that writes none)
    if (process.env.DEBUG_EVAL) await page.evaluate(x => { window.__kwDbg = x; }, process.env.DEBUG_EVAL);
    if (SHOTS) await page.evaluate(() => { window.__kwShoot = true; });
    let pending = true; const asking = page.evaluate(([m, who, f, n, ms]) => window.__kwPick(m, who, f, n, ms), [tell, p.who, p.field, TURNS, ROW_MS]).finally(() => { pending = false; });
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); let was = await page.evaluate(() => (window.__kwAt || {}).k || '');   // (a still as each mark is made: the blow, the door giving, the can going in)
      while (pending) { const at = await page.evaluate(() => window.__kwAt || null).catch(() => null); if (at && at.k !== was) { was = at.k; await page.waitForFunction(n => window.__kwReal.n >= n, FRAMES, { timeout: 900000 }).catch(() => {});
          await page.screenshot({ path: path.join(SHOTS, `${L.name}-w${L.k + 1}-${p.name}-${at.at.replace(/[^a-z+-]/g, '')}.png`) }).catch(() => {}); await page.evaluate(() => { window.__kwReal.on = false; }); } else await new Promise(r => setTimeout(r, 60)); } }
    const r = await asking; if (SHOTS) await page.evaluate(() => { window.__kwShoot = false; window.__kwReal.on = false; });
    const mine = r.seen.filter(s => s.i === p.who && s.how !== 'cut' && !s.prelude && s.field !== 'swap').slice(0, 1), want = WORK[p.thing] || [];
    const hit = mine.find(s => s.field === p.thing && !(s.refused || '').startsWith(p.thing + ':') && s.marks.some(m => want.includes(m))) || null;
    const first = mine[0] || r.seen[0] || null, why = hit ? '' : (first && first.refused) || (mine.find(s => s.refused) || {}).refused || (first ? `played '${first.field}' to [${first.marks.join(', ')}] (${first.how})` : 'no row began');
    const said = r.seen.map(s => `#${s.n} ${s.i ? 'teammate ' + s.i : 'Sam'} '${s.field}'${s.prelude ? ' (the wall charge first)' : ''} ${s.phases.join('>')} → [${s.marks.join(', ')}] ${s.how ?? 'still up'} ${s.t.toFixed(1)} s${s.hand ? ` · in hand: ${s.hand}` : ''}${s.refused ? ` · refused '${s.refused}'` : ''}${!hit && s.trace && s.trace.length > 1 ? ` · the door order: ${s.trace.join(' > ')}` : ''}${s.dbg && s.dbg.length ? `\n        asked: ${s.dbg.join(' > ')}` : ''}`).join('\n      ');
    table.push({ level: L.name, way: L.k + 1, kind: L.kind, anchor: a.kind, door: a.door, steel: a.steel, set: a.set, quiet: a.quiet, pick: p.name, thing: p.thing, work: !!hit, why, hand: hit ? hit.hand : '', turns: r.seen });
    const ex = hit ? null : EXCUSED.find(x => x.pick === p.name && x.when(a, L)) || null; table[table.length - 1].excused = ex ? ex.why : '';
    table[table.length - 1].attempt = tryN + 1;
    if (!hit && !ex && tryN === 0) { st.why = why; st.said = said; queue.splice(qi + 1, 0, { p, n: 1, st }, { p, n: 2, st }); continue; }
    if (tryN > 0) { if (!hit) st.idle++; if (tryN === 1) continue;
      if (!st.idle) missed.push(`${w}: ${p.name} (${st.why})`);
      row(!st.idle, `${w}: ${p.name} — ${st.idle ? `IDLE (on its first pick and on ${st.idle} of the two after)` : `at work on the two picks after, and MISSED ITS FIRST TURN ONCE`}`, `the first pick — why: ${st.why}\n      ${st.said || 'nothing began'}\n      the last pick — ${hit ? '' : `why: ${why} · `}${said || 'nothing began'}`); continue; }
    row(!!hit || !!ex, `${w}: ${p.name} — ${hit ? `at work ('${hit.field}': ${hit.marks.join(', ') || hit.phases.join('>')})` : ex ? `idle, EXCUSED: ${ex.why}` : 'IDLE'}`, `${hit ? '' : `why: ${why}\n      `}${said || 'nothing began'}${r.timeout ? ` · PATIENCE OUT at ${(r.ms / 1000).toFixed(0)} s` : ''}`);
  }
  for (const p of SETS.filter(x => askedPicks.length ? askedPicks.includes(x.name) : process.env.SETS === '1')) {
    const got = await page.evaluate(([lo, pre]) => { const K = window.__kit, why = lo ? K.loadout(lo) : JSON.stringify(K.preset(pre, 0)); return { why, cards: JSON.parse(JSON.stringify(K.KIT.members)) }; }, [p.loadout || null, p.preset || null]);
    const diff = a.cards.map((c, i) => Object.keys(got.cards[i] || {}).filter(f => JSON.stringify(c[f]) !== JSON.stringify(got.cards[i][f])).map(f => `${f} ${JSON.stringify(got.cards[i][f])}`)).map((d, i) => d.length ? `${i ? 'teammate ' + i : 'Sam'}: ${d.join(', ')}` : '').filter(Boolean).join(' · ');
    const r = await page.evaluate(([m, n, ms]) => window.__kwPick(m, 0, null, n, ms), [got.cards, TURNS, ROW_MS]);
    const said = r.seen.map(s => `#${s.n} ${s.i ? 'teammate ' + s.i : 'Sam'} '${s.field}' ${s.phases.join('>')} → [${s.marks.join(', ')}] ${s.how ?? 'still up'}`).join(' · ');
    table.push({ level: L.name, way: L.k + 1, kind: L.kind, anchor: a.kind, door: a.door, steel: a.steel, set: a.set, quiet: a.quiet, pick: p.name, thing: 'set', work: null, why: String(got.why), diff, turns: r.seen });
    row(true, `${w}: ${p.name} — said, not judged (the table's word: ${String(got.why).slice(0, 80)})`, `the cards it moved — ${diff || 'none'}\n      the picture then: ${said || 'nothing began'}`);
    await page.evaluate(m => { window.__kit.reset(); return window.__kwPick(m, 0, null, 0, 1500); }, a.cards);   // (the cards as the way began, for the next set)
  }
  row(errors === 0, `${w}: the console said nothing`, errs.slice(0, 4).join(' | ') || 'no error');
  await ctx.close();
}

(async () => {
  if (!WAYS.length) { console.log('kitview-work: no level asked about carries a block'); process.exit(2); }
  const browser = await chromium.launch({ headless: true, args: SW });
  for (const L of WAYS) { try { await one(browser, L); } catch (e) { row(false, `${L.said}: the run`, String(e).slice(0, 300)); } if (OUT) fs.writeFileSync(OUT, JSON.stringify(table, null, 1)); }
  await browser.close();
  if (missed.length) console.log(`\n${missed.length} pick(s) MISSED A FIRST TURN ONCE and held on the two picks after (said, not failed):\n  ${missed.join('\n  ')}`);
  console.log(`\nkitview-work: ${rows - bad} PASS, ${bad} FAIL · ${table.filter(t => t.work && t.attempt === 1).length + missed.length} of ${table.filter(t => t.work !== null && t.attempt === 1).length} picks at work${missed.length ? ` (${missed.length} of them after a first turn missed once)` : ''} · ${((Date.now() - T0) / 1000).toFixed(0)} s`);
  process.exit(bad ? 1 : 0);
})();
