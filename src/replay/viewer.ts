// THE REPLAY VIEWER (replay.html): a saved replay (src/replay/format.ts — F7 on the game page) drawn as a MAP of the floor with a scrubber. Every man is a disc with
// his facing and his muzzle's line, ringed by his state, with the route ahead of him and the mark he is going to; rounds are lines, blasts rings, doors swing. A
// click on a man says what he was doing; a click on the FLOOR puts a NOTE on that spot at that moment — the notes are kept in the file (and written back to this
// browser's shelf as they are typed), and 'Download with notes' is the one file a thread needs. No game code runs here: the page reads the trace and nothing else.
import type { ReplayFile, ReplayNote, Decoded, ManAt, ManDo, ReplayEvent } from './format';
import { checkReplay, decode, sampleAt, clock, doWords, isErrorMark, errorMarks, lastRun, downloadReplay, backToGame } from './format';
import { shelfList, shelfGet, shelfPut, shelfNotes, shelfDelete } from './shelf';
import { assemble } from './kept';
import { readVisit, wholeSent, beingWritten } from './keepstore';
import { keptStore, keptNow, keptWords, dumpNow, mb } from './dumpui';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const map = $<HTMLCanvasElement>('map'), tl = $<HTMLCanvasElement>('tl'), ctx = map.getContext('2d')!, tctx = tl.getContext('2d')!;
const RAD = Math.PI / 180;

// ================================================================================================================================ state
let D: Decoded | null = null, F: ReplayFile | null = null, shelfId: number | null = null;
/** the open replay is a whole KEPT VISIT (keepstore.ts), not a shelf entry: its notes are written on the visit's row */
let keptSid: string | null = null;
let cur = 0, playing = false, speed = 1, sel: number | null = null, hover: number | null = null;
const view = { cx: 20, cz: 14, s: 20, rot: 0 };
let fitted = false, lastWall = 0, saveT = 0, logAt = -1, notesDirty = true, whoKey = '';
const end = () => (D && D.r.length ? D.r[D.r.length - 1] : 0);

// ================================================================================================================================ open
async function textOf(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return new TextDecoder().decode(buf);
}
function open(file: ReplayFile, id: number | null): string {
  const bad = checkReplay(file); if (bad) return bad;
  flush(); F = file; D = decode(file); shelfId = id; keptSid = null; cur = 0; playing = false; sel = null; fitted = false; logAt = -1; notesDirty = true; whoKey = '';
  if (file.why === 'card') { const r0 = lastRun(file); if (r0 > 0) cur = D.r.find(r => r >= r0) ?? r0; }   // (opened from the end card: at the start of the run the card is about, not of the tries the ring still holds before it)
  $('empty').style.display = 'none';
  for (const b of ['export', 'play', 'addNote']) ($<HTMLButtonElement>(b)).disabled = false;
  engineLink();
  const flags: string[] = []; const fl = file.flags ?? {};
  if (fl.godMode) flags.push('GOD MODE'); if (fl.aiEnabled === false) flags.push('AI OFF'); if (fl.infiniteAmmo) flags.push('UNLIMITED AMMO'); if (fl.playerInvisible) flags.push('INVISIBLE');
  if (file.why.startsWith('error')) flags.push('SAVED BY A CRASH'); else if (errorMarks(file).length) flags.push('HOLDS A PAGE ERROR');
  const what = $('what'); what.textContent = '';
  const b = document.createElement('b'); b.textContent = file.level.scenario || file.level.file || 'the night'; what.append(b, ` · saved ${new Date(file.savedAt).toLocaleString()} · ${clock(file.seconds)} of play · ${file.cast.length} men${file.commit ? ` · build ${file.commit.slice(0, 9)}` : ''}${file.why.startsWith('error') ? ` · ${file.why}` : ''}`);
  what.title = `${what.textContent}${flags.length ? ` · ${flags.join(' · ')}` : ''}`;   // (the bar cuts a long line short: the whole of it is the tooltip)
  for (const w of flags) { const sp = document.createElement('span'); sp.className = 'warn'; sp.textContent = w; what.append(sp); }
  document.title = `replay · ${file.level.scenario || file.level.file || 'the night'} · ${clock(file.seconds)}`;
  buildLog(); return '';
}
async function openFromDisk(file: File) {
  let parsed: ReplayFile; try { parsed = JSON.parse(await textOf(file)) as ReplayFile; } catch (e) { say(`Could not read ${file.name}: ${(e as Error).message}`); return; }
  const bad = checkReplay(parsed); if (bad) { say(`${file.name}: ${bad}`); return; }
  // onto the shelf, so notes typed on it are kept here too — or back onto its own entry, if this browser already holds this replay (its notes, where the file brings none)
  const have = (await shelfList()).find(r => r.savedAt === parsed.savedAt && r.seconds === parsed.seconds);
  let id: number | null;
  if (have) { id = have.id; const row = await shelfGet(id).catch(() => null);   // (the notes kept here AND the file's, by id, the shelf's copy of a note standing, as the engine replay page joins them: the file's alone wiped every note typed since it was saved)
    if (row) { const kept = row.notes ?? [], ids = new Set(kept.map(n => n.id)), fresh = parsed.notes.filter(n => !ids.has(n.id)); parsed.notes = [...kept, ...fresh].sort((a, b) => a.r - b.r || a.n - b.n); if (fresh.length) await shelfNotes(id, parsed.notes); } }   // (a row that cannot be read changes nothing on the shelf: the file is shown as it came)
  else id = await shelfPut(parsed);
  try { const bad2 = open(parsed, id); if (bad2) { say(`${file.name}: ${bad2}`); return; } } catch (e) { say(`${file.name}: not a replay this page can draw (${(e as Error).message})`); void showShelf(); return; }
  if (id !== null) history.replaceState(null, '', `#id=${id}`);
}
async function openFromShelf(id: number) {
  const f = await shelfGet(id); if (!f) { say('That replay is no longer on the shelf'); return; }
  try { const bad = open(f, id); if (bad) say(bad); else history.replaceState(null, '', `#id=${id}`); } catch (e) { say(`That replay could not be drawn (${(e as Error).message})`); void showShelf(); }
}
/** 'Play in engine': the game page playing this shelf entry's run tape (src/replay/engineplay.ts, `?playtape=<shelf id>`; its bar has a 'Map' link back here).
 *  Only where there is a tape to play and a shelf id to name it by (a kept visit has none) */
