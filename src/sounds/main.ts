// THE LISTENING PAGE (/sounds, sounds.html): every sound the game makes, one row each, played through the game's own graph (audio/webaudio.ts WebAudioBackend: the compressor, the
// reverb, the HRTF panner) by the mixer's own law (audio/mixlaw.ts) from a place you pick — the same room, round a doorway, behind a shut door, through a wall, far outside, or raw.
// Rows are catalog.ts's (typed against the sound table). A row whose sound was REDONE since the first table (audio/sfxWas.ts, frozen) plays both ways — 'before' is the old
// buffers, the same use, the same place — and takes a VOTE: which of the two is better. Every row takes a note, and can be marked as sounding like a toy. The marks are kept in
// this browser, copied out as text, and — where the page's host gives it a `db` — kept with the page, one document a sound under votes/ (so whoever
// reads the page's data reads the votes; a mark made on another device is there on this one).
// `window.__sounds` is the handle the headless check drives (tools/qa/sounds-page.cjs). No game code is loaded: the mixer's propagation is replaced by the Place's numbers.
import { buildSfx, SfxName } from '../audio/sfx';
import { buildSfxWas, WAS_IN_GAME } from '../audio/sfxWas';
import { altPicked, altSay, altTake, altTakes } from '../audio/sfxAlt';
import { sfxContext, SfxBuffer, BackendVoice } from '../audio/backend';
import { WebAudioBackend } from '../audio/webaudio';
import { Music, WebAudioMusicBackend } from '../audio/music';
import { AMBIENCE_DISTANCE, AMBIENCE_OFFICE, HISS, ambienceLoop } from '../audio/loops';
import { MAX_DIST, REF_DIST, ROLLOFF, VOLUME_DEFAULTS, cutoffOf, distanceGain, hrtfFor, occludedGain, sendOf } from '../audio/mixlaw';
import { noiseBuffer } from '../audio/webaudio';
import { GROUPS, PLACES, SOUNDS, Place, Use } from './catalog';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const NAMES = Object.keys(SOUNDS) as SfxName[];
const STORE = 'twopointsix.sounds.marks';

// ---- the sounds as numbers (for the waveforms, before any gesture) and, once something is played, as the graph's own buffers ----
let table: Record<SfxName, SfxBuffer> = buildSfx(sfxContext(48000)), tableRate = 48000;
let tableWas: Partial<Record<SfxName, SfxBuffer>> | null = null;   // the table before the sounds were redone, built after the first paint
const redone = new Set<SfxName>();
let be: WebAudioBackend | null = null;
let music: Music | null = null, musicOn = false;   // (ONE score for the visit: its voices are started once and gated, never rebuilt)
const live: { v: BackendVoice; end: number }[] = [];
const timers = new Set<ReturnType<typeof setTimeout>>();
const loops = new Map<string, () => void>();   // what is looping → how to stop it
let place: Place = PLACES[0];
let played = 0;
const errors: string[] = [];
window.addEventListener('error', e => errors.push(String(e.message)));

function backend(): WebAudioBackend | null {
  if (be) { be.resume(); return be; }
  be = WebAudioBackend.create({ master: +$<HTMLInputElement>('vol').value, sfx: VOLUME_DEFAULTS.sfx, ambience: VOLUME_DEFAULTS.ambience });
  if (!be) return null;
  be.resume();
  if (be.sampleRate !== tableRate) { table = buildSfx(be.sfxContext); tableRate = be.sampleRate; }   // (the game renders at the context's own rate: so does the page)
  for (const n of NAMES) be.loadBuffer(n, table[n]);
  wasLoaded = false; if (tableWas && wasRate === be.sampleRate) loadWas(be);   // (at another rate the old table is rendered again only when a 'was' is asked for)
  be.setListener([0, 1.6, 0], [0, 0, -1]);
  be.setReverb(place.wet, 0.01);
  return be;
}

