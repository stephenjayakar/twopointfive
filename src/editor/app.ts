// The editor as an APP that a page hosts: the document (Editor) → Scene → View → Tools → Overlay → Ui over an Engine the HOST made, window.__ed and the
// capture hooks, the chords, the autosave timer — and the frame in PIECES (input · sync · camera · render · ui) so a host can put its own things between
// them (the workbench stands a walking man in the level between sync and render). workbench/main.ts houses it as the Level and Materials / Markings
// modes (the standalone editor page that once booted it is gone; editor.html forwards into the workbench). See docs/level-format.md 'Editor'.
import type { Gpu } from '../gpu/device';
import type { Engine } from '../engine';
import { OFFICE_DATA } from '../scene/level';
import officeLintSidecar from '../../levels/office.lint.json' with { type: 'json' };
import { Input } from '../game/input';
import { frameCanvas, postShot } from '../ui/capture';
import { Editor } from './editor';
import { Scene } from './scene';
import { View } from './view';
import { Tools } from './tools';
import { Overlay } from './overlay';
import { Ui, UiEls } from './ui';
import { makeApi, EditorApi } from './api';
import * as persist from './persist';

export interface EditorAppHost {
  engine: Engine; gpu: Gpu; canvas: HTMLCanvasElement; olay: HTMLCanvasElement;
  /** a shared Input (the workbench's one); made here on the canvas otherwise */
  input?: Input;
  /** the quality preset switch the top bar's dropdown drives (name → apply; no arg → the current name) */
  quality: (name?: string) => string;
  /** chrome containers (the workbench's layout); absent = editor.html's ids */
  els?: Partial<UiEls>; brand?: string;
  /** chords (undo / redo / duplicate / save / select all), the painter keys and 'play' act only while this says so (the workbench: only in the level modes) */
  active?: () => boolean;
  /** what to open: a dev-server file, the autosave slot, a blank level — default: read location.hash like the page always did (#file= / #autosave / #blank) */
  boot?: { file?: string | null; autosave?: boolean; blank?: boolean };
  /** __ed.step drives the HOST's frame when given (the workbench: its whole frame, actor and all); default = this app's own frame1 */
  step?: (n: number, dt?: number) => void;
  /** is the 2D overlay part of the picture right now (composited into __edshot / __uishot)? — the workbench hides it outside the level modes */
  overlayOn?: () => boolean;
}

export interface EditorApp {
  ed: Editor; scene: Scene; view: View; tools: Tools; overlay: Overlay; ui: Ui; api: EditorApi; input: Input;
  /** seconds of level time (lights flicker off it) */
  time: number; frameCount: number;
  /** the frame in pieces: keys + tools + previews · document → engine · the camera · lights + render + overlay · the chrome */
  tickInput(dt: number): void; sync(): void; updateCamera(dt: number): void; render(dt: number, present: boolean): void; tickUi(): void;
  /** all of the pieces + input.endFrame — one standalone frame */
  frame1(dt: number, present: boolean): void;
  /** an idle tick: input / tools / UI only, no GPU */
  frameLite(dt: number): void;
  /** what one capture renders (the workbench swaps in its composite frame so a staged man is in the shot) */
  renderNow: () => void;
  shot(name: string, q?: number, withOverlay?: boolean): Promise<string>; uishot(name: string, q?: number): Promise<string>;
  /** the window hooks this app answers for (the page / the workbench assigns them onto window) */
  hooks: Record<string, unknown>;
  /** the HUD's two lines */
  hudLine(): string;
  fpsSm: number;
}