function engineLink() {
  const a = $<HTMLAnchorElement>('engine'), T = F?.rerun, ok = shelfId !== null && !!T && !('dead' in T);
  a.hidden = !ok; if (ok) a.href = new URL(`index.html?playtape=${shelfId}`, document.baseURI).href; else a.removeAttribute('href');
}
function say(text: string) { const h = $('hint'); h.textContent = text; h.style.color = '#ee7a68'; setTimeout(() => { h.style.color = ''; }, 4000); }
async function showShelf() {
  flush(); D = null; F = null; shelfId = null; keptSid = null; playing = false; sel = null; hover = null; whoKey = ''; $('empty').style.display = 'flex';
  renderNotes(); showWho(false); $('clock').textContent = '–'; $('clock').title = '';
  for (const b of ['export', 'play', 'addNote']) ($<HTMLButtonElement>(b)).disabled = true;
  engineLink();
  $('what').textContent = 'no replay open'; $('what').title = ''; $('log').textContent = ''; notesDirty = true;
  void showKept();
  const box = $('shelf'); box.textContent = ''; const rows = await shelfList();
  if (!rows.length) { const d = document.createElement('div'); d.textContent = 'Nothing saved in this browser yet.'; box.append(d); return; }
  for (const r of rows) {
    const row = document.createElement('div'); row.className = 'row';
    const s = document.createElement('span'); s.textContent = `${new Date(r.savedAt).toLocaleString()} · ${clock(r.seconds)} · ${r.scenario || 'the night'}${r.why.startsWith('error') ? ' · crash' : r.err ? ' · page error' : ''}`;
    const n = document.createElement('em'); n.textContent = r.notes ? `${r.notes} note${r.notes > 1 ? 's' : ''}` : '';
    const x = document.createElement('i'); x.textContent = '✕'; x.title = 'remove from this browser';
    x.onclick = async ev => { ev.stopPropagation(); if (r.notes && !confirm('This replay has notes on it. Remove it?')) return; await shelfDelete(r.id); void showShelf(); };
    row.onclick = () => void openFromShelf(r.id); row.append(s, n, x); box.append(row);
  }
}
/** EVERY RUN KEPT (keeper.ts): what this browser holds with no key pressed — whole page visits, newest first — and the hand-over: all of it as ONE file to attach
 *  in a thread. A row opens the whole visit here like any replay (notes on it ride in the next hand-over). */
async function showKept() {
  const box = $('kept'), list = $('keptList'), line = $('keptLine'); if (!box) return;
  let S; try { S = await keptNow(); } catch { box.style.display = 'none'; return; }
  box.style.display = ''; line.textContent = keptWords(S);
  ($<HTMLButtonElement>('dumpNew')).disabled = !S.fresh && !S.noted; ($<HTMLButtonElement>('dumpAll')).disabled = !S.visits;
  list.textContent = '';
  for (const r of S.rows) {
    const row = document.createElement('div'); row.className = 'row';
    const s = document.createElement('span'); s.textContent = `${new Date(r.lastAt).toLocaleString()} · ${clock(r.seconds)} · ${r.scenario || 'the night'} · ${mb(r.bytes)}`;
    const n = document.createElement('em'); n.textContent = `${r.notes?.length ? `${r.notes.length} note${r.notes.length > 1 ? 's' : ''} · ` : ''}${beingWritten(r) ? 'being played' : wholeSent(r) ? (r.noted && r.notes?.length ? 'new notes' : 'handed over') : r.sent ? 'grown since' : 'new'}`;
    const x = document.createElement('i'); x.textContent = '✕'; x.title = 'remove from this browser';
    x.onclick = async ev => { ev.stopPropagation();
      if (beingWritten(r)) { say('That one is being played, or was a moment ago: try again in a minute'); return; }   // (its page would go on writing pieces to a visit with no start)
      if ((!wholeSent(r) || (r.noted && r.notes?.length)) && !confirm(wholeSent(r) ? 'Its notes have not been handed over. Remove it?' : 'This kept replay has not been handed over. Remove it?')) return;
      await keptStore().drop(r.sid); void showKept(); };
    row.onclick = () => void openKept(r.sid); row.append(s, n, x); list.append(row);
  }
}
async function openKept(sid: string) {
  let A: ReturnType<typeof assemble> = null;
  try { const V = await readVisit(keptStore(), sid); A = V ? assemble(V) : null; } catch { /* said below */ }
  if (!A) { say('That kept replay could not be read'); return; }
  try { const bad = open(A.file, null); if (bad) { say(bad); return; } keptSid = sid; history.replaceState(null, '', `#kept=${sid}`); if (A.missing.length) say(`${A.missing.length} piece${A.missing.length > 1 ? 's' : ''} of this kept replay ${A.missing.length > 1 ? 'were' : 'was'} lost: marked in the log`); }
  catch (e) { say(`That kept replay could not be drawn (${(e as Error).message})`); void showShelf(); }
}