const WAS = 'was:';
/** a NEW TAKE of a sound (audio/sfxAlt.ts): rendered and loaded the first time it is asked for, per backend */
const altId = (n: SfxName, k: number) => `new${k}:${n}`;
const altBufs = new Map<string, SfxBuffer>();
let altOn: WebAudioBackend | null = null;
function altBuf(n: SfxName, k: number, b: WebAudioBackend | null): SfxBuffer | null {
  if (k < 1 || k > altTakes(n)) return null;
  if (altOn !== b) { altBufs.clear(); altOn = b; }
  const id = altId(n, k); let buf = altBufs.get(id) ?? null;
  if (!buf) { buf = altTake(b ? b.sfxContext : sfxContext(tableRate), n, k - 1); if (!buf) return null; altBufs.set(id, buf); b?.loadBuffer(id, buf); }
  return buf;
}
let wasRate = 48000, wasLoaded = false;
function loadWas(b: WebAudioBackend) {
  if (!tableWas) return;
  if (b.sampleRate !== wasRate) { tableWas = buildSfxWas(b.sfxContext) as Partial<Record<SfxName, SfxBuffer>>; wasRate = b.sampleRate; }
  for (const n of redone) { const buf = tableWas[n]; if (buf) b.loadBuffer(WAS + n, buf); }
  wasLoaded = true;
}
/** the old table, and which rows differ from it (sample for sample; both rendered at the rate `table` stands at) */
function buildWas() {
  const was = buildSfxWas(be && be.sampleRate === tableRate ? be.sfxContext : sfxContext(tableRate)) as Partial<Record<SfxName, SfxBuffer>>; tableWas = was; wasRate = tableRate;
  for (const n of NAMES) { const a = table[n].getChannelData(0), b = was[n]?.getChannelData(0); if (!b) continue;
    let d = a.length !== b.length; for (let i = 0; !d && i < a.length; i++) d = Math.abs(a[i] - b[i]) > 1e-6; if (d) redone.add(n); }
  if (be) loadWas(be);
  for (const r of rows) { const i = rows.indexOf(r), what = SOUNDS[r.name].what, re = redone.has(r.name), alts = altTakes(r.name); if (!re && !alts) continue;
    const plays: HTMLButtonElement[] = [], btn = (cls: string, text: string, title: string, label: string, f: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; b.title = title; b.setAttribute('aria-label', label); b.onclick = f; plays.push(b); return b; };
    const live = (WAS_IN_GAME as readonly string[]).includes(r.name);
    if (re) btn(live ? 'wasb live' : 'wasb', live ? 'before · in game' : 'before', live ? 'the game plays this one, not the redone one (key B)' : 'how it sounded before it was redone (key B)', 'play ' + what + ' as it was', () => playRow(i, undefined, true));
    if (re) btn('nowb', 'after', live ? 'the redone one: not in the game (Space)' : 'how it sounds now (Space)', 'play ' + what + ' as it is now', () => playRow(i));
    for (let k = 1; k <= alts; k++) if (!altPicked(r.name, k - 1)) btn('altb', 'new ' + k, altSay(r.name, k - 1), 'play ' + what + ', new take ' + k, () => playRow(i, undefined, false, k));
    r.el.querySelector('.also')!.prepend(...plays);
    const v = document.createElement('div'); v.className = 'vote'; v.setAttribute('role', 'group'); v.setAttribute('aria-label', 'which ' + what + ' is better');
    const lab = document.createElement('span'); lab.textContent = 'better'; v.append(lab);
    for (const p of picksOf(r.name)) { const pb = document.createElement('button'); pb.type = 'button'; pb.dataset.pick = p; pb.textContent = p === 'after' && !re ? 'now' : p; pb.setAttribute('aria-pressed', 'false');
      pb.title = p === 'before' ? 'it was better before (key ←)' : p === 'after' ? 'it is better now (key →)' : altSay(r.name, +p.slice(4) - 1); pb.onclick = () => vote(i, p); v.append(pb); }
    r.el.querySelector('.marks')!.prepend(v); paint(i); }
  $('redone').textContent = redone.size ? ` · ${redone.size} redone` : '';
  status();
}
/** one voice, the way audio.ts play() makes it — the Place standing in for the propagation through the level */
function voice(sfx: SfxName, gain: number, rate: number, flat: boolean, lowpass?: number, wet?: number, was = false, alt = 0) {
  const b = backend(); if (!b) return;
  if (was && !wasLoaded) loadWas(b);
  const name = alt && altBuf(sfx, alt, b) ? altId(sfx, alt) : was && redone.has(sfx) ? WAS + sfx : sfx;
  const dur = b.duration(name); if (!dur) { errors.push('no buffer: ' + name); return; }
  let v: BackendVoice | null;
  if (place.dry) v = b.play({ buffer: name, pos: null, gain, rate, bus: 'sfx' });
  else if (flat) v = b.play({ buffer: name, pos: null, gain, rate, bus: 'sfx', cutoffHz: lowpass, cutoffQ: lowpass ? 0.5 : undefined, send: wet });
  else { const g = occludedGain(gain, place.muffle);   // (the far and faint take the cheap panner, as in the game; nothing is culled here — the page is for listening)
    v = b.play({ buffer: name, pos: [0.4, 1.3, -place.metres], gain: g, rate, bus: 'sfx', hrtf: hrtfFor(place.metres, g * distanceGain(place.metres)),
      distance: { ref: REF_DIST, rolloff: ROLLOFF, max: MAX_DIST }, cutoffHz: cutoffOf(place.muffle), send: sendOf(place.muffle, place.metres) }); }
  if (!v) return;
  played++;
  live.push({ v, end: b.now() + dur / rate + 0.1 });
}
const slowest = (r: Use['rate']) => typeof r === 'number' ? r : r ? r[0] : 0.96;
const rateOf = (r: Use['rate']) => typeof r === 'number' ? r : r ? r[0] + Math.random() * (r[1] - r[0]) : 0.96 + Math.random() * 0.08;
const later = (s: number, f: () => void) => { if (s <= 0) { f(); return; } const t = setTimeout(() => { timers.delete(t); f(); }, s * 1000); timers.add(t); };