export async function createEditorApp(H: EditorAppHost): Promise<EditorApp> {
  const { engine, gpu, canvas, olay } = H; const active = H.active ?? (() => true); const overlayOn = H.overlayOn ?? (() => true);
  // ---- the document: bundled office by default; #file=<name> from the dev server; #autosave; #blank
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const boot = H.boot ?? { file: hash.get('file'), autosave: hash.has('autosave'), blank: hash.has('blank') };
  const officeAllow = (officeLintSidecar as any)?.allow;
  const ed = new Editor(OFFICE_DATA, { lintAllow: officeAllow });
  const server = { available: false, list: [] as persist.ServerEntry[] };
  { const list = await persist.serverList(); if (list) { server.available = true; server.list = list; } }
  // The autosave slot is only ever OVERWRITTEN by a session that owns it (persist.ts AutosaveSession): a #autosave boot opens the slot leniently — a level WITH
  // problems opens, problems listed — and one that cannot be opened at all leaves the office up as a stand-in with every autosave HELD until the user edits, so
  // closing the tab never replaces the user's level with the stand-in (review T4.1). `session.bootError` words it for the page.
  const session = new persist.AutosaveSession(ed);
  try {
    if (boot.file && server.available) { ed.load(await persist.serverLoad(boot.file), { lintAllow: (await persist.serverLintAllow(boot.file)) ?? undefined }); }
    else if (boot.autosave) session.restore();
    else if (boot.blank) ed.load(Editor.blank('untitled', OFFICE_DATA.materials));
  } catch (e) { console.error(e); session.bootError = `${boot.file ? `levels/${boot.file}.json` : 'the level'} could not be opened (${String((e as Error)?.message ?? e).split('\n')[0]}) — the bundled office is up instead; nothing was changed`; }

  const scene = new Scene(engine, ed);
  const view = new View();
  const tools = new Tools(ed, scene, view);
  const overlay = new Overlay(olay, ed, tools, view);
  // the Markings tab's painter keys ([ ] 1 2 3 0, arrows, H V, Del) claim a keydown BEFORE the game's Input (registered first on the same capture phase, so
  // stopImmediatePropagation keeps `[` `]` from also stepping the exposure and Delete from taking the box whose bitmap has the keys)
  let keyHook: ((e: KeyboardEvent) => boolean) | null = null;
  window.addEventListener('keydown', e => { if (active() && keyHook?.(e)) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
  const input = H.input ?? new Input(canvas);
  canvas.addEventListener('mousedown', () => { if (!active()) return; const ae = document.activeElement; if (ae instanceof HTMLElement && ae.closest('.pnl, #topbar, #palette')) ae.blur(); input.focusGame(); ui.closeMenus(); });

  const A = { time: 0, frameCount: 0, fpsSm: 60 } as EditorApp;
  const hudLine = () => { const t = engine.timer; const c = view.get(); const cur = tools.cursor3; return `${gpu.adapterInfo} · ${engine.width}×${engine.height} ${H.quality()} ×${engine.effectiveScale.toFixed(2)} · ${A.fpsSm.toFixed(0)} fps · gpu ${t.total(['composite', 'post', 'fxaa', 'gbuffer']).toFixed(1)} ms · boxes ${engine.world.all.length} · lights ${engine.lights.activeCount} · scene ${scene.stats.lastMs.toFixed(1)} ms${scene.error ? ' ⚠ ' + scene.error.slice(0, 60) : ''}\ncam yaw ${(c.yaw * 57.3).toFixed(0)}° pitch ${(c.pitch * 57.3).toFixed(0)}° dist ${c.dist.toFixed(1)} · ${view.plan ? 'PLAN' : 'orbit'} · floor ${ed.floorId} · tool ${tools.tool}/${tools.mode} · snap ${ed.settings.snap ? ed.settings.snapStep : 'off'}${cur ? ` · cursor (${cur[0].toFixed(2)}, ${cur[2].toFixed(2)})` : ''} · sel ${ed.sel.size} · view ${engine.settings.debugView} exp ${engine.settings.exposure.toFixed(2)}`; };
  const play = () => { try { const url = persist.stashForPlay(ed); window.open(url, '_blank'); ui.msg(`stashed ${ed.data.name} for the game (${persist.LS.play}) → ${url}`); return url; } catch (e) { ui.msg(String((e as Error).message)); return ''; } };
  const ui = new Ui({ ed, tools, view, scene, overlay, viewEl: canvas, quality: H.quality, play, hudLine, server, els: H.els, brand: H.brand });
  keyHook = e => ui.paintUi.key(e);
  (window as any).__edLoadBundled = () => ed.load(OFFICE_DATA as any, { lintAllow: officeAllow });

  // ---- the frame, in pieces
  const tickInput = (dt: number) => {
    view.w = canvas.clientWidth || view.w; view.h = canvas.clientHeight || view.h;
    if (input.hit('Backquote')) engine.settings.debugView = (engine.settings.debugView + (input.down('ShiftLeft') ? 10 : 1)) % 11;
    if (input.hit('BracketLeft')) engine.settings.exposure /= 1.25;
    if (input.hit('BracketRight')) engine.settings.exposure *= 1.25;
    tools.update(input, dt); canvas.style.cursor = tools.cursor;
    scene.preview = tools.previews();
  };
  const sync = () => scene.sync();
  const updateCamera = (dt: number) => { view.w = canvas.clientWidth || view.w; view.h = canvas.clientHeight || view.h; view.update(dt); };
  const render = (dt: number, present: boolean) => {
    A.time += dt;
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { engine.lights.update(dt, A.time); engine.render(view.cam, A.time, dt, present); overlay.draw(); }   // (rAF only runs while the pane is shown; scripted steps pass present=false except their last)
  };
  const tickUi = () => { A.frameCount++; ui.tick(A.frameCount); };
  const frame1 = (dt: number, present: boolean) => { tickInput(dt); sync(); updateCamera(dt); render(dt, present); input.endFrame(); tickUi(); };
  const frameLite = (dt: number) => { view.w = canvas.clientWidth || view.w; view.h = canvas.clientHeight || view.h; tools.update(input, dt); canvas.style.cursor = tools.cursor; input.endFrame(); tickUi(); };
  A.renderNow = () => { sync(); view.update(0); engine.lights.update(0, A.time); engine.render(view.cam, A.time, 1 / 60, false); };

  // ---- shots: like the game's __shot (offscreen render → JPEG → tools/shot-server.ts), with the overlay composited on top unless bare
  const shot = async (name: string, q = 0.86, withOverlay = true) => {
    A.renderNow();
    const c2 = await frameCanvas(engine); if (!c2) return 'no frame';
    let out: HTMLCanvasElement = c2;
    if (withOverlay && overlayOn()) { out = document.createElement('canvas'); out.width = c2.width; out.height = c2.height; const cx = out.getContext('2d')!; cx.drawImage(c2, 0, 0); overlay.draw(); cx.drawImage(olay, 0, 0, out.width, out.height); }
    const blob: Blob = await new Promise(res => out.toBlob(b => res(b!), 'image/jpeg', q));
    return `${c2.width}x${c2.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // ---- __uishot: the view (+ overlay) with the INSPECTOR column rasterised beside it (domshot.ts: DOM → SVG foreignObject → canvas) — the tabs are DOM,
  // not in the WebGPU frame, and a review page wants to show them
  const uishot = async (name: string, q = 0.9) => {
    A.renderNow();
    const c2 = await frameCanvas(engine); if (!c2) return 'no frame';
    const insp = document.getElementById('inspector')!; const { snapshotElement } = await import('./domshot');
    let side: HTMLCanvasElement | null = null; try { side = await snapshotElement(insp, 2); } catch (e) { console.error(e); }
    const scaleV = c2.height / Math.max(1, canvas.clientHeight);   // the view's backing-store px per CSS px
    const sideW = side ? Math.round(insp.clientWidth * scaleV) : 0;
    const out = document.createElement('canvas'); out.width = c2.width + sideW; out.height = c2.height; const cx = out.getContext('2d')!;
    cx.fillStyle = '#080c0e'; cx.fillRect(0, 0, out.width, out.height);
    cx.drawImage(c2, 0, 0); if (overlayOn()) { overlay.draw(); cx.drawImage(olay, 0, 0, c2.width, c2.height); }
    if (side) cx.drawImage(side, c2.width, 0, sideW, Math.round(insp.clientHeight * scaleV));
    const blob: Blob = await new Promise(res => out.toBlob(b => res(b!), 'image/jpeg', q));
    return `${out.width}x${out.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };

  // ---- window.__ed + friends
  const step = H.step ?? ((n: number, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame1(dt, i === n - 1); });
  const paintUi = ui.paintUi;
  const api = makeApi({ ed, tools, view, scene, step, shot, quality: H.quality, play, ui: {
    tab: (name) => { if (name) paintUi.show(name); return paintUi.tab; },
    paint: (name) => { if (name !== undefined) { if (!(name in ed.data.materials)) throw new Error(`no material '${name}'`); paintUi.paint = name; paintUi.show('materials'); } return paintUi.paint; },
    marking: (boxId, i, face) => { if (boxId !== undefined) { if (!ed.doc.get('boxes', boxId)) throw new Error(`no box '${boxId}'`); paintUi.mk.boxId = boxId; if (i !== undefined) paintUi.mk.i = i; if (face !== undefined) paintUi.mk.face = face as any; paintUi.show('markings'); } return { ...paintUi.mk }; },
    entry: (e) => { if (e !== undefined) paintUi.mk.entry = Math.max(0, Math.min(3, e | 0)); return paintUi.mk.entry; },
  } });
  const hooks = { __ed: api, __engine: engine, __cam: view.cam, __shot: (name: string, q?: number) => shot(name, q, false), __edshot: shot, __uishot: uishot, __tools: tools, __view: view, __scene: scene, __ui: ui };

  // ---- chords (capture, before Input): undo / redo / duplicate / save / select all — plain keys are Tools'
  window.addEventListener('keydown', e => {
    if (!active()) return;
    const t = e.target; if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || (t instanceof HTMLTextAreaElement && t.getAttribute('aria-label') !== 'game input')) return;   // (Input's off-screen sink when the page is framed is not a typing target)
    const mod = e.metaKey || e.ctrlKey; if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) ed.redo(); else ed.undo(); }
    else if (k === 'y') { e.preventDefault(); e.stopPropagation(); ed.redo(); }
    else if (k === 'd') { e.preventDefault(); e.stopPropagation(); if (ed.sel.size) ed.duplicate(ed.selection()); }
    else if (k === 's') { e.preventDefault(); e.stopPropagation(); void ui.saveServer(); }
    else if (k === 'a') { e.preventDefault(); e.stopPropagation(); const F = ed.floor().id, F0 = ed.data.floors[0].id; ed.select(ed.data.boxes.filter(b => (b.floor ?? F0) === F && (ed.settings.showHidden || !b.flags?.includes('NoPrimary'))).map(b => `box:${b.id}`)); ui.msg(`selected all ${ed.sel.size} boxes on ${F}`); }
  }, { capture: true });
  window.addEventListener('beforeunload', () => { session.tick(true); });
  setInterval(() => { const s = session.tick(); if (s) ui.lastAutosave = s.t; }, 30000);
  (api.save as any).session = session;   // (QA / by hand: __ed.save.session.held, .tick(), .bootError)
  if (session.bootError) { ui.msg(session.bootError); console.warn(session.bootError); }

  Object.assign(A, { ed, scene, view, tools, overlay, ui, api, input, tickInput, sync, updateCamera, render, tickUi, frame1, frameLite, shot, uishot, hooks, hudLine });
  return A;
}