// ================================================================================================================================ the moment
const lerpDeg = (a: number, b: number, k: number) => { let d = ((b - a) % 360 + 540) % 360 - 180; if (Math.abs(d) > 170) d = k < 0.5 ? 0 : d; return a + d * k; };
/** every man at replay time r, eased between the two samples round it */
function menAt(r: number): { ci: number; at: ManAt }[] {
  if (!D || !D.r.length) return [];
  const s = sampleAt(D, r), s2 = Math.min(D.r.length - 1, s + 1), gap = D.r[s2] - D.r[s], k = gap > 0 && gap < 0.5 ? Math.min(1, Math.max(0, (r - D.r[s]) / gap)) : 0;
  const out: { ci: number; at: ManAt }[] = []; const A = D.men[s], B = D.men[s2];
  for (let ci = 0; ci < A.length; ci++) { const a = A[ci]; if (!a) continue; const b = B[ci];
    if (!b || k === 0 || Math.hypot(b.x - a.x, b.z - a.z) > 2) { out.push({ ci, at: a }); continue; }   // (a jump of metres between samples is a teleport, not a walk)
    out.push({ ci, at: { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: lerpDeg(a.yaw, b.yaw, k), aim: lerpDeg(a.aim, b.aim, k), aw: a.aw, do: a.do } }); }
  return out;
}
function seek(r: number) { cur = Math.min(end(), Math.max(0, r)); }
function step(dir: number, big: boolean) { if (!D) return; playing = false; if (big) { seek(cur + dir); return; } const s = sampleAt(D, cur); seek(D.r[Math.min(D.r.length - 1, Math.max(0, dir > 0 ? s + 1 : (D.r[s] < cur - 1e-6 ? s : s - 1)))]); }

// ================================================================================================================================ the map
const COL: Record<string, string> = { player: '#f6f1e4', operative: '#7ab8ff', guard: '#ff7a6a', hostile: '#ff7a6a', civilian: '#9be08a' };
const RING: Record<string, string> = { alert: '#ff4a3a', search: '#ff9c3a', suspicious: '#e8c46a' };
const colOf = (ci: number) => COL[F!.cast[ci].team] ?? '#d8c08a';
function w2s(x: number, z: number): [number, number] { const c = Math.cos(view.rot), s = Math.sin(view.rot), dx = x - view.cx, dz = z - view.cz; return [map.clientWidth / 2 + (dx * c - dz * s) * view.s, map.clientHeight / 2 + (dx * s + dz * c) * view.s]; }
function s2w(X: number, Y: number): [number, number] { const c = Math.cos(view.rot), s = Math.sin(view.rot), a = (X - map.clientWidth / 2) / view.s, b = (Y - map.clientHeight / 2) / view.s; return [view.cx + a * c + b * s, view.cz - a * s + b * c]; }
function fit() {
  if (!F) return; const [x0, z0, x1, z1] = F.map.bounds, bw = x1 - x0 + 3, bh = z1 - z0 + 3, c = Math.abs(Math.cos(view.rot)), s = Math.abs(Math.sin(view.rot));
  view.cx = (x0 + x1) / 2; view.cz = (z0 + z1) / 2; view.s = Math.max(4, Math.min(map.clientWidth / (bw * c + bh * s), map.clientHeight / (bw * s + bh * c)));
}
function size(cv: HTMLCanvasElement) { const dpr = window.devicePixelRatio || 1, w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return dpr; }

