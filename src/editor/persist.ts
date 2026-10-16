// Saving and loading the editor's document: a JSON download, the localStorage autosave slot (every 30 s + on unload), the dev server's level
// files (tools/serve.ts: GET /levels/ → index, GET/POST /levels/<name>.json), and the 'play from here' hand-over slot the game reads with
// ?level=local (the one-line hook in scene/level.ts buildLevel — see docs/level-format.md 'Editor'). All text is the canonical serialization.
import type { Editor } from './editor';
import type { LevelData } from '../scene/levelData';
import { scenarioQuery, type ScenarioEntry } from '../scene/scenarios';
import { ALL_MISSIONS } from '../scene/scenarioList';   // (pure tables: nothing of the game)
import { LOOK_LEVELS } from '../scene/look';

export const LS = {
  autosave: 'twopointsix.editor.autosave',   // { name, t (ms), digest, text, file? }
  play: 'twopointsix.editorLevel',            // the level text the game boots from under ?level=local
  prefs: 'twopointsix.editor.prefs',          // { quality, inspW, … } page chrome
};
export interface AutosaveSlot { name: string; t: number; digest: string; text: string; /** the server file the document had been loaded from (Editor.file; absent in a slot from before the key, and for a document from nowhere) */ file?: string | null }
export interface ServerEntry { name: string; bytes: number; mtime: number }

const store = (): Storage | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

/** write the autosave slot; returns what was written (null if storage is unavailable / full) */
export function autosave(ed: Editor): AutosaveSlot | null {
  const s = store(); if (!s) return null;
  const slot: AutosaveSlot = { name: ed.data.name, t: Date.now(), digest: ed.doc.digest(), text: ed.serialize(), ...(ed.file ? { file: ed.file } : {}) };
  try { s.setItem(LS.autosave, JSON.stringify(slot)); return slot; } catch { return null; }
}
export function readAutosave(): AutosaveSlot | null {
  const s = store(); if (!s) return null;
  try { const raw = s.getItem(LS.autosave); if (!raw) return null; const o = JSON.parse(raw); return o && typeof o.text === 'string' ? o as AutosaveSlot : null; } catch { return null; }
}
/** The autosave PROTOCOL of one editor session (app.ts wires its 30 s timer and the unload to `tick`; the probes drive it headless): the slot is only ever
 *  overwritten by a session that OWNS it. `restore()` (a #autosave boot) opens the slot leniently — a level with problems opens WITH them listed — and when
 *  the slot cannot be opened at all (text that is no level) it leaves the current document up as a stand-in, records why, and HOLDS every write until the
 *  user has edited: closing the tab straight away must not replace the user's level with the stand-in (review T4.1 — a restore that failed used to be
 *  overwritten by the office thirty seconds later or on unload). */
export class AutosaveSession {
  held = false; private holdRev = -1;
  /** why the boot did not come up on the slot's own document (null = it did, or no restore was asked for) — the page words it */
  bootError: string | null = null;
  /** the last slot this session wrote */
  last: AutosaveSlot | null = null;
  constructor(readonly ed: Editor) {}
  /** boot-time restore of the slot INTO the editor: `errors` = the problems it opened with; ok false = nothing was loaded (empty slot / not a level) */
  restore(): { ok: boolean; errors: string[] } {
    const a = readAutosave();
    if (!a) { this.bootError = 'no autosave slot to restore — the bundled office is up instead'; return { ok: false, errors: [] }; }
    try { const errors = this.ed.load(a.text, { keepSaved: true, lenient: true, file: a.file ?? null }); return { ok: true, errors }; }
    catch (e) { this.hold(`the autosave slot ('${a.name}', ${new Date(a.t).toLocaleString()}) could not be opened — ${String((e as Error)?.message ?? e).split('\n')[0]} — the bundled office is up INSTEAD and the slot is left untouched until you edit`); return { ok: false, errors: [] }; }
  }
  /** stop writing until the user's first real edit after now (the document is a stand-in for one the session failed to open) */
  hold(why: string) { this.held = true; this.holdRev = this.ed.doc.rev; this.bootError = why; }
  /** may this session write the slot right now? (the first edit after a hold releases it: from then on the document is the user's again) */
  mayWrite(): boolean { if (this.held && this.ed.doc.rev !== this.holdRev && this.ed.doc.dirty) this.held = false; return !this.held; }
  /** the timer's / unload's write: when allowed, and when there is something to write (unsaved changes, an empty slot, or `always` = the unload) */
  tick(always = false): AutosaveSlot | null {
    if (!this.mayWrite()) return null;
    if (always && !this.ed.doc.dirty && this.last === null) return null;   // the unload of a session that never edited anything must not overwrite the slot (opening /viewer → the workbench and closing the tab wiped an earlier session's unsaved level — wave-3 review 08-12)
    if (!(always || this.ed.doc.dirty || !readAutosave())) return null;
    const s = autosave(this.ed); if (s) this.last = s; return s;
  }
}
/** WHAT '▶ play from here' CAN START on a document: the plain night, and each mission its `scenarios` block carries, as the query keys the page starts it by
 *  (scene/scenarioList.ts specOfQuery — `roomclear` (+ `squad4`), `rescue` (+ `squad=4`), `quiet` (+ `squad=1`), `nightbreach`; a `lesson` block rides whichever of
 *  them is started and has no key). `?level=local` alone names no mission: the page comes up on the start card over the document's own routes, which on a level
 *  built for a squad is an empty building. A document of the office family with no block of its own gets the office's (levels/office.scenarios.ts, attached by
 *  scene/level.ts buildLevel). `row` = the mission list's row for the file it was loaded from, where there is one: its team size and seed are the choice's. */