/** a row's use: its voice, its burst, the sounds the game stacks on it; returns how long it runs */
function playUse(name: SfxName, u: Use, was = false, alt = 0): number {
  const n = u.burst?.n ?? 1, every = u.burst?.every ?? 0, T = (x: SfxName) => (alt && x === name && altBuf(x, alt, be)) || (was && redone.has(x) && tableWas?.[x]) || table[x];
  for (let k = 0; k < n; k++) later(k * every, () => voice(name, u.gain, rateOf(u.rate), !!u.flat, u.lowpass, u.wet, was, alt));
  let end = (n - 1) * every + T(name).duration / slowest(u.rate);
  for (const l of u.plus ?? []) { later(l.after ?? 0, () => voice(l.name, l.gain, l.rate ?? rateOf(undefined), !!l.flat, undefined, undefined, was, l.name === name ? alt : 0)); end = Math.max(end, (l.after ?? 0) + T(l.name).duration / slowest(l.rate)); }
  return end;
}
function stopAll() {
  for (const t of timers) clearTimeout(t); timers.clear();
  if (be) { const b = be; for (const l of live) { b.stop(l.v, 12); setTimeout(() => b.release(l.v), 150); } }
  live.length = 0;
  for (const r of document.querySelectorAll('.row.playing')) r.classList.remove('playing');
}

// ---- marks: a vote (better before, or better after), a note, the 'toy' flag ----
type Pick = 'before' | 'after' | 'new 1' | 'new 2';
const PICKS: readonly Pick[] = ['before', 'after', 'new 1', 'new 2'];
/** which of a row's ways of sounding it can be voted for: both tables of a redone row, and each new take it has */
const picksOf = (n: SfxName): Pick[] => PICKS.filter((p, k) => k < 2 ? redone.has(n) || (p === 'after' && altTakes(n) > 0) : k - 1 <= altTakes(n) && !altPicked(n, k - 2));
interface Mark { toy: boolean; note: string; pick: Pick | null }
const NOTE_MAX = 400;
const marks = new Map<SfxName, Mark>();
/** a mark out of anything read back (this browser's store, the page's own data: neither is trusted to be well formed); null = nothing marked. A vote
 *  for a way of sounding the row no longer offers (a new take since moved into the game) is dropped: it is what plays now */
const asMark = (d: unknown, n: SfxName): Mark | null => { if (!d || typeof d !== 'object') return null; const o = d as Record<string, unknown>;
  const m: Mark = { toy: o.toy === true, note: typeof o.note === 'string' ? o.note.slice(0, NOTE_MAX) : '', pick: PICKS.includes(o.pick as Pick) && !altPicked(n, PICKS.indexOf(o.pick as Pick) - 2) ? o.pick as Pick : null };
  return m.toy || m.note || m.pick ? m : null; };