function drawMap() {
  const dpr = size(map), W = map.clientWidth, H = map.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0c0b09'; ctx.fillRect(0, 0, W, H);
  if (!D || !F) return;
  const s = sampleAt(D, cur);
  if (($<HTMLInputElement>('turn')).checked) { const c = D.cam[s]; view.rot = c ? c[2] * RAD : 0; } else view.rot = 0;
  if (!fitted && W > 0) { fit(); fitted = true; }
  const S = view.s, c = Math.cos(view.rot), sn = Math.sin(view.rot), a = S * c, b = S * sn, cc = -S * sn, d = S * c;
  const e = W / 2 - (a * view.cx + cc * view.cz), f = H / 2 - (b * view.cx + d * view.cz);
  ctx.setTransform(a * dpr, b * dpr, cc * dpr, d * dpr, e * dpr, f * dpr);
  const px = 1 / S;
  // ---- the floor's solids: low things first, walls over them, glass as a line
  const B = F.map.boxes;
  for (const pass of [1, 0, 2]) for (let i = 0; i < B.length; i += 6) {
    if (B[i + 5] !== pass) continue;
    ctx.save(); ctx.translate(B[i], B[i + 1]); if (B[i + 4]) ctx.rotate(-B[i + 4] * RAD);
    if (pass === 2) { ctx.strokeStyle = 'rgba(140,200,255,0.75)'; ctx.lineWidth = Math.max(px, 0.04); ctx.strokeRect(-B[i + 2], -B[i + 3], B[i + 2] * 2, B[i + 3] * 2); }
    else { ctx.fillStyle = pass === 0 ? '#6f6959' : '#25221c'; ctx.fillRect(-B[i + 2], -B[i + 3], B[i + 2] * 2, B[i + 3] * 2); }
    ctx.restore();
  }
  // ---- doors
  F.map.doors.forEach((dr, i) => { const st = D!.doors[s][i]; if (!st || st.bits & 8) return; const ang = (dr.dir + st.ang) * RAD;
    ctx.beginPath(); ctx.moveTo(dr.hinge[0], dr.hinge[1]); ctx.lineTo(dr.hinge[0] + Math.cos(ang) * dr.width, dr.hinge[1] + Math.sin(ang) * dr.width);
    ctx.strokeStyle = st.bits & 2 ? '#e8c46a' : st.bits & 4 ? '#ff7a6a' : '#c9a36a'; ctx.lineWidth = Math.max(2 * px, 0.07); ctx.stroke(); });
  const men = menAt(cur), by = new Map(men.map(m => [m.ci, m.at]));
  const routes = ($<HTMLInputElement>('routes')).checked;
  // ---- routes, marks, fixes (under the men)
  for (const { ci, at } of men) {
    const dd = at.do, on = ci === sel || ci === hover; if (dd.st === 'dead' || dd.st === 'down') continue;
    if ((routes || on) && dd.path?.length) { ctx.beginPath(); ctx.moveTo(at.x, at.z); for (const p of dd.path) ctx.lineTo(p[0], p[1]); ctx.strokeStyle = colOf(ci); ctx.globalAlpha = on ? 0.95 : 0.4; ctx.lineWidth = (on ? 2 : 1) * px; ctx.setLineDash([4 * px, 4 * px]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if ((routes || on) && dd.goal) { const g = dd.goal, k = 0.16; ctx.beginPath(); ctx.moveTo(g[0] - k, g[1] - k); ctx.lineTo(g[0] + k, g[1] + k); ctx.moveTo(g[0] - k, g[1] + k); ctx.lineTo(g[0] + k, g[1] - k); ctx.strokeStyle = colOf(ci); ctx.globalAlpha = on ? 1 : 0.6; ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.globalAlpha = 1; }
    if (on && dd.fix) { ctx.beginPath(); ctx.arc(dd.fix[0], dd.fix[1], 0.3, 0, 7); ctx.strokeStyle = '#e8c46a'; ctx.lineWidth = 1.5 * px; ctx.setLineDash([3 * px, 3 * px]); ctx.stroke(); ctx.setLineDash([]); }
    if (dd.foe !== undefined && dd.foe >= 0 && (dd.st === 'alert' || on || F!.cast[ci].team === 'operative')) {   // (a room fight's teammate has his gun on a man while still 'patrol')
      const t = by.get(dd.foe); if (t) { ctx.beginPath(); ctx.moveTo(at.x, at.z); ctx.lineTo(t.x, t.z); ctx.strokeStyle = 'rgba(255,74,58,0.35)'; ctx.lineWidth = px; ctx.stroke(); } }
  }
  // ---- the picked man's trail: the last twenty seconds of his feet
  if (sel !== null) { ctx.beginPath(); let pen = false; for (let i = sampleAt(D, cur - 20); i <= s; i++) { const m = D.men[i][sel]; if (!m) { pen = false; continue; } if (pen) ctx.lineTo(m.x, m.z); else ctx.moveTo(m.x, m.z); pen = true; } ctx.strokeStyle = 'rgba(244,255,248,0.55)'; ctx.lineWidth = 1.5 * px; ctx.stroke(); }
  // ---- things in the air
  for (const it of F.samples[s].i ?? []) { ctx.fillStyle = it[0] === 'smoke' ? '#b9c4c6' : it[0] === 'frag' ? '#ff9c3a' : '#e8c46a'; ctx.fillRect(it[1] - 0.09, it[2] - 0.09, 0.18, 0.18); }
  // ---- rounds, blasts, kicks: what happened in the last beat
  { const EV = F.events; let i = lowerEv(EV, cur - 0.7); for (; i < EV.length && EV[i].r <= cur; i++) { const ev = EV[i], age = (cur - ev.r) / 0.7, al = 1 - age;
      if (ev.to && (ev.k === 'shot' || ev.k === 'guardShot')) { ctx.beginPath(); ctx.moveTo(ev.x, ev.z); ctx.lineTo(ev.to[0], ev.to[1]); ctx.strokeStyle = `rgba(255,236,160,${al})`; ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.beginPath(); ctx.arc(ev.to[0], ev.to[1], 0.07, 0, 7); ctx.fillStyle = `rgba(255,236,160,${al})`; ctx.fill(); }
      else { const big = ev.k === 'bang' || ev.k === 'frag'; ctx.beginPath(); ctx.arc(ev.x, ev.z, (big ? 0.5 + 3 * age : 0.25 + 0.6 * age), 0, 7); ctx.strokeStyle = big ? `rgba(255,156,58,${al})` : `rgba(122,184,255,${al})`; ctx.lineWidth = (big ? 2.5 : 1.5) * px; ctx.stroke(); } } }
  // ---- the men
  for (const { ci, at } of men) {
    const dd = at.do, dead = dd.st === 'dead' || dd.st === 'down', col = colOf(ci), on = ci === sel || ci === hover, R = 0.26;
    const fx = Math.sin(at.aim * RAD), fz = Math.cos(at.aim * RAD);
    if (!dead) { ctx.beginPath(); ctx.moveTo(at.x + fx * R, at.z + fz * R); ctx.lineTo(at.x + fx * 1.5, at.z + fz * 1.5); ctx.strokeStyle = col; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.arc(at.x, at.z, dd.crouch ? R * 0.8 : R, 0, 7); ctx.fillStyle = dead ? '#4a5456' : col; ctx.globalAlpha = dead ? 0.8 : 1; ctx.fill(); ctx.globalAlpha = 1;
    if (!dead) { const bx = Math.sin(at.yaw * RAD), bz = Math.cos(at.yaw * RAD); ctx.beginPath(); ctx.moveTo(at.x, at.z); ctx.lineTo(at.x + bx * R, at.z + bz * R); ctx.strokeStyle = '#0c0b09'; ctx.lineWidth = 2 * px; ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(at.x - 0.15, at.z - 0.15); ctx.lineTo(at.x + 0.15, at.z + 0.15); ctx.moveTo(at.x - 0.15, at.z + 0.15); ctx.lineTo(at.x + 0.15, at.z - 0.15); ctx.strokeStyle = '#0c0b09'; ctx.lineWidth = 2 * px; ctx.stroke(); }
    const ring = on ? '#ffffff' : !dead ? RING[dd.st ?? ''] : undefined; const pair = F.cast[ci].pair;
    if (ring) { ctx.beginPath(); ctx.arc(at.x, at.z, R + 0.09, 0, 7); ctx.strokeStyle = ring; ctx.lineWidth = 2 * px; ctx.stroke(); }
    else if (pair && !dead) { ctx.beginPath(); ctx.arc(at.x, at.z, R + 0.07, 0, 7); ctx.strokeStyle = pair === 'red' ? '#ff9a8a' : '#9ac8ff'; ctx.lineWidth = 1.5 * px; ctx.stroke(); }
  }
  // ---- Sam's reticle on the floor
  { const ap = D.aim[s]; if (ap) { ctx.beginPath(); ctx.arc(ap[0], ap[1], 0.12, 0, 7); ctx.strokeStyle = 'rgba(244,255,248,0.6)'; ctx.lineWidth = px; ctx.stroke(); } }
  // ---- screen space: names, words, notes
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
  const names = ($<HTMLInputElement>('names')).checked;
  for (const { ci, at } of men) {
    const dd = at.do, on = ci === sel || ci === hover, dead = dd.st === 'dead' || dd.st === 'down'; const [X, Y] = w2s(at.x, at.z);
    if (names || on) { ctx.fillStyle = dead ? '#7a7466' : colOf(ci); ctx.textAlign = 'center'; ctx.fillText(F.cast[ci].name, X, Y + 0.26 * S + 9); }
    if (dd.say && !dead) { const t = dd.say.length > 64 ? dd.say.slice(0, 62) + '…' : dd.say, w = ctx.measureText(t).width + 10; ctx.fillStyle = 'rgba(12,11,9,0.85)'; ctx.fillRect(X - w / 2, Y - 0.26 * S - 22, w, 15); ctx.fillStyle = '#f0e9d9'; ctx.textAlign = 'center'; ctx.fillText(t, X, Y - 0.26 * S - 14); }
  }
  F.notes.forEach((n, i) => { if (!n.pos) return; const near = Math.abs(n.r - cur) < 1.5, [X, Y] = w2s(n.pos[0], n.pos[1]);
    ctx.globalAlpha = near ? 1 : 0.3; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 6, Y - 16); ctx.lineTo(X + 6, Y - 16); ctx.closePath(); ctx.fillStyle = '#e8c46a'; ctx.fill();
    ctx.fillStyle = '#140d05'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), X, Y - 11); ctx.globalAlpha = 1; });
}
function lowerEv(EV: ReplayEvent[], r: number): number { let lo = 0, hi = EV.length; while (lo < hi) { const m = (lo + hi) >> 1; if (EV[m].r < r) lo = m + 1; else hi = m; } return lo; }

