// THE LISTENING PAGE, driven for real: /sounds in headless Chromium. Every row is played (and every 'also' use, every place, the loops, the score) and the page must
// make a voice for each with no error on the console. The browser's output is muted: the check is that the page works, not what it sounds like.
//   node tools/qa/sounds-page.cjs [shot.png]      env: PORT (the dev server's, default 5199)      exit 0 = every check passed, 1 = a FAIL, 2 = the script died
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199;
let fails = 0;
const check = (ok, what, got) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${ok || got === undefined ? '' : `   (got ${JSON.stringify(got)})`}`); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', x => errs.push(String(x && x.stack || x).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${PORT}/sounds`);
  await page.waitForFunction(() => !!window.__sounds);
  const names = await page.evaluate(() => window.__sounds.rows());
  const drawn = await page.evaluate(() => [...document.querySelectorAll('.row canvas')].filter(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }).length);
  check(names.length >= 60 && new Set(names).size === names.length, `a row for every sound in the table (${names.length})`, names.length);
  check(drawn === names.length, 'every row has its waveform drawn', drawn);
  await page.click('.row .play');   // a real click: the context starts on it
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ state: window.__sounds.state, rate: window.__sounds.rate, played: window.__sounds.played }));
  check(st.state === 'running' && st.played === 1, 'the first click starts the audio and plays one voice', st);
  const res = await page.evaluate(async () => { const S = window.__sounds; const miss = []; const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < S.rows().length; i++) { const p0 = S.played; S.play(i); await wait(15); if (S.played <= p0) miss.push(S.rows()[i]); }
    S.stop(); return miss; });
  check(res.length === 0, 'every row plays a voice', res);
  const also = await page.evaluate(async () => { const S = window.__sounds; const wait = ms => new Promise(r => setTimeout(r, ms)); let n = 0, miss = 0;
    const btns = [...document.querySelectorAll('.also button:not(.wasb)')]; for (const b of btns) { const p0 = S.played; b.click(); await wait(15); n++; if (S.played <= p0) miss++; S.stop(); }
    return { n, miss }; });
  check(also.n > 20 && also.miss === 0, `every other use plays (${also.n})`, also);
  // the before and after: a redone row carries a 'before' button that plays the old buffer (and an 'after' beside it); B is that for the selected row and nothing on a row that was kept
  const was = await page.evaluate(async () => { const S = window.__sounds; const wait = ms => new Promise(r => setTimeout(r, ms)); for (let k = 0; k < 200 && !S.wasReady; k++) await wait(50);
    const redone = S.redone(), rows = S.rows(); let miss = 0; const btns = [...document.querySelectorAll('.also .wasb')];
    for (const b of btns) { const p0 = S.played; b.click(); await wait(15); if (S.played <= p0) miss++; S.stop(); }
    const key = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    const ir = rows.indexOf(redone[0]), ik = rows.findIndex((n, i) => !redone.includes(n) && !S.takes(i));
    S.play(ir); await wait(15); S.stop(); let p0 = S.played; key(); await wait(15); const onRedone = S.played - p0; S.stop();
    S.play(ik); await wait(15); S.stop(); p0 = S.played; key(); await wait(15); const onKept = S.played - p0; S.stop();
    return { ready: S.wasReady, redone: redone.length, buttons: btns.length, miss, onRedone, onKept, kept: rows.length - redone.length }; });
  check(was.ready && was.redone >= 40 && was.buttons === was.redone && was.miss === 0, `every redone sound has a 'before' that plays (${was.redone} redone, ${was.kept} kept)`, was);
  check(was.onRedone >= 1 && was.onKept === 0, 'B plays the selected row as it was, and nothing on a row that was kept', was);
  const places = await page.evaluate(async () => { const S = window.__sounds; const wait = ms => new Promise(r => setTimeout(r, ms)); const out = [];
    for (const b of document.querySelectorAll('#places button')) { b.click(); const p0 = S.played; S.play(3); await wait(15); out.push([b.textContent, S.played - p0]); S.stop(); } document.querySelector('#places button').click(); return out; });
  check(places.length === 6 && places.every(p => p[1] === 1), 'every place plays', places);
  // the vote: a redone row takes 'better before' / 'better after' (a click, or ← → on the selected row; the lit one again takes it back), a kept row has no vote; any row takes a note
  const vote = await page.evaluate(async () => { const S = window.__sounds, wait = ms => new Promise(r => setTimeout(r, ms)), redone = S.redone(), rows = S.rows();
    const ir = rows.indexOf(redone[0]), ik = rows.findIndex((n, i) => !redone.includes(n) && !S.takes(i)), row = i => document.querySelectorAll('.row')[i];
    const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })), lit = i => [...row(i).querySelectorAll('.vote button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.pick).join();
    const p0 = S.played; row(ir).querySelector('.vote button[data-pick="before"]').click(); const click = S.mark(ir)?.pick, litClick = lit(ir), silent = S.played === p0;
    S.play(ir); await wait(15); S.stop(); key('ArrowRight'); const right = S.mark(ir)?.pick, litRight = lit(ir); key('ArrowRight'); const again = S.mark(ir)?.pick ?? null; key('ArrowLeft'); const left = S.mark(ir)?.pick;
    S.vote(ik, 'before'); S.play(ik); await wait(15); S.stop(); key('ArrowLeft');
    return { ir, ik, click, litClick, silent, right, litRight, again, left, votes: document.querySelectorAll('.row .vote').length, redone: rows.filter((_, i) => S.picks(i).length).length, keptVote: S.mark(ik), keptHasVote: !!row(ik).querySelector('.vote'), notes: document.querySelectorAll('.row .note').length, rows: rows.length, status: document.getElementById('marks').textContent }; });
  check(vote.click === 'before' && vote.litClick === 'before' && vote.silent && vote.right === 'after' && vote.litRight === 'after' && vote.again === null && vote.left === 'before', 'a redone row takes a vote by click and by ← →, the lit one again takes it back', vote);
  check(vote.votes === vote.redone && !vote.keptHasVote && vote.keptVote === null && vote.notes === vote.rows && /^1 of \d+ voted$/.test(vote.status), 'every redone row has the vote, a kept row has none, every row has a note', vote);
  await page.fill(`#note-${names[vote.ir]}`, 'the old one had more body'); await page.fill(`#note-${names[vote.ik]}`, 'fine as it is'); await page.keyboard.press('Enter');   // (Enter leaves the note: the keys are the rows' again)
  const voted = await page.evaluate(() => window.__sounds.marks());
  check(voted === `better before: ${names[vote.ir]} (the old one had more body)\nnotes: ${names[vote.ik]} (fine as it is)`, 'the vote and the notes read back as text', voted);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('t'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('KeyT');
  await page.fill('.row.toy .note', 'thin');
  const marks = await page.evaluate(() => window.__sounds.marks());
  check(/^better before: \w+ \(the old one had more body\)\ntoys: \w+ \(thin\), \w+\nnotes: \w+ \(fine as it is\)$/.test(marks), 'T marks a row, the note rides with it', marks);
  await page.click('#copy'); const out = await page.inputValue('#out'); check(out === marks, 'copy shows the marks as text', out);
  const pe0 = await page.evaluate(() => window.__sounds.errors.slice());
  await page.reload(); await page.waitForFunction(() => !!window.__sounds);
  check(await page.evaluate(() => window.__sounds.marks()) === marks, 'the marks are still there after a reload');
  const kept = await page.evaluate(async (ir) => { const S = window.__sounds; for (let k = 0; k < 200 && !S.wasReady; k++) await new Promise(r => setTimeout(r, 50));
    const r = document.querySelectorAll('.row')[ir]; return { lit: r.querySelector('.vote button[aria-pressed="true"]')?.dataset.pick, note: r.querySelector('.note').value, voted: r.classList.contains('voted') }; }, vote.ir);
  check(kept.lit === 'before' && kept.voted && kept.note === 'the old one had more body', 'after a reload the row shows its vote and its note', kept);
  // the new takes: each of the fourteen sounds marked a toy carries 'new 1' (and more) beside before and after; each plays, and each can be voted for
  const TOYS = ['rifleSuppressed', 'magOut', 'magIn', 'rack', 'footHard', 'doorBang', 'doorLatch', 'doorRattle', 'stairDoor', 'chokeLimp', 'lightBreak', 'wallDebris', 'murmur', 'heldProtest'];
  // (10-13) the four he flagged have one take each; his three picks are the game's voices now and their buttons are gone — and so, since 10-24, are the
  // grab's catch 'new 1' and strip 'new 2'
  const WITH = [...TOYS, 'propScrape', 'propThud', 'lockBreak', 'magDrop', 'grabCatch', 'gunStrip', 'gunDown'], PICKED = [['footHard', 'new 1'], ['magIn', 'new 2'], ['rack', 'new 2'], ['grabCatch', 'new 1'], ['gunStrip', 'new 2']];
  const takes = await page.evaluate(async ({ TOYS, WITH, PICKED }) => { const S = window.__sounds, wait = ms => new Promise(r => setTimeout(r, ms)), rows = S.rows(), row = i => document.querySelectorAll('.row')[i];
    const none = [], dumb = []; let buttons = 0; const e0 = S.errors.length;
    for (const n of WITH) { const i = rows.indexOf(n), bs = i < 0 ? [] : [...row(i).querySelectorAll('.also .altb')]; if (!bs.length || bs.length !== S.takes(i)) none.push(n);
      for (const b of bs) { const p0 = S.played; b.click(); await wait(15); buttons++; if (S.played <= p0) dumb.push(n + ' ' + b.textContent); S.stop(); } }
    const gone = PICKED.filter(([n, t]) => { const r = row(rows.indexOf(n)); return ![...r.querySelectorAll('.altb')].some(b => b.textContent === t) && !r.querySelector(`.vote button[data-pick="${t}"]`); }).length;
    const others = rows.filter((n, i) => !WITH.includes(n) && (S.takes(i) || row(i).querySelector('.altb'))).length;
    const i = rows.indexOf(TOYS[1]), j = rows.indexOf('wallDebris'), k = rows.findIndex((n, x) => !S.takes(x)), k0 = S.mark(k)?.pick ?? null, n0 = parseInt(document.getElementById('marks').textContent) || 0;
    row(i).querySelector('.vote button[data-pick="new 1"]').click(); const click = S.mark(i)?.pick, lit = row(i).querySelector('.vote button[aria-pressed="true"]')?.dataset.pick;
    S.vote(j, 'new 2'); S.vote(k, 'new 1'); const text = S.marks(), kept = (S.mark(k)?.pick ?? null) === k0, status = parseInt(document.getElementById('marks').textContent) - n0;
    S.vote(i, 'new 1'); S.vote(j, 'new 2');
    return { none, dumb, buttons, others, gone, click, lit, text, kept, status, errors: S.errors.slice(e0), keptPicks: S.picks(j) }; }, { TOYS, WITH, PICKED });
  check(!takes.none.length && !takes.dumb.length && takes.buttons >= 18 && !takes.others && takes.gone === PICKED.length && !takes.errors.length, `each of the fourteen toys, the four flagged and the grab's three beats has a new take that plays, his five picks are offered no more (${takes.buttons} buttons)`, takes);
  check(takes.click === 'new 1' && takes.lit === 'new 1' && takes.text.includes('better new 1: magOut') && takes.text.includes('better new 2: wallDebris') && takes.kept && takes.status === 2, 'a new take takes the vote and comes out in the marks text; a row without one refuses it', takes);
  const cleared = await page.evaluate(() => { const S = window.__sounds; S.rows().forEach((_, i) => { const m = S.mark(i); if (!m) return; const { toy, pick, note } = m; if (toy) S.toy(i); if (pick) S.vote(i, pick); if (note) S.note(i, ''); }); return [S.marks(), localStorage.getItem('twopointsix.sounds.marks'), document.querySelectorAll('.row.toy, .row.voted, .vote button[aria-pressed="true"]').length]; });
  check(cleared[0] === 'nothing marked' && cleared[1] === '{}' && cleared[2] === 0, 'un-marking clears them', cleared);
  await page.click('.row .play'); await page.waitForTimeout(100);
  const keys = await page.evaluate(async () => { const S = window.__sounds; const wait = ms => new Promise(r => setTimeout(r, ms)); const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const stop = document.getElementById('stop'); stop.focus(); const p0 = S.played; key(stop, ' '); await wait(30); const onButton = S.played - p0;
    const vol = document.getElementById('vol'); vol.focus(); const sel0 = document.querySelector('.row.sel').dataset.name; key(vol, 'ArrowDown'); const sel1 = document.querySelector('.row.sel').dataset.name;
    vol.blur(); key(document.body, 'ArrowDown'); const sel2 = document.querySelector('.row.sel').dataset.name; const p1 = S.played; key(document.body, ' '); await wait(30);
    S.stop(); return { onButton, sliderMoved: sel0 !== sel1, arrowMoved: sel1 !== sel2, space: S.played - p1 }; });
  check(keys.onButton === 0 && !keys.sliderMoved && keys.arrowMoved && keys.space >= 1, 'Space and the arrows are the rows\' only away from a button or a slider', keys);
  const loops = await page.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)); const on = [];
    for (const b of document.querySelectorAll('.loops button')) { b.click(); await wait(120); on.push(b.getAttribute('aria-pressed')); }
    document.getElementById('tension').value = '0.9'; document.getElementById('tension').dispatchEvent(new Event('input')); await wait(1500);
    window.__sounds.stop(); await wait(100); return { on, after: [...document.querySelectorAll('.loops button')].map(b => b.getAttribute('aria-pressed')) }; });
  check(loops.on.length === 7 && loops.on.every(x => x === 'true') && loops.after.every(x => x === 'false'), 'the loops and the score start and stop', loops);
  // the replays under 'In play': one link a row of public/assets/replays/index.json, each to its own file on the game page; a sound some replay plays has an 'in play' link on its row
  await page.waitForSelector('#tapes a.inplay', { timeout: 8000 }).catch(() => {});
  const tp = await page.evaluate(async () => { const X = await (await fetch('assets/replays/index.json')).json(), top = [...document.querySelectorAll('#tapes a.inplay')].map(a => a.getAttribute('href'));
    const heard = new Set(X.tapes.flatMap(T => Object.keys(T.sounds))), rows = window.__sounds.rows(), els = document.querySelectorAll('.row');
    return { n: X.tapes.length, top: top.length, missing: X.tapes.filter(T => !top.includes('./?playtape=assets/replays/' + T.file + '&soundlanes')).map(T => T.id), has: ['chairs', 'reloads', 'doors'].filter(id => X.tapes.some(T => T.id === id)).length,
      bad: rows.filter((n, i) => heard.has(n) !== !!els[i].querySelector('.also a.inplay')) }; });
  check(tp.n >= 5 && tp.top === tp.n && tp.missing.length === 0 && tp.has === 3 && tp.bad.length === 0, `every replay is listed under 'In play' with a link to its own file (${tp.n}), and a sound has its 'in play' link exactly when a replay plays it`, tp);
  const pe = await page.evaluate(() => window.__sounds.errors);
  check(errs.length === 0 && pe.length === 0 && pe0.length === 0, 'nothing on the console', [...errs, ...pe0, ...pe]);
  for (const w of [1100, 400]) { await page.setViewportSize({ width: w, height: 900 }); const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over <= 0, `no sideways scroll at ${w} px`, over); if (process.argv[2]) await page.screenshot({ path: process.argv[2].replace(/\.png$/, `-${w}.png`) }); }
  // a replay link plays in THIS window (no new tab), so the page is left and come back to: the selected row is kept for the visit and is the one in view on the way back
  { const tabs = await page.evaluate(() => [...document.querySelectorAll('a.inplay')].filter(a => a.hasAttribute('target')).length);
    check(tabs === 0, 'no replay link opens a new tab', tabs);
    await page.evaluate(() => document.activeElement && document.activeElement.blur()); for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
    const left = await page.evaluate(() => document.querySelector('.row.sel').dataset.name);
    await page.reload(); await page.waitForFunction(() => !!window.__sounds); await page.waitForSelector('.row.sel');
    const back = await page.evaluate(() => { const el = document.querySelector('.row.sel'), r = el.getBoundingClientRect(); return { name: el.dataset.name, seen: r.top >= 0 && r.bottom <= window.innerHeight, first: document.querySelector('.row').dataset.name, errors: window.__sounds.errors.length }; });
    check(back.name === left && left !== back.first && back.seen && back.errors === 0, 'back on the page, the row that was selected is selected again and in view', { left, ...back }); }
  // WHERE ITS HOST GIVES IT ONE the page has a `db` (window.pageHost.use('db')): the marks are kept with the page, one document a sound under votes/. A stand-in db here: a seeded vote shows,
  // a vote made is written (one write a document at a time, a typed note in one write), what this browser had and the page had not is pushed, a failed write is tried again, a cleared mark's document goes
  { const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } }), pg = await ctx.newPage(), e2 = [];
    pg.on('pageerror', x => e2.push(String(x && x.stack || x).slice(0, 300))); pg.on('console', m => { if (m.type() === 'error') e2.push(m.text().slice(0, 300)); });
    const seeded = names.find(n => n === 'pistolSuppressed') ?? names[0], local = names[names.length - 1], junk = names[names.length - 2];
    const stale = ['footHard', 'magIn', 'rack'].find(n => names.includes(n) && n !== seeded && n !== local && n !== junk);   // (a sound whose 'new' take was picked since: a vote for that take is no vote now)
    await pg.addInitScript(([seeded, local, junk, stale]) => {
      try { if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once', '1'); localStorage.setItem('twopointsix.sounds.marks', JSON.stringify({ [local]: { toy: true, note: 'kept here', pick: null } })); } } catch {}
      const docs = new Map([['votes/' + seeded, { pick: 'before', note: 'from chat' }], ['votes/' + junk, { pick: 'sideways', note: 7 }], ['votes/notASound', { pick: 'after' }], ...(stale ? [['votes/' + stale, { pick: 'new 1', toy: true, note: 'old vote' }], ['votes/' + stale + 'x', { pick: 'new 1' }]] : [])]);
      const F = window.__fake = { docs, log: [], busy: new Map(), overlap: 0, failNext: null };
      const slow = (id, f) => new Promise((res, rej) => { const b = (F.busy.get(id) ?? 0) + 1; F.busy.set(id, b); if (b > 1) F.overlap++; setTimeout(() => { F.busy.set(id, F.busy.get(id) - 1); if (F.failNext === id) { F.failNext = null; F.log.push(['fail', id]); rej(Object.assign(new Error('unavailable'), { code: 'unavailable' })); } else { f(); res(); } }, 60); });
      const db = { collection: p => ({ get: async () => ({ docs: [...docs].filter(([k]) => k.startsWith(p + '/')).map(([k, v]) => ({ id: k.slice(p.length + 1), data: () => Object.freeze({ ...v }) })) }),
        doc: id => ({ set: d => slow(id, () => { docs.set(p + '/' + id, JSON.parse(JSON.stringify(d))); F.log.push(['set', id]); }), delete: () => slow(id, () => { docs.delete(p + '/' + id); F.log.push(['delete', id]); }) }) }) };
      window.pageHost = { use: n => new Promise(r => setTimeout(() => r(n === 'db' ? db : null), 200)) };
    }, [seeded, local, junk, stale]);
    await pg.goto(`http://localhost:${PORT}/sounds`); await pg.waitForFunction(() => !!window.__sounds && window.__sounds.wasReady && window.__sounds.saved !== 'here');
    await pg.waitForFunction(() => window.__sounds.saved === 'saved');
    const c1 = await pg.evaluate(([seeded, local, junk, stale]) => { const S = window.__sounds, F = window.__fake, i = S.rows().indexOf(seeded), r = document.querySelectorAll('.row')[i];
      return { mark: S.mark(i), lit: r.querySelector('.vote button[aria-pressed="true"]')?.dataset.pick, note: r.querySelector('.note').value, junk: S.mark(S.rows().indexOf(junk)), pushed: F.docs.get('votes/' + local), log: F.log.slice(), status: document.getElementById('marks').textContent, stale: stale ? F.docs.get('votes/' + stale) : null, staleMark: stale ? S.mark(S.rows().indexOf(stale)) : null, junkDoc: F.docs.get('votes/' + junk) }; }, [seeded, local, junk, stale]);
    check(c1.mark?.pick === 'before' && c1.lit === 'before' && c1.note === 'from chat' && c1.junk === null, 'with the page\'s own data: a vote kept there shows on its row, a malformed one is nothing', c1);
    check(c1.pushed?.toy === true && c1.pushed.note === 'kept here' && c1.log.filter(l => l[1] !== stale).length === 1 && c1.junkDoc?.pick === 'sideways' && / · saved$/.test(c1.status), 'a mark this browser had and the page had not is written to it, and nothing else is', c1);
    if (stale) check(c1.staleMark?.toy === true && !c1.staleMark.pick && c1.stale?.toy === true && c1.stale.note === 'old vote' && !c1.stale.pick && c1.log.filter(l => l[1] === stale).length === 1, 'a vote kept there for a take that is the game\'s own now is no vote, and its document is written again without it, once', { mark: c1.staleMark, doc: c1.stale, log: c1.log });
    const other = names.find(n => n !== seeded && n !== local && n !== junk && n !== stale);
    await pg.evaluate(async (other) => { const S = window.__sounds; const i = S.rows().indexOf(other); S.vote(i, 'after'); S.vote(i, 'before'); S.vote(i, 'after'); }, other);
    await pg.type('#note-' + other, 'brighter, and it should be', { delay: 25 });
    await pg.waitForFunction(() => window.__sounds.saved === 'saved', null, { timeout: 8000 });
    const c2 = await pg.evaluate((other) => { const F = window.__fake; return { doc: F.docs.get('votes/' + other), sets: F.log.filter(l => l[1] === other).length, overlap: F.overlap }; }, other);
    check(c2.doc?.pick === 'after' && c2.doc.note === 'brighter, and it should be' && c2.doc.toy === false && typeof c2.doc.at === 'string' && c2.sets <= 3 && c2.overlap === 0, 'a vote and a typed note are written, a burst as one or two writes, never two at once to one document', c2);
    await pg.evaluate((other) => { const S = window.__sounds, F = window.__fake; F.failNext = other; S.toy(S.rows().indexOf(other)); }, other);
    await pg.waitForFunction(() => window.__sounds.saved === 'not saved', null, { timeout: 4000 });
    const bad = await pg.evaluate(() => [document.getElementById('marks').textContent, document.getElementById('marks').classList.contains('bad')]);
    await pg.waitForFunction(() => window.__sounds.saved === 'saved', null, { timeout: 9000 });
    const c3 = await pg.evaluate((other) => window.__fake.docs.get('votes/' + other), other);
    check(/not saved$/.test(bad[0]) && bad[1] && c3?.toy === true, 'a write that fails says so and is tried again', { bad, c3 });
    await pg.evaluate((other) => { const S = window.__sounds, i = S.rows().indexOf(other); S.toy(i); S.vote(i, 'after'); S.note(i, ''); }, other);
    await pg.waitForFunction(() => window.__sounds.saved === 'saved', null, { timeout: 8000 });
    const c4 = await pg.evaluate((other) => ({ has: window.__fake.docs.has('votes/' + other), overlap: window.__fake.overlap, log: window.__fake.log.filter(l => l[1] === other) }), other);
    check(!c4.has && c4.overlap === 0 && c4.log[c4.log.length - 1][0] === 'delete', 'a mark taken back takes its document with it', c4);
    await pg.reload(); await pg.waitForFunction(() => !!window.__sounds && window.__sounds.wasReady && window.__sounds.saved !== 'here');
    // (the stand-in db is new with the page, so this is the seeded state again: the mark this browser kept is pushed once more, nothing is lost or doubled)
    const c5 = await pg.evaluate(([seeded, local]) => { const S = window.__sounds; return [S.mark(S.rows().indexOf(seeded))?.pick, S.mark(S.rows().indexOf(local))?.toy, S.marks()]; }, [seeded, local]);
    check(c5[0] === 'before' && c5[1] === true, 'after a reload the page\'s votes and this browser\'s marks are both there', c5);
    check(e2.length === 0, 'nothing on the console with the page\'s own data', e2);
    await ctx.close(); }
  await browser.close();
  console.log(fails ? `=== sounds-page: ${fails} FAILED ===` : '=== sounds-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