try { const s = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown>; for (const n of NAMES) { const m = asMark(s[n], n); if (m) marks.set(n, m); } } catch { /* a browser that keeps nothing: the marks live for the visit */ }
const marksText = () => { const said = new Set<SfxName>();
  const line = (head: string, f: (m: Mark) => boolean) => { const t = NAMES.filter(n => { const m = marks.get(n); return !!m && f(m); }).map(n => { const m = marks.get(n)!, w = m.note && !said.has(n) ? `${n} (${m.note})` : n; said.add(n); return w; });
    return t.length ? [head + ': ' + t.join(', ')] : []; };
  const L = [...line('better before', m => m.pick === 'before'), ...line('better after', m => m.pick === 'after'), ...line('better new 1', m => m.pick === 'new 1'), ...line('better new 2', m => m.pick === 'new 2'), ...line('toys', m => m.toy), ...line('notes', m => !!m.note && !m.toy && !m.pick)];
  return L.length ? L.join('\n') : 'nothing marked'; };
function status() {
  const all = [...marks.values()], votes = all.filter(m => m.pick).length, toys = all.filter(m => m.toy).length, notes = all.filter(m => m.note).length;
  const t = [votes ? `${votes} of ${rows.filter(r => picksOf(r.name).length).length || '…'} voted` : '', toys ? `${toys} toy${toys > 1 ? 's' : ''}` : '', notes ? `${notes} note${notes > 1 ? 's' : ''}` : ''].filter(Boolean);
  if (cloud && (t.length || cloudBad)) t.push(cloudBad ? 'not saved' : owed.size || writing.size ? 'saving' : 'saved');
  $('marks').textContent = t.join(' · '); $('marks').classList.toggle('bad', !!cloud && cloudBad);
  $('copy').classList.toggle('primary', marks.size > 0);
}
/** the marks moved: this browser's store, the text, and (a sound named) the page's own data */
function marksChanged(n?: SfxName) {
  for (const [k, m] of marks) if (!m.toy && !m.note && !m.pick) marks.delete(k);
  try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(marks))); } catch { /* as above */ }
  const out = $<HTMLTextAreaElement>('out'); if (!out.hidden) out.value = marksText();
  if (n) { touched.add(n); cloudPut(n); }
  status();
}

// ---- the marks kept WITH the page: where its host gives it a `db` (window.pageHost.use), and each marked sound is one document, votes/<sound> ----
// Served by the game's dev server there is none: the marks are this browser's and the copy button's.
interface CloudDoc { id: string; data(): Record<string, unknown> | undefined }
interface CloudDb { collection(p: string): { get(): Promise<{ docs: CloudDoc[] }>; doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> } } }
let cloud: CloudDb | null = null, cloudBad = false;
const touched = new Set<SfxName>();   // marked on this visit: these win over what the page had when its data came in
const owed = new Set<SfxName>(), writing = new Set<SfxName>(), waits = new Map<SfxName, ReturnType<typeof setTimeout>>(), tries = new Map<SfxName, number>();
/** one write a sound at a time, a pause after the last change (a note is typed a letter at a time) */
function cloudPut(n: SfxName, after = 500) { if (!cloud) return; owed.add(n); clearTimeout(waits.get(n)); waits.set(n, setTimeout(() => { waits.delete(n); void cloudWrite(n); }, after)); }
async function cloudWrite(n: SfxName) {
  if (!cloud || writing.has(n) || !owed.has(n)) return;
  owed.delete(n); writing.add(n); status();
  const m = marks.get(n), ref = cloud.collection('votes').doc(n);
  try { if (m) await ref.set({ pick: m.pick, toy: m.toy, note: m.note, at: new Date().toISOString() }); else await ref.delete(); cloudBad = false; tries.delete(n); }
  catch { const k = (tries.get(n) ?? 0) + 1; tries.set(n, k); cloudBad = true; if (k < 3) { writing.delete(n); cloudPut(n, 3000 * k); status(); return; } }   // (kept in this browser either way; the next change of that sound tries again)
  writing.delete(n); status();
  if (owed.has(n) && !waits.has(n)) void cloudWrite(n);
}
async function cloudStart() {
  const c = (window as { pageHost?: { use?: (n: string) => Promise<unknown> } }).pageHost; if (!c?.use) return;
  try {
    const db = await c.use('db') as CloudDb | null; if (!db) return;
    const snap = await db.collection('votes').get(), there = new Set<string>(), stale = new Set<SfxName>();
    cloud = db;
    for (const d of snap.docs) { const i = rows.findIndex(r => r.name === d.id); if (i < 0) continue; const n = rows[i].name; there.add(n); if (touched.has(n)) continue;
      const was = d.data()?.pick, m = asMark(d.data(), n); if (m) marks.set(n, m); else marks.delete(n); paint(i);
      if (PICKS.includes(was as Pick) && was !== (m?.pick ?? null)) stale.add(n); }   // (a vote for a take that is the game's own now: the page's copy is written again without it; a malformed document is left as it is)
    for (const n of new Set([...touched, ...marks.keys(), ...stale])) if (touched.has(n) || !there.has(n) || stale.has(n)) cloudPut(n, 0);   // what this browser has and the page does not
    touched.clear(); marksChanged();
  } catch { /* no data for this viewer: the marks stay this browser's */ }
}