// ================================================================================================================================ the timeline
function drawTimeline() {
  const dpr = size(tl), W = tl.clientWidth, H = tl.clientHeight; tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.fillStyle = '#151310'; tctx.fillRect(0, 0, W, H);
  if (!D || !F) return; const E = end() || 1, X = (r: number) => 4 + (W - 8) * r / E;
  tctx.fillStyle = '#25221c'; tctx.fillRect(4, 14, W - 8, 20);
  tctx.font = '9px ui-monospace, Menlo, monospace'; tctx.textBaseline = 'middle'; tctx.textAlign = 'center';
  const every = E > 240 ? 60 : E > 90 ? 30 : 10; tctx.fillStyle = '#857d69'; for (let t = 0; t <= E; t += every) { tctx.fillRect(X(t), 34, 1, 4); tctx.fillText(clock(t).replace(/\.\d$/, ''), X(t), 41); }
  for (const ev of F.events) { const big = ev.k === 'bang' || ev.k === 'frag', shot = ev.k === 'shot' || ev.k === 'guardShot'; tctx.fillStyle = big ? '#ff9c3a' : shot ? (ev.k === 'shot' ? '#ffeca0' : '#ff7a6a') : '#5f7385'; tctx.fillRect(X(ev.r), big ? 14 : shot ? 20 : 28, big ? 2 : 1, big ? 20 : shot ? 14 : 6); }
  for (const l of F.lines) { if (l.k === 'order') { tctx.fillStyle = '#e8c46a'; tctx.fillRect(X(l.r) - 1, 15, 3, 3); } else if (l.k === 'mark') { const err = isErrorMark(l); tctx.fillStyle = err ? '#ff6b6b' : '#ffffff'; tctx.fillRect(X(l.r), 12, err ? 2 : 1, 24); } }
  F.notes.forEach((n, i) => { const x = X(n.r); tctx.beginPath(); tctx.moveTo(x, 14); tctx.lineTo(x - 6, 1); tctx.lineTo(x + 6, 1); tctx.closePath(); tctx.fillStyle = '#e8c46a'; tctx.fill(); tctx.fillStyle = '#140d05'; tctx.fillText(String(i + 1), x, 6); });
  tctx.fillStyle = '#f0e9d9'; tctx.fillRect(X(cur) - 1, 10, 2, 28);
}
{ let drag = false; const at = (e: MouseEvent) => { const b = tl.getBoundingClientRect(); seek(end() * (e.clientX - b.left - 4) / Math.max(1, b.width - 8)); };
  tl.addEventListener('mousedown', e => { if (!D) return; drag = true; playing = false; at(e); });
  window.addEventListener('mousemove', e => { if (drag) at(e); }); window.addEventListener('mouseup', () => { drag = false; }); }