export interface PlayChoice { id: string; label: string; query: string; row?: ScenarioEntry }
export function playChoices(data: LevelData, file: string | null = null): PlayChoice[] {
  const office = data.name === 'office' || data.name.startsWith('office-'), S: any = data.scenarios ?? (office ? { nightBreach: {}, roomClear: {}, rescue: {} } : {});
  const rows = office && !data.scenarios ? ALL_MISSIONS.filter(e => !e.level) : rowsOf(data, file), lesson = S.lesson ? ' + its lesson' : '';
  const out: PlayChoice[] = [{ id: 'solo', label: 'solo night (start card)', query: '' }];
  const add = (kind: ScenarioEntry['kind'], squad: ScenarioEntry['squad'], label: string) => {
    const row = rows.find(e => e.kind === kind && e.squad === squad), q = scenarioQuery({ id: '', title: '', kind, squad, seed: row?.seed });
    out.push({ id: `${kind}${squad}`, label: label + lesson, query: q.slice(1), row });
  };
  if (S.roomClear) { add('roomclear', 2, 'room clear · the pair'); add('roomclear', 4, 'room clear · the four'); }
  if (S.rescue) { add('rescue', 2, 'hostage rescue · the pair'); if (S.rescue.side?.pair || rows.some(e => e.kind === 'rescue' && e.squad === 4)) add('rescue', 4, 'hostage rescue · the four'); }
  if (S.quiet) { add('quiet', 0, 'quiet · alone'); add('quiet', 1, 'quiet · as two'); }
  if (S.nightBreach && data.plans?.breach) add('nightbreach', 2, 'night breach');
  return out;
}
/** the choice the button takes when nobody picked one: the mission list's FIRST row for this file; with no row, the first mission the block carries (room clear
 *  with the pair, else the rescue, else the quiet mission alone); the office family and a document with no block: the plain night */
export function playDefault(data: LevelData, file: string | null = null): PlayChoice {
  const C = playChoices(data, file), office = data.name === 'office' || data.name.startsWith('office-');
  if (office && !data.scenarios) return C[0];
  const first = rowsOf(data, file)[0];
  return (first && C.find(c => c.row === first)) ?? C[1] ?? C[0];
}
/** the mission list's rows played on this document's file (the file it was loaded from, else its name; a look file answers for the plain file it is the look of) */
function rowsOf(data: LevelData, file: string | null): ScenarioEntry[] {
  const f = `${file ?? data.name}.json`, plain = Object.keys(LOOK_LEVELS).find(k => LOOK_LEVELS[k] === f) ?? f;
  return ALL_MISSIONS.filter(e => e.level === plain);
}
/** put the current document where the game's ?level=local looks; returns the URL to open. `as` = a playChoices id (absent / unknown: playDefault) */
export function stashForPlay(ed: Editor, as?: string): string {
  const s = store(); if (!s) throw new Error('localStorage unavailable — cannot hand the level to the game');
  s.setItem(LS.play, ed.serialize());
  const dev = typeof location !== 'undefined' && /^\/(editor|workbench)\/?$/.test(location.pathname);   // a dev-server route (the game is at /) vs a built page (the game is index.html beside it — tools/serve.ts also answers /index.html, so either form opens under the dev server)
  const c = playChoices(ed.data, ed.file).find(x => x.id === as) ?? playDefault(ed.data, ed.file);
  return `${dev ? '/' : 'index.html'}?level=local${c.query ? '&' + c.query : ''}`;
}
/** the look pair of a level file (scene/look.ts LOOK_LEVELS), in the load menu's words: '' for a file with none */
export function lookNote(name: string): string {
  const played = LOOK_LEVELS[`${name}.json`]; if (played) return ` · played as ${played} unless ?look=plain`;
  const plain = Object.keys(LOOK_LEVELS).find(k => LOOK_LEVELS[k] === `${name}.json`); return plain ? ` · the default look of ${plain} (generated with it)` : '';
}
/** browser download of the level text as <name>.json */
export function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${name.replace(/[^A-Za-z0-9_.-]/g, '_') || 'level'}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// ---- the dev server's level files (same origin; the server refuses cross-origin writes)
export async function serverList(base = ''): Promise<ServerEntry[] | null> {
  try { const r = await fetch(`${base}/levels/`, { headers: { Accept: 'application/json' } }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j.levels) ? j.levels as ServerEntry[] : null; } catch { return null; }
}
export async function serverLoad(name: string, base = ''): Promise<string> {
  const r = await fetch(`${base}/levels/${encodeURIComponent(name)}.json`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`GET /levels/${name}.json: ${r.status} ${await r.text().catch(() => '')}`.trim());
  return r.text();
}
/** the optional lint sidecar next to a level (levels/<name>.lint.json) — null when there is none */
export async function serverLintAllow(name: string, base = ''): Promise<Record<string, { ids: string[] | '*'; reason: string }> | null> {
  try { const r = await fetch(`${base}/levels/${encodeURIComponent(name)}.lint.json`); if (!r.ok) return null; const j = await r.json(); return j?.allow ?? null; } catch { return null; }
}
export async function serverSave(name: string, text: string, base = ''): Promise<{ ok: boolean; name: string; bytes: number; path?: string }> {
  const r = await fetch(`${base}/levels/${encodeURIComponent(name)}.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: text });
  const body = await r.text(); let j: any = null; try { j = JSON.parse(body); } catch { /* */ }
  if (!r.ok) throw new Error(`POST /levels/${name}.json: ${r.status} ${j?.error ?? body}`.trim());
  return j;
}