// ---- the rows ----
const rows: { name: SfxName; el: HTMLElement }[] = [];
let sel = 0;
const SEL = 'sounds.sel';   // the selected row's name, kept for the visit: a replay link leaves this page in the same window
const INK = getComputedStyle(document.documentElement).getPropertyValue('--dim').trim() || '#7f9a92';
function wave(c: HTMLCanvasElement, buf: SfxBuffer) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = 170, H = 28;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); if (!g) return;
  const d = buf.getChannelData(0);
  g.scale(dpr, dpr); g.fillStyle = INK;
  // (every row on ONE time scale, 1.5 s across, so a long tail reads long; what runs past the edge is cut and the seconds beside it say so)
  const span = 1.5 * buf.sampleRate, per = span / W;
  for (let x = 0; x < W; x++) { const a = Math.floor(x * per), b = Math.min(d.length, Math.floor((x + 1) * per)); if (a >= d.length) break; let lo = 0, hi = 0; for (let i = a; i < b; i++) { const s = d[i]; if (s < lo) lo = s; if (s > hi) hi = s; }
    const y0 = H / 2 - hi * H / 2, y1 = H / 2 - lo * H / 2; g.fillRect(x, y0, 1, Math.max(1, y1 - y0)); }
}
function select(i: number, scroll = true) {
  sel = Math.max(0, Math.min(rows.length - 1, i));
  rows.forEach((r, k) => r.el.classList.toggle('sel', k === sel));
  try { sessionStorage.setItem(SEL, rows[sel].name); } catch { /* a browser that keeps nothing: the list opens at its top */ }
  if (scroll) rows[sel].el.scrollIntoView({ block: 'nearest' });
}
function playRow(i: number, u?: Use, was = false, alt = 0) {
  const r = rows[i]; select(i, false);
  if (was && !redone.has(r.name)) return;   // (a row that was kept has no 'was': B leaves what is playing alone)
  if (alt > altTakes(r.name) || altPicked(r.name, alt - 1)) return;   // (a take this row does not have: what is playing is left alone, like B on a kept row)
  stopAll();
  const secs = playUse(r.name, u ?? SOUNDS[r.name], was, alt);
  r.el.classList.add('playing'); later(secs, () => r.el.classList.remove('playing'));
}
/** a row drawn as its mark stands */
function paint(i: number) {
  const r = rows[i], m = marks.get(r.name);
  r.el.classList.toggle('toy', !!m?.toy); r.el.classList.toggle('voted', !!m?.pick);
  r.el.querySelector('.toyb')!.setAttribute('aria-pressed', String(!!m?.toy));
  for (const b of r.el.querySelectorAll<HTMLElement>('.vote button')) b.setAttribute('aria-pressed', String(b.dataset.pick === m?.pick));
  const note = r.el.querySelector('.note') as HTMLInputElement; if (document.activeElement !== note) note.value = m?.note ?? '';
}
function setMark(i: number, f: (m: Mark) => void) { const n = rows[i].name, m = marks.get(n) ?? { toy: false, note: '', pick: null }; f(m); marks.set(n, m); marksChanged(n); paint(i); }
const toggleToy = (i: number) => setMark(i, m => { m.toy = !m.toy; });
/** which is better; the lit one again takes the vote back. Only a row with more than one way of sounding has a vote */
function vote(i: number, p: Pick) { if (picksOf(rows[i].name).includes(p)) setMark(i, m => { m.pick = m.pick === p ? null : p; }); }
const setNote = (i: number, text: string) => setMark(i, m => { m.note = text.trim().slice(0, NOTE_MAX); });
function build() {
  const list = $('list');
  for (const G of GROUPS) {
    const names = NAMES.filter(n => SOUNDS[n].group === G.id); if (!names.length) continue;
    const sec = document.createElement('section'); const h = document.createElement('h2'); h.textContent = G.name; sec.append(h);
    const box = document.createElement('div'); box.className = 'rows'; sec.append(box);
    const first = rows.length;
    const all = document.createElement('button'); all.type = 'button'; all.textContent = '▶ all'; all.title = 'play this group through, one after another';
    all.onclick = () => { stopAll(); const next = (k: number) => { if (k >= names.length) return; const i = first + k; select(i); rows[i].el.classList.add('playing');
      const s = playUse(names[k], SOUNDS[names[k]]); later(s, () => rows[i].el.classList.remove('playing')); later(Math.min(5, s) + 0.4, () => next(k + 1)); }; next(0); };
    h.append(all);
    for (const n of names) {
      const S = SOUNDS[n]; const i = rows.length;
      const el = document.createElement('div'); el.className = 'row'; el.tabIndex = -1; el.dataset.name = n;
      const p = document.createElement('button'); p.type = 'button'; p.className = 'play'; p.textContent = '▶'; p.setAttribute('aria-label', 'play ' + S.what); p.onclick = () => playRow(i);
      const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = S.what;
      const id = document.createElement('small'); id.textContent = `${n} · ${table[n].duration.toFixed(2)} s`; nm.append(id);
      const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); wave(cv, table[n]);
      const t = document.createElement('button'); t.type = 'button'; t.className = 'toyb'; t.textContent = 'toy'; t.setAttribute('aria-pressed', 'false'); t.title = 'this one sounds like a toy (key T)'; t.onclick = () => toggleToy(i);
      const mk = document.createElement('div'); mk.className = 'marks'; mk.append(t);   // (a redone row's vote joins it once the old table is built)
      el.append(p, nm, cv, mk);
      const a = document.createElement('div'); a.className = 'also';
      for (const u of S.also ?? []) { const b = document.createElement('button'); b.type = 'button'; b.textContent = u.what; b.onclick = () => playRow(i, u); a.append(b); }
      const note = document.createElement('input'); note.className = 'note'; note.id = 'note-' + n; note.placeholder = 'add a note'; note.maxLength = NOTE_MAX; note.autocomplete = 'off'; note.setAttribute('aria-label', 'note on ' + S.what);
      note.oninput = () => setNote(i, note.value);
      note.onkeydown = e => { if (e.key === 'Enter' || e.key === 'Escape') note.blur(); };
      a.append(note); el.append(a);
      el.addEventListener('pointerdown', () => select(i, false));
      box.append(el); rows.push({ name: n, el }); paint(i);
    }
    list.append(sec);
  }
  let back = -1; try { const n = sessionStorage.getItem(SEL); back = rows.findIndex(r => r.name === n); } catch { /* as above */ }
  select(Math.max(0, back), back > 0); status();
}