// ================================================================================================================================ the side: notes, the picked man, the log
function noteAt(pos: [number, number] | null) {
  if (!D || !F) return; playing = false;
  F.notes = F.notes.filter(n => n.text.trim());   // (a note left without words is no note)
  const s = sampleAt(D, cur), q = F.samples[s];
  const n: ReplayNote = { id: `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, r: Math.round(cur * 1000) / 1000, t: q?.t ?? 0, n: q?.n ?? 0, pos: pos ? [Math.round(pos[0] * 100) / 100, Math.round(pos[1] * 100) / 100] : null, text: '', at: new Date().toISOString() };
  F.notes.push(n); F.notes.sort((a, b) => a.r - b.r); notesDirty = true; renderNotes(n.id); keep();
}
function renderNotes(focusId?: string) {
  notesDirty = false; const box = $('notes'); box.textContent = '';
  if (!F || !F.notes.length) return;   // (no notes: nothing drawn. How to make one is the '+ Note' button's tooltip and the Keys list)
  F.notes.forEach((n, i) => {
    const el = document.createElement('div'); el.className = 'note'; el.dataset.r = String(n.r);
    const top = document.createElement('div'); top.className = 'top'; top.title = 'jump to this moment';
    const no = document.createElement('b'); no.textContent = `#${i + 1}`; const when = document.createElement('span'); when.textContent = `${clock(n.r)}${n.pos ? ` · (${n.pos[0]}, ${n.pos[1]})` : ' · no spot'}`;
    const x = document.createElement('i'); x.textContent = '✕'; x.title = 'delete this note';
    x.onclick = ev => { ev.stopPropagation(); F!.notes.splice(F!.notes.indexOf(n), 1); renderNotes(); keep(); };
    top.onclick = () => { playing = false; seek(n.r); if (n.pos) { const [X, Y] = w2s(n.pos[0], n.pos[1]); if (X < 40 || Y < 40 || X > map.clientWidth - 40 || Y > map.clientHeight - 40) { view.cx = n.pos[0]; view.cz = n.pos[1]; } } };
    top.append(no, when, x);
    const ta = document.createElement('textarea'); ta.value = n.text; ta.placeholder = 'what went wrong here?'; ta.spellcheck = false;
    ta.oninput = () => { n.text = ta.value; keep(); };
    ta.onchange = () => flush();
    ta.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ta.blur(); } if (ev.key === 'Escape') ta.blur(); };
    ta.onblur = () => { flush(); if (!document.hasFocus()) return;   // (the WINDOW lost focus — a look at the game before typing: the note waits)
      if (!n.text.trim() && F) { const j = F.notes.indexOf(n); if (j >= 0) { F.notes.splice(j, 1); renderNotes(); keep(); } } };   // (a note with no words is no note: a stray click leaves nothing behind)
    el.append(top, ta); box.append(el); if (n.id === focusId) setTimeout(() => ta.focus(), 0);
  });
}
/** the notes changed: written back to this browser's shelf soon (the row alone — shelf.ts), and at once when the words are left, the page hidden or another file opened */
let dirty = false, writing: Promise<unknown> = Promise.resolve();   // (the notes' writes still on their way: a page that leaves waits for them)
function keep() { if ((shelfId === null && keptSid === null) || !F) return; dirty = true; clearTimeout(saveT); saveT = window.setTimeout(flush, 250); }
function flush() { clearTimeout(saveT); if (!dirty || (shelfId === null && keptSid === null) || !F) return; dirty = false; const N = F.notes.filter(n => n.text.trim());
  const w = shelfId !== null ? shelfNotes(shelfId, N) : keptSid !== null ? keptStore().patch(keptSid, { notes: N, noted: true }) : null; if (w) writing = Promise.all([writing, Promise.resolve(w).catch(() => { /* */ })]); }
window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
/** The picked (or hovered) man's card: over the foot of the side column, and the log's scroll makes room for it (`--who`), so no line of the log moves or
 *  hides when he is picked. Nobody picked = no card. */
function showWho(on: boolean) { const p = $('picked'); p.hidden = !on; $('unpick').hidden = sel === null; $('side').style.setProperty('--who', on ? `${p.offsetHeight}px` : '0px'); restLog(); }
function renderWho(men: { ci: number; at: ManAt }[]) {
  const head = $('whoHead'), box = $('who');
  const ci = sel ?? hover; const m = ci === null ? undefined : men.find(q => q.ci === ci);
  const key = ci === null ? '' : `${ci}|${sel !== null}|${m ? `${m.at.x.toFixed(1)},${m.at.z.toFixed(1)},${JSON.stringify(m.at.do)}` : 'gone'}`; if (key === whoKey) return; whoKey = key;
  if (ci === null || !F) { showWho(false); return; }
  const c = F.cast[ci]; head.textContent = `${c.name} · ${c.team}${c.pair ? ` (${c.pair})` : ''}${c.weapon ? ` · ${c.weapon}` : ''}`;
  if (!m) { box.textContent = 'not on the floor at this moment'; showWho(true); return; }
  const d: ManDo = m.at.do, rows: [string, string][] = [['at', `(${m.at.x.toFixed(2)}, ${m.at.z.toFixed(2)}) facing ${Math.round(m.at.yaw)}°, gun ${Math.round(m.at.aim)}°`]];
  if (d.st) rows.push(['state', `${d.st}${d.down ? ` (${d.down})` : ''}${d.crouch ? ', crouched' : ''}`]);
  rows.push([c.kind === 'player' ? 'lit' : 'aware', `${m.at.aw} %`]);
  if (d.ord) rows.push(['order', d.ord]); if (d.by) rows.push(['feet', `not his own: ${d.by}`]); if (d.task) rows.push(['errand', d.task]);
  if (d.slot) rows.push(['hands', d.slot]); if (d.noise) rows.push(['noise', String(d.noise)]);
  if (d.goal) rows.push(['going to', `(${d.goal[0]}, ${d.goal[1]}), ${Math.hypot(d.goal[0] - m.at.x, d.goal[1] - m.at.z).toFixed(1)} m off`]);
  if (d.path?.length) { let len = 0, px = m.at.x, pz = m.at.z; for (const p of d.path) { len += Math.hypot(p[0] - px, p[1] - pz); px = p[0]; pz = p[1]; } rows.push(['route', `${d.path.length} points, ${len.toFixed(1)} m: ${d.path.slice(0, 6).map(p => `(${p[0]}, ${p[1]})`).join(' ')}${d.path.length > 6 ? ' …' : ''}`]); }
  else if (d.st !== 'dead' && c.kind !== 'player') rows.push(['route', 'none']);
  if (d.foe !== undefined && d.foe >= 0) rows.push(['gun on', F.cast[d.foe]?.name ?? '?']); if (d.fix) rows.push(['last fix', `(${d.fix[0]}, ${d.fix[1]})`]);
  if (d.sup) rows.push(['under fire', String(d.sup)]); if (d.say) rows.push(['says', `“${d.say}”`]);
  box.textContent = ''; for (const [k, v] of rows) { const ln = document.createElement('div'); const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k; ln.append(kk, v); box.append(ln); }
  showWho(true);
}
function buildLog() {
  const box = $('log'); box.textContent = ''; if (!F) return;
  const frag = document.createDocumentFragment();
  F.lines.forEach(l => { const d = document.createElement('div'); d.className = l.k; const b = document.createElement('b'); b.textContent = clock(l.r); d.append(b, l.text); d.title = l.text; d.onclick = () => { playing = false; seek(l.r); }; frag.append(d); });
  box.append(frag);
}
function updateLog() {
  if (!F) return; const L = F.lines; let lo = 0, hi = L.length; while (lo < hi) { const m = (lo + hi) >> 1; if (L[m].r <= cur) lo = m + 1; else hi = m; }
  const at = lo - 1; if (at === logAt) return; const kids = $('log').children;
  for (let i = Math.max(0, Math.min(at, logAt) - 1); i <= Math.min(kids.length - 1, Math.max(at, logAt) + 1); i++) { const k = kids[i] as HTMLElement; const base = L[i].k; k.className = `${base}${i < at ? ' past' : i === at ? ' now' : ''}`; }
  logAt = at; restLog();
}
/** The list put right for the line being played: asked when that line changes and when the box itself changes size (a note added, the window). */
function restLog() {
  const kids = $('log').children, at = logAt;
  if (at >= 0 && ($<HTMLInputElement>('follow')).checked) followLog(kids[at] as HTMLElement | undefined, kids[Math.max(0, at - 2)] as HTMLElement | undefined);
}
/** Keep the line being played in view: when it is out of the box (or under the picked man's card) the list is put with the line two before it at the
 *  very top, on a row's own edge, so no row is left half under the heading. */