// ---- the replays that play each sound IN THE GAME (the engine player, ?playtape=) ----
// Only where the replay files are served beside the page (public/assets/replays/, made by tools/qa/sound-tapes.cjs): the one-file build has none and shows nothing.
interface TapeRow { id: string; title: string; file: string; seconds: number; sounds: Record<string, number> }
const TAPE_LEAD = 240;   // steps of play before the sound (4 s): time to see what makes it
async function inPlay() {
  let X: { tapes?: TapeRow[] };
  try { const r = await fetch('assets/replays/index.json'); if (!r.ok) return; X = await r.json(); } catch { return; }
  const tapes = X.tapes ?? []; if (!tapes.length) return;
  const href = (T: TapeRow, at = 0) => `./?playtape=assets/replays/${T.file}&soundlanes${at > 0 ? `&at=${at}` : ''}`;   // (the sound lanes are the replay's debug mode: these links are the way in; they play in THIS window, and Back lands on the row he left: SEL)
  const link = (T: TapeRow, text: string, at = 0) => { const l = document.createElement('a'); l.href = href(T, at); l.className = 'inplay'; l.textContent = text; return l; };
  const sec = document.createElement('section'); sec.id = 'tapes'; const h = document.createElement('h2'); h.textContent = 'In play'; sec.append(h);
  const box = document.createElement('div'); box.className = 'also';
  for (const T of tapes) { const s = Math.round(T.seconds); box.append(link(T, `${T.title} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)); }
  sec.append(box); $('list').prepend(sec);
  for (const r of rows) {
    let best: TapeRow | null = null; for (const T of tapes) if (r.name in T.sounds && (!best || T.sounds[r.name] < best.sounds[r.name])) best = T;
    if (!best) continue;
    const l = link(best, 'in play', Math.max(0, best.sounds[r.name] - TAPE_LEAD)); l.title = `${best.title}: the replay opens a few seconds before it`; r.el.querySelector('.also')!.insertBefore(l, r.el.querySelector('.note'));
  }
}

// ---- where you hear it from, the volume, stop, copy ----
function setPlace(p: Place) {
  place = p; be?.setReverb(p.wet, 0.05);
  for (const b of $('places').children) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.id === p.id));
}
function chrome() {
  PLACES.forEach((p, k) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id; b.textContent = p.name; b.title = `key ${k + 1}`; b.onclick = () => setPlace(p); $('places').append(b); });
  setPlace(PLACES[0]);
  $<HTMLInputElement>('vol').oninput = e => be?.setBus('master', +(e.target as HTMLInputElement).value, 0.05);
  $('stop').onclick = () => { stopAll(); stopLoops(); };
  $('copy').onclick = () => { const text = marksText(); const out = $<HTMLTextAreaElement>('out'); out.hidden = false; out.value = text;
    const done = () => { $('copy').textContent = 'copied'; setTimeout(() => { $('copy').textContent = 'copy marks'; }, 1500); };
    try { navigator.clipboard.writeText(text).then(done, () => { out.focus(); out.select(); }); } catch { out.focus(); out.select(); } };
  if (location.pathname.startsWith('/sounds')) $('back').hidden = false;   // (served by the game's own dev server: a way back; as a page by itself there is no game beside it)
  window.addEventListener('keydown', e => {
    const t = e.target as HTMLElement; const range = t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range';
    if (t.tagName === 'INPUT' && !range || t.tagName === 'TEXTAREA') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const arrow = e.key.startsWith('Arrow'); if (range && arrow) return;   // (a slider keeps its own arrows)
    // (moving the selection takes the focus off whatever button had it, so Space is the selected row's again and never the last button clicked)
    const move = (d: number) => { if (t.tagName === 'BUTTON') t.blur(); select(sel + d); e.preventDefault(); };
    if (e.key === 'ArrowDown' || e.key === 'j') move(1);
    else if (e.key === 'ArrowUp' || e.key === 'k') move(-1);
    else if (e.key === ' ' || e.key === 'Enter') { if (t.tagName === 'BUTTON') return; playRow(sel); e.preventDefault(); }   // (a focused button is pressed by its own Space / Enter)
    else if (e.key === 't' || e.key === 'T') toggleToy(sel);
    else if (e.key === 'b' || e.key === 'B') playRow(sel, undefined, true);
    else if (e.key === 'ArrowLeft') { vote(sel, 'before'); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { vote(sel, 'after'); e.preventDefault(); }
    else if (e.key === 'n' || e.key === 'N') { (rows[sel].el.querySelector('.note') as HTMLInputElement).focus(); e.preventDefault(); }
    else if (e.key >= '1' && e.key <= String(PLACES.length)) setPlace(PLACES[+e.key - 1]);
    else if (e.key === 'Escape') { stopAll(); stopLoops(); }
  });
}

// ---- loops: the hums, a canister's hiss, the rain, the score ----
const HUMS = AMBIENCE_OFFICE.filter((e, i, all) => all.findIndex(x => x.kind === e.kind) === i);   // (one of each kind, at the level the mixer gives its first emitter)
let rainOn = false;
function stopLoops() {
  for (const off of [...loops.values()]) off();
  loops.clear(); if (rainOn) { be?.rainLevel(0); rainOn = false; }
  if (music && musicOn) { music.enabled = false; music.setVolume(0); musicOn = false; }
  for (const b of document.querySelectorAll('.loops button')) b.setAttribute('aria-pressed', 'false');
}
function loopsUi() {
  const box = $('loops');
  /** a toggle: `on` starts the loop and returns how to stop it */
  const toggle = (label: string, id: string, on: (b: WebAudioBackend, ended: () => void) => (() => void) | null) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label; btn.id = 'loop-' + id; btn.setAttribute('aria-pressed', 'false');
    const ended = () => { loops.delete(id); btn.setAttribute('aria-pressed', 'false'); };
    btn.onclick = () => { const b = backend(); if (!b) return; const off = loops.get(id); if (off) { off(); ended(); return; }
      const stop = on(b, ended); if (stop) { loops.set(id, stop); btn.setAttribute('aria-pressed', 'true'); } };
    box.append(btn);
  };
  // (each hum's voice is made ONCE, silent, as the mixer makes its emitters, and the button moves its gain)
  const hums = new Map<string, BackendVoice>();
  for (const h of HUMS) toggle(h.what, h.kind, b => {
    let v = hums.get(h.kind);
    if (!v) { const L = ambienceLoop(b.sfxContext, h.kind); b.loadBuffer('amb:' + h.kind, L.buffer);
      const nv = b.play({ buffer: 'amb:' + h.kind, pos: [0.6, 1.4, -2], gain: 0, rate: 1, loop: true, bus: 'ambience', distance: AMBIENCE_DISTANCE, filter: L.filter, wobble: L.wobble });
      if (!nv) return null; v = nv; hums.set(h.kind, nv); }
    const hv = v; b.setVoice(hv, { gain: h.base }, 0.1);
    return () => b.setVoice(hv, { gain: 0 }, 0.06);
  });
  toggle(`a smoke can, ${HISS_SECS} s`, 'hiss', (b, ended) => { b.loadBuffer('smokeHissNoise', noiseBuffer(b.sfxContext, HISS.seconds));   // (a fresh noise loop per hiss, as the mixer's)
    const m = place.dry ? 2.5 : place.metres;
    voice('smokePop', HISS.pop, rateOf(undefined), false);
    const v = b.play({ buffer: 'smokeHissNoise', pos: [0.4, 0.1, -m], gain: 0, rate: 1, loop: true, bus: 'sfx', distance: HISS.distance, filter: HISS.filter, cutoffHz: cutoffOf(place.muffle),
      envelope: { peak: HISS.peak, rise: HISS.rise, hold: HISS_SECS - HISS.tail, end: HISS_SECS } });
    if (!v) return null;
    const t = setTimeout(() => { b.release(v); ended(); }, HISS_SECS * 1000 + 150);
    return () => { clearTimeout(t); b.stop(v, 60); setTimeout(() => b.release(v), 500); };
  });
  const rain = document.createElement('button'); rain.type = 'button'; rain.textContent = 'rain'; rain.id = 'loop-rain'; rain.setAttribute('aria-pressed', 'false');
  rain.onclick = () => { const b = backend(); if (!b) return; rainOn = !rainOn; b.rainLevel(rainOn ? 0.8 : 0); rain.setAttribute('aria-pressed', String(rainOn)); };
  box.append(rain);
  const mb = $('musicOn'), ten = $<HTMLInputElement>('tension');
  mb.onclick = () => { const b = backend(); if (!b) return;
    if (!music) music = new Music(new WebAudioMusicBackend(b.ctx, b.master));
    musicOn = !musicOn; music.enabled = musicOn; music.setVolume(musicOn ? VOLUME_DEFAULTS.music : 0); music.intensity = +ten.value; mb.setAttribute('aria-pressed', String(musicOn)); };
  ten.oninput = () => { if (music) music.intensity = +ten.value; };
}
const HISS_SECS = 8;

build(); chrome(); loopsUi(); void inPlay(); void cloudStart();
requestAnimationFrame(() => setTimeout(buildWas, 0));   // (after the first paint: the old table is most of another second of rendering)
setInterval(() => { if (!be) return; const t = be.now(); for (let i = live.length - 1; i >= 0; i--) if (t > live[i].end) { be.release(live[i].v); live.splice(i, 1); } }, 500);

declare global { interface Window { __sounds?: unknown } }
window.__sounds = { names: NAMES, rows: () => rows.map(r => r.name), play: (i: number) => playRow(i), playAlso: (i: number, k: number) => playRow(i, SOUNDS[rows[i].name].also![k]), stop: () => { stopAll(); stopLoops(); },
  toy: toggleToy, marks: marksText, vote, note: setNote, mark: (i: number) => marks.get(rows[i].name) ?? null, get saved() { return !cloud ? 'here' : cloudBad ? 'not saved' : owed.size || writing.size ? 'saving' : 'saved'; }, playWas: (i: number) => playRow(i, undefined, true), playNew: (i: number, k: number) => playRow(i, undefined, false, k), takes: (i: number) => { let c = 0; for (let k = 0; k < altTakes(rows[i].name); k++) if (!altPicked(rows[i].name, k)) c++; return c; }, picks: (i: number) => picksOf(rows[i].name), redone: () => [...redone], get wasReady() { return !!tableWas; }, place: (id: string) => setPlace(PLACES.find(p => p.id === id) ?? PLACES[0]),
  get played() { return played; }, get live() { return live.length; }, get errors() { return errors; }, get state() { return be?.ctx.state ?? 'none'; }, get rate() { return be?.sampleRate ?? 0; } };