function followLog(now?: HTMLElement, top?: HTMLElement) {
  if (!now || !top) return; const log = $('log'), who = $('picked').hidden ? 0 : $('picked').offsetHeight;
  const y = now.offsetTop - log.offsetTop, h = now.offsetHeight, lo = log.scrollTop, hi = lo + log.clientHeight - who - 8;
  if (y < lo || y + h > hi) { log.scrollTop = top.offsetTop - log.offsetTop; return; }
  // In view: the list still rests on a row's own edge (a scroll stopped by the list's end, or by hand, is on no edge once the box changes size).
  const K = log.children; let a = 0, b = K.length - 1;
  while (a < b) { const m = (a + b) >> 1, k = K[m] as HTMLElement; if (k.offsetTop - log.offsetTop + k.offsetHeight > lo + 1) b = m; else a = m + 1; }
  const t = (K[a] as HTMLElement).offsetTop - log.offsetTop; if (Math.abs(t - lo) > 1) log.scrollTop = t;
}

// ================================================================================================================================ hands
function manUnder(X: number, Y: number): number | null {
  let best: number | null = null, bd = Math.max(14, 0.4 * view.s);
  for (const { ci, at } of menAt(cur)) { const [x, y] = w2s(at.x, at.z), d = Math.hypot(x - X, y - Y); if (d < bd) { bd = d; best = ci; } }
  return best;
}
{ let down: { x: number; y: number; cx: number; cz: number; moved: boolean } | null = null;
  map.addEventListener('mousedown', e => { if (!D) return; down = { x: e.offsetX, y: e.offsetY, cx: view.cx, cz: view.cz, moved: false }; });
  map.addEventListener('mousemove', e => {
    if (!D) return;
    if (down) { const dx = e.offsetX - down.x, dy = e.offsetY - down.y; if (down.moved || Math.hypot(dx, dy) > 4) { down.moved = true; const c = Math.cos(view.rot), s = Math.sin(view.rot), a = dx / view.s, b = dy / view.s; view.cx = down.cx - (a * c + b * s); view.cz = down.cz - (-a * s + b * c); } return; }
    hover = manUnder(e.offsetX, e.offsetY); const tip = $('tip');
    if (hover !== null && F) { const m = menAt(cur).find(q => q.ci === hover); tip.textContent = `${F.cast[hover].name}${m ? ` · ${doWords({ ...m.at.do, path: undefined }, F.cast)}` : ''}`; tip.style.display = 'block'; tip.style.left = `${Math.min(map.clientWidth - 300, e.offsetX + 14)}px`; tip.style.top = `${e.offsetY + 14}px`; }
    else tip.style.display = 'none';
    const [wx, wz] = s2w(e.offsetX, e.offsetY); const h = $('hint'); if (!h.style.color) h.textContent = F ? `${wx.toFixed(1)}, ${wz.toFixed(1)}` : '';
  });
  map.addEventListener('mouseleave', () => { hover = null; $('tip').style.display = 'none'; });
  window.addEventListener('mouseup', e => {
    const d = down; down = null; if (!d || d.moved || !D || e.target !== map) return;
    const ci = manUnder(d.x, d.y); if (ci !== null) { sel = sel === ci ? null : ci; return; }
    noteAt(s2w(d.x, d.y));
  });
  map.addEventListener('wheel', e => { if (!D) return; e.preventDefault(); const [wx, wz] = s2w(e.offsetX, e.offsetY); view.s = Math.min(160, Math.max(3, view.s * Math.exp(-e.deltaY * 0.0015))); const [nx, nz] = s2w(e.offsetX, e.offsetY); view.cx += wx - nx; view.cz += wz - nz; }, { passive: false }); }
window.addEventListener('keydown', e => {
  const t = e.target as HTMLElement | null, tag = t?.tagName ?? '';
  if (!D || e.metaKey || e.ctrlKey || e.altKey || tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(checkbox|file)$/.test((t as HTMLInputElement).type))) return;
  if (tag === 'SELECT' || tag === 'INPUT' || tag === 'BUTTON' || tag === 'SUMMARY') t!.blur();   // (a ticked box, the speed list, a pressed button: the keys are the map's again)
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); step(+1, e.shiftKey); } else if (e.code === 'ArrowLeft') { e.preventDefault(); step(-1, e.shiftKey); }
  else if (e.code === 'KeyF') fit(); else if (e.code === 'KeyN') { e.preventDefault(); noteAt(null); } else if (e.code === 'Escape') { sel = null; ($<HTMLDetailsElement>('keys')).open = false; }
  else if (e.code === 'Home') seek(0); else if (e.code === 'End') seek(end());
});
function togglePlay() { if (!D) return; if (!playing && cur >= end() - 1e-3) cur = 0; playing = !playing; }
$('play').onclick = () => togglePlay();
$('unpick').onclick = () => { sel = null; };
window.addEventListener('mousedown', e => { const k = $<HTMLDetailsElement>('keys'); if (k.open && !k.contains(e.target as Node)) k.open = false; });   // (the Keys list shuts on a click beside it)
$<HTMLSelectElement>('speed').onchange = e => { speed = Number((e.target as HTMLSelectElement).value) || 1; (e.target as HTMLElement).blur(); };
for (const id of ['turn', 'routes', 'names', 'follow']) $(id).addEventListener('change', e => (e.target as HTMLElement).blur());
$('follow').addEventListener('change', restLog);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(restLog).observe($('log'));
$('addNote').onclick = () => noteAt(null);
{ const sayKept = (t: string) => { $('keptLine').textContent = t; };
  $('dumpNew').onclick = () => void dumpNow({}, sayKept).then(d => { if (d) setTimeout(() => void showKept(), 4000); });
  $('dumpAll').onclick = () => void dumpNow({ all: true }, sayKept).then(d => { if (d) setTimeout(() => void showKept(), 4000); }); }
$('shelfBtn').onclick = () => { history.replaceState(null, '', location.pathname + location.search); void showShelf(); };
$<HTMLInputElement>('file').onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void openFromDisk(f); (e.target as HTMLInputElement).value = ''; };
// (a page the browser's Back hands back AS IT WAS LEFT holds the notes of then: one typed since on the engine replay is on the shelf, and the next write here
// would lose it — the shelf's notes are read again. Only the notes: the scrub, the zoom and a file opened from disk, which no shelf holds, stay as they were)
window.addEventListener('pageshow', e => { const id = shelfId; if (!e.persisted || id === null || dirty) return;
  void shelfGet(id).then(row => { if (row && F && shelfId === id && !dirty) { F.notes = row.notes ?? []; notesDirty = true; } }).catch(() => { /* */ }); });
// ('‹ Game' is the way back to the game this replay was left for — its own entry in this window's history, else its address — and the title page only for a
// replay that came from no game: format.ts backToGame)
$('back').onclick = e => { const home = $<HTMLAnchorElement>('back').href; if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); flush(); void writing.then(() => backToGame(shelfId, home)); };
// (this window goes to the game page — never a new tab — once a note typed a moment ago is on the shelf for it to read; a held key is the visitor's own choice of tab)
$('engine').onclick = e => { const to = $<HTMLAnchorElement>('engine').href; flush(); if (!to || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); void writing.then(() => location.assign(to)); };
$('export').onclick = async () => {
  if (!F) return; flush(); const name = await downloadReplay(F);
  const h = $('hint'); h.textContent = `${name} downloaded: drop it in a thread`; h.style.color = '#f0e9d9'; setTimeout(() => { h.style.color = ''; }, 5000);
};
window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drop'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drop'); });
window.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('drop'); const f = e.dataTransfer?.files?.[0]; if (f) void openFromDisk(f); });
window.addEventListener('hashchange', () => void boot());

// ================================================================================================================================ the loop
function frame(now: number) {
  const dt = Math.min(0.1, (now - lastWall) / 1000); lastWall = now;
  if (D && playing) { cur += dt * speed; if (cur >= end()) { cur = end(); playing = false; } }
  drawMap(); drawTimeline();
  if (D && F) {
    const s = sampleAt(D, cur), q = F.samples[s];
    const ck = $('clock'), tt = q ? `game clock ${clock(q.t)}` : ''; ck.innerHTML = ''; ck.append(`${clock(cur)} / ${clock(end())}`); const sp = document.createElement('span'); sp.textContent = q ? `step ${q.n}` : ''; ck.append(sp); if (ck.title !== tt) ck.title = tt;
    $('play').textContent = playing ? 'Pause' : 'Play';
    renderWho(menAt(cur)); updateLog();
    if (notesDirty) renderNotes();
    for (const el of Array.from($('notes').children) as HTMLElement[]) if (el.dataset.r) el.classList.toggle('near', Math.abs(Number(el.dataset.r) - cur) < 1.5);
  }
  requestAnimationFrame(frame);
}
async function boot() {
  const h = location.hash; const m = /id=(\d+)/.exec(h);
  if (m) { if (shelfId !== Number(m[1])) await openFromShelf(Number(m[1])); if (D) return; }
  else if (/kept=([\w-]+)/.test(h)) { await openKept(/kept=([\w-]+)/.exec(h)![1]); if (D) return; }
  else if (/latest/.test(h)) { const rows = await shelfList(); if (rows.length) { await openFromShelf(rows[0].id); if (D) return; } }
  await showShelf();
}
/** for a script driving the page (and the page's own check): the open file, a way in without the shelf, the clock */
(window as unknown as Record<string, unknown>).__viewer = { open: (f: ReplayFile) => open(f, null), get file() { return F; }, get cur() { return cur; }, seek, noteAt, get view() { return view; }, w2s, s2w, sel: (ci: number | null) => { sel = ci; } };
void boot(); requestAnimationFrame(frame);
