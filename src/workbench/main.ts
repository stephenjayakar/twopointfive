// The WORKBENCH: the level editor (src/editor/app.ts) and the character / prop viewer (src/viewer/runtime.ts + ui.ts) in ONE shell over ONE Engine,
// one Input, one orbit camera (the editor's View), one inspector column and one capture story. MODES (the left rail, keys Ctrl+1‥5, plain 1‥5 in
// the level modes): Level (the editor as it was) · Materials/Markings (the same, its paint tabs up) · Characters (the viewer: scenes ▸ variants, the
// rig gizmo, its property groups and copy-constants) · Effects (the viewer's props & FX / tracer / muzzle scenes) · Motion (a stub). TWO WORLDS share
// the engine: the LEVEL (the editor's Scene owns statics + lights, rebuilt from the document) and the STUDIO (the viewer's stage: floor, back wall,
// key / fill / rim); a scene is either a studio scene or a STAGING scene = the figure stood IN THE LEVEL (the level keeps rendering round him, its
// lights light him) — selectable in any mode, so one tunes the lino's roughness while a guard walks through the reflection. Switching worlds swaps
// statics / lights / sky / exposure / haze slots and clears the skin + capsules; nothing of one leaks into the other. URL: /workbench#mode=chars&
// scene=guard/carbine-shoulder · #mode=level&file=office · #mode=materials&paint=lino · #mode=fx&scene=fx/muzzle (+ &sel= the viewer's selection);
// /viewer#s/v, /gait and /editor#file= forward here. Every window hook of both pages stays: __ed __edshot __uishot __tools __view __scene (editor),
// __viewer __char __step __gizmo __rig __rigSource __toss __cans __vtime __tac __hold __long __M __vrt (viewer; __vrt = the viewer Runtime — __rt is the GAME page's
// RT-reflection knobs), __shot __engine __cam (shared), + __wb.
import { initGpu, showFatal } from '../gpu/device';
import { Engine, defaultSettings } from '../engine';
import { Input } from '../game/input';
import { Quality, QUALITY_NAMES, QualityName } from '../ui/quality';
import { Vec3, v3, clamp } from '../math/vec';
import { RIG, rigSource } from '../game/rigProps';
import { HOLD, LONG, SignalKind, Stance, LongStance } from '../game/character';
import { createEditorApp, EditorApp } from '../editor/app';
import * as persist from '../editor/persist';
import { Runtime } from '../viewer/runtime';
import { Ui as ViewerUi } from '../viewer/ui';
import { SCENES, VariantDef, findVariant } from '../viewer/scenes';
import { DEBUG_VIEWS } from '../viewer/state';
import { longSource } from '../viewer/sheet';
import { frameCanvas, postShot } from '../ui/capture';
import { StaticCollision } from '../scene/collision';

export type Mode = 'level' | 'materials' | 'chars' | 'fx' | 'motion';
export const MODES: { id: Mode; n: number; label: string; icon: string; title: string }[] = [
  { id: 'level', n: 1, label: 'Level', icon: '▦', title: 'the level editor: boxes, lights, doors, routes, devices, the mission — the document is the level file (save ▾ / undo)' },
  { id: 'materials', n: 2, label: 'Materials', icon: '◩', title: 'the level\'s paints and the boxes\' pixel-art markings, live on the same renderer (the Materials / Markings tabs)' },
  { id: 'chars', n: 3, label: 'Characters', icon: '☺', title: 'the mannequin on the studio stage: scenes ▸ variants, the rig gizmo, the RIG / LONG / gait tables and their copy-constants paste-back' },
  { id: 'fx', n: 4, label: 'Effects', icon: '✦', title: 'muzzle flash and sparks, tracers, smoke / stun canisters, dropped items, the rail light — the viewer\'s props & FX scenes' },
  { id: 'motion', n: 5, label: 'Motion', icon: '↯', title: 'reserved for Kimodo key-pose / posture-layer authoring (a stub)' },
];
const isLevelMode = (m: Mode) => m === 'level' || m === 'materials';
const isFigureMode = (m: Mode) => m === 'chars' || m === 'fx';
/** the scenes the Effects mode calls its own (the tree shows every scene in both figure modes; entering Effects lands on one of these) */
const FX_SCENE = (sceneId: string, variantId: string) => sceneId === 'fx' || variantId === 'carbine-tracers' || variantId === 'rifle-fire' || variantId === 'muzzle';
/** the engine fields a WORLD keeps to itself (the studio is lit and exposed as a studio, the office as the office at night) */
interface Slot { exposure: number; hazeDensity: number; skyZenith: Vec3; skyHorizon: Vec3 }

async function main() {
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const app$ = $('app'); const canvas = $('view') as HTMLCanvasElement; const olay = $('olay') as HTMLCanvasElement; const loading = $('loading');
  const gpu = await initGpu(canvas);
  if (loading) loading.textContent = 'compiling shaders…';
  const engine = await Engine.create(gpu, { sharp: true, gbaa: true });   // (every kernel through the async path — engine.ts init / gpu/device.ts: never compile the boot pipelines synchronously; the standalone editor boots the same way)
  const S = engine.settings; const W = engine.world; const LS = engine.lights;
  const url = readHash();
  let mode: Mode = url.mode ?? 'level';

  // ---------------------------------------------------------------- quality: ONE controller (the runtime's, which has the real smoke) — pinned presets like both pages
  let quality: Quality | null = null;
  let prefs: any = {}; try { prefs = JSON.parse(localStorage.getItem(persist.LS.prefs) ?? '{}'); } catch { /* */ }
  const qp = new URLSearchParams(location.search).get('quality');
  let qName: QualityName = (QUALITY_NAMES as string[]).includes(qp ?? '') ? qp as QualityName : (QUALITY_NAMES as string[]).includes(prefs.quality) ? prefs.quality : 'medium';
  const applyQuality = (name?: string): string => { if (name && (QUALITY_NAMES as string[]).includes(name)) { qName = name as QualityName; quality?.apply(qName); prefs.quality = name; try { localStorage.setItem(persist.LS.prefs, JSON.stringify(prefs)); } catch { /* */ } } return quality?.current ?? qName; };

  // ---------------------------------------------------------------- the LEVEL app first (its scene snapshots the engine's night defaults), then the STUDIO runtime
  loading.textContent = 'loading level…';
  // (the app makes the Input ITSELF, after registering the painter's window-capture key hook — the hook must run before Input records the key, or Delete / arrows / [ ] / H / V
  // reach the level tools while a bitmap is being painted (wave-3 review 08-12); the studio runtime below shares that same Input)
  const app: EditorApp = await createEditorApp({
    engine, gpu, canvas, olay, quality: applyQuality, brand: '2.6 workbench', active: () => isLevelMode(mode),
    boot: { file: url.file, autosave: url.autosave, blank: url.blank }, step: (n, dt) => step(n, dt), overlayOn: () => isLevelMode(mode),
    els: { topbar: $('tb-level'), palette: $('palette'), outliner: $('outliner-level'), props: $('props'), hud: $('hud'), log: $('log'), help: $('help'), problems: $('problems'), drop: $('drop'), filepick: $('filepick') as HTMLInputElement, proptitle: $('proptitle'), insphead: $('insphead'), matpane: $('matpane'), markpane: $('markpane'), stage: $('stage'), app: app$, inspgrip: $('inspgrip'), splitter: null },
  });
  const { ed, view, tools, input } = app;
  const levelSlot: Slot = takeSlot();   // the office at night, as the standalone editor renders it
  const rt = await Runtime.attach(canvas, gpu, engine, loading, { input, cam: view.cam, hosted: true });   // (writes the studio's sky / exposure / haze onto the engine)
  const studioSlot: Slot = takeSlot();
  quality = rt.quality; quality.auto = false; (quality as any).calib.done = true; applyQuality(qName);
  W.statics.length = 0; W.staticsDirty = true;   // (the runtime parked the studio's boxes in the world; each world sets its own below)
  function takeSlot(): Slot { return { exposure: S.exposure, hazeDensity: S.hazeDensity, skyZenith: v3.copy(S.skyZenith), skyHorizon: v3.copy(S.skyHorizon) }; }
  function putSlot(t: Slot) { S.exposure = t.exposure; S.hazeDensity = t.hazeDensity; S.skyZenith = v3.copy(t.skyZenith); S.skyHorizon = v3.copy(t.skyHorizon); }

  // ---------------------------------------------------------------- worlds
  let world: 'level' | 'studio' | null = null;
  /** the staging variant stood in the level (null = the level alone), and the studio scene the figure modes go back to */
  let staged: { scene: string; variant: string } | null = null;
  let studioScene = { scene: 'sam', variant: 'idle' }; let fxScene = { scene: 'fx', variant: 'muzzle' };
  /** is the figure simulated + drawn this frame */
  const actorOn = () => world === 'studio' || staged !== null;
  function useWorld(w: 'level' | 'studio') {
    if (w === world) return;
    if (world === 'level') Object.assign(levelSlot, takeSlot()); else if (world === 'studio') Object.assign(studioSlot, takeSlot());   // (an exposure nudged by hand stays with its world)
    world = w;
    if (w === 'studio') { putSlot(studioSlot); W.statics.length = 0; for (const b of rt.stage.boxes) W.statics.push(b); W.staticsDirty = true; LS.lights.length = 0; for (const l of rt.ownLights(true)) LS.lights.push(l); rt.useCollision(null); }
    else { putSlot(levelSlot); app.scene.invalidate(); }   // (the level's collision set goes to the runtime in withFigure, once the scene has synced)
    W.dynamics = []; W.resetCapsules(); rt.chars.finish(0); engine.resetTaa('workbench world');
  }

  // ---------------------------------------------------------------- the viewer's chrome, re-housed: the tree on the left, its outliner + sheet in the right column
  let booting = true;
  const vui = new ViewerUi(rt, {
    hash: false, staging: true, hostSized: true,
    help: 'RMB orbit · MMB / Space-drag pan · wheel zoom · click a prop to select (U parent, Esc deselect) · F frame · T plan · Y turntable · P pause · K shoot · X die · N nv · L light · G guard · C carbine · 0/1/2/4 kit · Tab inspector · ⚙ the rest · Ctrl+1‥5 modes',
    els: { app: app$, scenes: $('scenes'), variants: $('variants'), strip: $('strip'), gaitline: $('gaitline'), alloff: $('alloff'), copygait: $('copygait'), hud: $('hud'), help: $('help-chars'), log: $('log'), outbox: $('outbox'), rigout: $('rigout'), outwhat: $('outwhat'), gear: $('gear'), gearbtn: $('gearbtn'), allknobs: $('allknobs'), inspbtn: $('inspbtn'), inspector: $('inspector'), grip: $('inspgrip'), splitter: $('splitter-chars'), outliner: $('outliner-chars'), props: $('props-chars'), proptitle: $('proptitle-chars'), outclose: $('outclose'), outcopy: $('outcopy'), allclose: $('allclose') },
    onScene: (s, v, def) => onScene(s, v, def),
  });

  // ---------------------------------------------------------------- scenes: studio scenes live in the studio, staging scenes in the level — pick either in any mode
  function onScene(sceneId: string, variantId: string, _def: VariantDef | null) {
    const isStaging = !!SCENES.find(s => s.id === sceneId)?.staging;
    if (isStaging) staged = { scene: sceneId, variant: variantId };
    else { staged = null; if (FX_SCENE(sceneId, variantId)) fxScene = { scene: sceneId, variant: variantId }; else studioScene = { scene: sceneId, variant: variantId }; }
    if (booting) return;
    if (!isStaging && isLevelMode(mode)) { setMode(FX_SCENE(sceneId, variantId) ? 'fx' : 'chars'); return; }   // a studio scene picked from a level mode: go and look at it
    settleWorld(); paintTree(); writeHash();
    if (isStaging) { frameFigure(); msg(`staged in the level: ${sceneId} ▸ ${variantId} — ${isLevelMode(mode) ? 'the level keeps its tools; the man is scenery' : 'the level renders round him'}`); }
  }
  /** the world this mode + scene state wants, and the figure's dressing for it */
  function settleWorld() {
    const want: 'level' | 'studio' = isLevelMode(mode) || mode === 'motion' ? 'level' : (staged ? 'level' : 'studio');
    useWorld(want);
    rt.gizmoLive = isFigureMode(mode) && actorOn(); const gz = document.getElementById('gizmo'); if (gz) gz.style.display = rt.gizmoLive ? '' : 'none';
    if (world === 'level' && !staged) { W.resetCapsules(); rt.chars.finish(0); app.scene.invalidate(); }
  }
  /** stand the level alone again (the tree's top row) */
  function unstage() { if (!staged) return; staged = null; if (isFigureMode(mode)) vui.applyScene((mode === 'fx' ? fxScene : studioScene).scene, (mode === 'fx' ? fxScene : studioScene).variant); else { settleWorld(); paintTree(); writeHash(); msg('the level alone again'); } }
  /** frame the staged figure with the shared camera (F in the figure modes does the same through rt.frame) */
  function frameFigure() { const p = rt.char.pos; view.focus = [p[0], 1.0, p[2]]; if (view.cam.desiredDistance > 8 || view.cam.desiredDistance < 1) { view.cam.desiredDistance = view.cam.distance = 3.2; view.cam.pitch = Math.min(view.cam.pitch, 0.4); } if (view.plan) view.togglePlan(false); }
  rt.onFrame = (kind) => { view.focus = v3.copy(rt.focus); if (view.plan) view.togglePlan(false); void kind; };   // the viewer's framings (F body / H head / ⚙ ▸ frame …) land on the shared camera: yaw / pitch / distance are already on view.cam, the focus follows

  // ---------------------------------------------------------------- the scene tree (left column, every mode): scenes ▸ variants + 'the level alone'
  const tree = $('scenetree'); const expanded = new Set<string>(['staging']);
  function paintTree() {
    tree.textContent = '';
    const st = rt.st; const cur = `${st.sceneId}/${st.variantId}`;
    const row = (label: string, depth: number, o: { grp?: string; on?: boolean; staged?: boolean; dim?: boolean; title?: string; run?: () => void }) => {
      const r = document.createElement('div'); r.className = 'n' + (o.grp ? ' grp' : '') + (o.on ? ' sel' : '') + (o.staged ? ' staged' : '') + (o.dim ? ' dim' : ''); r.style.paddingLeft = `${4 + depth * 12}px`;
      const tw = document.createElement('span'); tw.className = 'tw'; tw.textContent = o.grp ? (expanded.has(o.grp) ? '▾' : '▸') : ' '; r.append(tw, document.createTextNode(label)); if (o.title) r.title = o.title;
      r.onclick = e => { e.stopPropagation(); if (o.grp) { if (expanded.has(o.grp)) expanded.delete(o.grp); else expanded.add(o.grp); paintTree(); return; } o.run?.(); };
      tree.append(r);
    };
    row(staged ? '○ the level alone (dismiss the figure)' : '● the level alone — no staged figure', 0, { on: false, dim: !staged && isLevelMode(mode), title: 'stand nobody in the level: Level / Materials render the level as ever; Characters / Effects go back to the studio', run: () => unstage() });
    for (const s of vui.scenes()) {
      const open = expanded.has(s.id) || (isFigureMode(mode) && s.id === st.sceneId && actorOn()) || (!!staged && !!s.staging);   // (the level modes keep the studio scenes folded: there the tree is for staging)
      row(`${s.label}${s.staging ? '  · in the level' : ''}`, 0, { grp: s.id, title: s.title });
      if (!open) continue;
      for (const v of s.variants) { const key = `${s.id}/${v.id}`; row(v.label, 1, { on: key === cur && actorOn(), staged: !!staged && key === `${staged.scene}/${staged.variant}`, title: v.title, run: () => vui.applyScene(s.id, v.id) }); }
    }
    $('scenelabel').textContent = `${SCENES.find(s => s.id === st.sceneId)?.label ?? st.sceneId} ▸ ${vui.variantDef?.label ?? st.variantId}${staged ? '  (staged in the level)' : ''}`;
  }

  // ---------------------------------------------------------------- modes
  const rail = $('rail');
  { const h = document.createElement('div'); h.className = 'rh'; h.textContent = 'MODE'; rail.append(h);
    for (const M of MODES) { const b = document.createElement('button'); b.className = 'rb'; b.dataset.mode = M.id; b.title = `${M.title} — Ctrl+${M.n}${M.n <= 5 ? ` (or ${M.n} in the level modes)` : ''}`; const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = M.icon; const k = document.createElement('span'); k.className = 'k'; k.textContent = String(M.n); b.append(ic, document.createTextNode(M.label), k); b.onclick = () => setMode(M.id); rail.append(b); } }
  function paintChrome() {
    app$.dataset.mode = mode;
    for (const e of Array.from(document.querySelectorAll<HTMLElement>('[data-modes]'))) e.classList.toggle('wbhide', !e.dataset.modes!.split(/\s+/).includes(mode));
    for (const b of Array.from(rail.querySelectorAll<HTMLElement>('.rb'))) b.classList.toggle('on', b.dataset.mode === mode);
    $('lhead-scenes').textContent = isFigureMode(mode) ? 'SCENES ▸ VARIANTS' : 'STAGE A FIGURE IN THE LEVEL';
    canvas.classList.toggle('grab', isFigureMode(mode));
  }
  function setMode(m: Mode, o: { quiet?: boolean; boot?: boolean } = {}) {
    const was: Mode | null = o.boot ? null : mode; mode = m; paintChrome();
    if (m === 'materials') { const pu = app.ui.paintUi; if (pu.tab === 'props') pu.show('materials'); }
    else if (m === 'level') { /* the tabs stay where the user left them */ }
    if (isFigureMode(m) && !staged) {   // the studio: (re)apply the mode's remembered scene when the current one is not of this mode
      const want = m === 'fx' ? fxScene : studioScene; const st = rt.st;
      if (world !== 'studio' || `${st.sceneId}/${st.variantId}` !== `${want.scene}/${want.variant}` || (m === 'fx') !== FX_SCENE(st.sceneId, st.variantId)) { booting = true; try { vui.applyScene(want.scene, want.variant); } finally { booting = false; } }
    }
    settleWorld();
    if (isFigureMode(m) && (was === null || !isFigureMode(was))) { if (world === 'studio') { rt.frame('body'); view.focus = v3.add(rt.char.pos, [0, 1, 0]); if (view.plan) view.togglePlan(false); } else frameFigure(); tools.cancel(); }
    if (isLevelMode(m) && was !== null && isFigureMode(was) && world === 'level' && !staged) tools.frameSelection();   // back from the studio to the bare level: frame it (a staged figure keeps the camera on him)
    paintTree(); writeHash();
    if (!o.quiet) msg(`${MODES.find(x => x.id === m)!.label} mode${isFigureMode(m) ? ` — ${world === 'studio' ? 'the studio stage' : 'the figure staged in the level'}` : staged ? ' — a figure is staged in the level (the tree\'s top row dismisses him)' : ''}`);
  }

  // ---------------------------------------------------------------- URL state
  function readHash(): { mode?: Mode; scene?: string; variant?: string; file?: string | null; autosave?: boolean; blank?: boolean; paint?: string; sel?: string | null } {
    const raw = location.hash.replace(/^#/, ''); const P = new URLSearchParams(raw);
    const out: ReturnType<typeof readHash> = { file: P.get('file'), autosave: P.has('autosave'), blank: P.has('blank'), paint: P.get('paint') ?? undefined, sel: P.get('sel') };
    const m = P.get('mode'); const modeOf: Record<string, Mode> = { level: 'level', materials: 'materials', markings: 'materials', chars: 'chars', characters: 'chars', fx: 'fx', effects: 'fx', motion: 'motion' };
    if (m && modeOf[m]) out.mode = modeOf[m];
    const sc = P.get('scene'); if (sc) { const [a, b] = sc.split('/'); out.scene = a; out.variant = b; }
    { const first = raw.split('&')[0] ?? '';   // the viewer's old form: #scene/variant[&sel=<id>] (VIEWER.md) — the first segment names a scene, the rest are ordinary params (URLSearchParams decodes sel; a mangled %-escape selects nothing rather than throwing)
      if (!m && !sc && first && !first.includes('=')) { const [s2, v2] = first.split('/'); if (findVariant(s2, v2 ?? '') || SCENES.some(s => s.id === s2)) { out.scene = s2; out.variant = v2; out.mode = 'chars'; const rest = new URLSearchParams(raw.slice(first.length + 1)); if (rest.has('sel')) out.sel = rest.get('sel'); } } }
    if (!out.mode && (out.file || out.autosave || out.blank)) out.mode = 'level';   // the editor's old form: #file= / #autosave / #blank
    return out;
  }
  function writeHash() {
    const P: string[] = [`mode=${mode}`];
    if (isLevelMode(mode) || staged) { if (url.file) P.push(`file=${encodeURIComponent(url.file)}`); }
    if (mode === 'materials' && app.ui.paintUi.paint) P.push(`paint=${encodeURIComponent(app.ui.paintUi.paint)}`);
    if (actorOn() || isFigureMode(mode)) P.push(`scene=${rt.st.sceneId}/${rt.st.variantId}`);
    if (isFigureMode(mode) && rt.st.sel) P.push(`sel=${encodeURIComponent(rt.st.sel)}`);
    const h = '#' + P.join('&'); if (location.hash !== h) history.replaceState(null, '', h);
  }
  window.addEventListener('hashchange', () => { const u = readHash(); if (u.mode && u.mode !== mode) setMode(u.mode, { quiet: true }); if (u.scene) { const f = findVariant(u.scene, u.variant ?? '') ?? (SCENES.find(s => s.id === u.scene) ? { scene: SCENES.find(s => s.id === u.scene)!, variant: SCENES.find(s => s.id === u.scene)!.variants[0] } : null); if (f && (rt.st.sceneId !== f.scene.id || rt.st.variantId !== f.variant.id)) vui.applyScene(f.scene.id, f.variant.id, u.sel ?? undefined); } if (u.paint && Object.hasOwn(ed.data.materials, u.paint)) { app.ui.paintUi.paint = u.paint; if (mode === 'materials') app.ui.paintUi.show('materials'); } });

  // ---------------------------------------------------------------- captures: ONE frame renderer for __shot / __edshot / __uishot / the viewer's rt.shot
  let time = 0; let frameCount = 0; let fpsSm = 60;
  const renderOnce = (dt = 1 / 60, present = false) => {
    if (world === 'level') { app.sync(); if (staged) { withFigure(dt > 0 ? dt : 0); } }
    else rt.simulate(dt);
    trackFocus(); app.updateCamera(dt);
    engine.lights.update(dt, time); window.__vtime = time; engine.render(view.cam, time, dt, present);
    if (isLevelMode(mode)) app.overlay.draw(); if (rt.gizmoLive) rt.gizmo.draw();
  };
  app.renderNow = () => renderOnce(0, false);
  rt.shot = async (name: string, q = 0.86) => { renderOnce(0, false); const c2 = await frameCanvas(engine); if (!c2) return 'no frame'; const blob: Blob = await new Promise(res => c2.toBlob(b => res(b!), 'image/jpeg', q)); return `${c2.width}x${c2.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`; };
  /** the level's statics as the staged figure's collision set (viewer/runtime.ts useCollision — review T4.11: his ragdoll, K's traced round, sparks and tossed cans
   *  used to meet the invisible studio walls in the middle of the office), rebuilt when the document has moved on — not mid-drag, a drag moves it every mousemove */
  let levelCol: { col: StaticCollision; rev: number } | null = null;
  function levelCollision(): StaticCollision | null {
    const lv = app.scene.level; if (!lv) return null;
    if (!levelCol || (levelCol.rev !== ed.doc.rev && !tools.drag)) levelCol = { col: new StaticCollision(lv.boxes), rev: ed.doc.rev };   // (keyed on the document: a scene rebuilt for a view setting has new Box objects of the same geometry — the old set still answers right)
    return levelCol.col;
  }
  /** the figure in the LEVEL: the runtime's frame round the editor's scene — its hand lights back in the set the scene rebuilt, its props after the leaves */
  function withFigure(dt: number) {
    rt.useCollision(levelCollision());
    for (const l of rt.ownLights(false)) if (!LS.lights.includes(l)) LS.lights.push(l);
    const levelDyn = W.dynamics; rt.simulate(dt); const dyn = W.dynamics === levelDyn ? [] : W.dynamics; W.dynamics = levelDyn.concat(dyn);
  }
  function trackFocus() { if (actorOn() && rt.st.track !== 0 && isFigureMode(mode)) view.focus = v3.copy(rt.focus); }

  // ---------------------------------------------------------------- hooks: both pages' names, one behaviour each
  Object.assign(rt.st, {
    scene: (name: string, variant?: string) => { const sc = SCENES.find(s => s.id === name); if (!sc) throw new Error(`scene: one of ${SCENES.map(s => s.id).join(' ')}`); const v = variant ?? sc.variants[0].id; if (!sc.variants.some(x => x.id === v)) throw new Error(`variant: one of ${sc.variants.map(x => x.id).join(' ')}`); vui.applyScene(name, v); return `${name} ▸ ${v}`; },
    select: (id: string | null) => vui.select(id),
  });
  window.__viewer = rt.st;
  Object.defineProperty(window, '__char', { get: () => rt.char, configurable: true });
  window.__rig = RIG; window.__gizmo = rt.gizmo; window.__rigSource = rigSource;
  window.__step = (n = 1) => step(n, 1 / 60);
  window.__toss = (kind, suppressed) => rt.toss(kind, suppressed);
  window.__cans = { smokeCan: () => rt.smokeCan(), stunCan: () => rt.stunCan() };
  window.__tac = {
    stance: (name: Stance, side?: -1 | 1) => rt.setStance(name, side), peek: (v: number) => { rt.st.peek = clamp(v, 0, 1); },
    kick: () => rt.fireTac(0), signal: (k: SignalKind) => { const i = ['hold', 'go', 'rally'].indexOf(k); if (i < 0) throw new Error('signal: hold | go | rally'); rt.fireTac(i + 1); }, flinch: () => rt.fireTac(4), throw: () => rt.fireTac(5),
    lockpick: (on: boolean) => { rt.st.lockpick = on; }, loop: (on: boolean, shot?: number, every?: number) => { rt.st.tacLoop = on; if (shot !== undefined) rt.st.tacShot = shot; if (every) rt.st.tacEvery = every; },
    at: (t: number, shot?: 'kick' | SignalKind | 'flinch' | 'throw') => rt.poseAt(t, shot), resume: () => { rt.st.paused = false; },
    long: (on: boolean, name?: LongStance | null) => rt.setLong(on, name),
  } as NonNullable<Window['__tac']>;
  window.__hold = { set: (o: Record<string, unknown>) => Object.assign(rt.st.hold, o), HOLD };
  window.__long = { LONG, source: longSource };
  Object.assign(window, app.hooks, { __M: rt.gait, __lab: rt.st, __vui: vui, __vrt: rt, __scenes: SCENES.map(s => ({ id: s.id, staging: !!s.staging, variants: s.variants.map(v => v.id) })) });
  window.__shot = (name: string, quality = 0.86) => rt.shot(name, quality);   // one capture for both pages' __shot: the composite frame (level or studio, figure and all), no overlay — __edshot / __uishot add the overlay / the inspector
  (window as any).__wb = {
    get mode() { return mode; }, setMode: (m: Mode) => { setMode(m); return mode; }, modes: MODES.map(m => m.id),
    get world() { return world; }, get staged() { return staged ? `${staged.scene}/${staged.variant}` : null }, get actor() { return actorOn(); },
    /** stage a scene by name (studio scenes switch to a figure mode; staging scenes stand the man in the level in any mode); null = the level alone */
    scene: (sceneId: string | null, variantId?: string) => { if (sceneId === null) { unstage(); return null; } return (rt.st as any).scene(sceneId, variantId); },
    hash: () => location.hash, frameFigure, get fps() { return fpsSm; },
    /** which collision set the figure's physics use right now: 'level' (staged in it) or 'studio' */
    get collision() { return rt.col === rt.stageCol ? 'studio' : 'level'; }, get collisionBoxes() { return rt.col.boxes.length; },
  };

  // ---------------------------------------------------------------- keys: mode switch everywhere; the viewer's hotkeys in the figure modes (the editor's are its own, gated by `active`)
  const hit = (c: string) => input.hit(c);
  function modeKeys() {
    const ctrl = input.down('ControlLeft') || input.down('ControlRight'); const typingFree = isLevelMode(mode) || mode === 'motion';
    for (const M of MODES) if (hit(`Digit${M.n}`) && (ctrl || (typingFree && !app.ui.paintUi.painterFocus))) { setMode(M.id); return true; }
    return false;
  }
  function figureKeys(dt: number) {
    void dt;
    if (hit('Tab')) toggleInspector();
    if (hit('Escape')) { if (vui.overlayOpen) vui.closeOverlays(); else vui.select(null); }
    if (hit('KeyP')) rt.st.paused = !rt.st.paused;
    if (hit('KeyU')) rt.gizmo.selectParent();
    if (hit('KeyY')) rt.st.turntable = !rt.st.turntable;   // (T is the shared plan view here; the turntable moved to Y)
    if (hit('KeyT')) { view.togglePlan(); msg(view.plan ? 'plan view (T toggles back)' : 'orbit view'); }
    if (hit('KeyN')) { rt.st.nv = !rt.st.nv; msg(rt.st.nv ? 'night vision on (goggles down)' : 'night vision off (goggles up)'); }
    if (hit('KeyL')) rt.st.lightOn = !rt.st.lightOn;
    if (hit('KeyG')) { rt.st.guard = !rt.st.guard; if (!rt.st.guard) rt.st.carbine = false; }
    if (hit('KeyC')) { rt.st.carbine = !rt.st.carbine; if (rt.st.carbine) rt.st.guard = true; msg(rt.st.carbine ? 'carbine in the hands (guard kit)' : 'carbine off'); }
    if (hit('KeyK')) rt.shoot();
    if (hit('KeyX')) rt.die('shot');
    if (hit('KeyE') && rt.st.hold.on) rt.fireTac(9);
    if (hit('KeyF')) { rt.frame('body'); }
    if (hit('KeyH')) { rt.frame('head'); }
    if (hit('Digit0')) rt.st.slot = 0; if (hit('Digit1')) rt.st.slot = 1; if (hit('Digit2')) rt.st.slot = 2;
    if (hit('Digit4')) { const st = rt.st; st.rifle = (st.rifle + 1) % 3; if (st.rifle === 2) { st.guard = false; st.carbine = false; } msg(['FN2000: not carried', 'FN2000: slung across the back', 'FN2000: in both hands (the long-gun solve, its foregrip point)'][st.rifle]); }
    if (hit('Backquote')) S.debugView = (S.debugView + (input.down('ShiftLeft') ? DEBUG_VIEWS.length - 1 : 1)) % DEBUG_VIEWS.length;
    if (hit('BracketLeft')) S.exposure /= 1.25;
    if (hit('BracketRight')) S.exposure *= 1.25;
  }
  /** the SHARED camera gestures in the figure modes (the level modes get the same set from the editor's Tools): RMB orbit, MMB or Space+LMB pan, wheel zoom about the cursor */
  let lastMX = input.mouseX, lastMY = input.mouseY; let panning = false;
  function figureCamera() {
    const mx = input.mouseX, my = input.mouseY; const dx = mx - lastMX, dy = my - lastMY; lastMX = mx; lastMY = my;
    const lmb = (input.buttons & 1) !== 0, mmb = (input.buttons & 2) !== 0, rmb = (input.buttons & 4) !== 0;
    if (rmb && !rt.gizmo.busy) { view.orbit(dx, dy); rt.st.track = rt.st.track; }
    const pan = mmb || (input.down('Space') && lmb);
    if (pan && !rt.gizmo.busy) { view.pan(dx, dy); rt.st.track = 0; panning = true; } else panning = false;
    const wheel = input.wheel + input.wheelCtrl; if (wheel) view.zoom(wheel, mx, my, 0);
    canvas.style.cursor = rt.gizmo.busy ? 'grabbing' : panning ? 'move' : rmb ? 'grabbing' : '';
  }
  function toggleInspector() { const hid = !app$.classList.contains('insp-hidden'); app$.classList.toggle('insp-hidden', hid); $('inspbtn').classList.toggle('on', !hid); }
  $('inspbtn').onclick = () => toggleInspector();
  canvas.addEventListener('mousedown', () => { if (!isFigureMode(mode)) return; const ae = document.activeElement; if (ae instanceof HTMLElement && ae.closest('.pnl, #topbar')) ae.blur(); input.focusGame(); });

  // ---------------------------------------------------------------- the frame
  function frame1(dt: number, present: boolean) {
    time += dt;
    if (!modeKeys()) { if (isLevelMode(mode)) app.tickInput(dt); else if (isFigureMode(mode)) { figureKeys(dt); figureCamera(); } else { figureCamera(); if (hit('KeyT')) view.togglePlan(); } }
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) renderOnce(dt, present);
    else if (world === 'level') app.sync();
    input.endFrame();
    frameCount++; rt.fpsSm = fpsSm;
    if (isLevelMode(mode)) app.tickUi(); else if (isFigureMode(mode)) vui.tick(frameCount); else app.tickUi();
    if (frameCount % 30 === 0) writeHash();
  }
  function frameLite(dt: number) {
    if (!modeKeys()) { if (isLevelMode(mode)) { view.w = canvas.clientWidth || view.w; view.h = canvas.clientHeight || view.h; tools.update(input, dt); canvas.style.cursor = tools.cursor; } else if (isFigureMode(mode)) { figureKeys(dt); figureCamera(); } }
    input.endFrame(); frameCount++;
    if (isLevelMode(mode)) app.tickUi(); else if (isFigureMode(mode)) vui.tick(frameCount);
  }
  const step = (n: number, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame1(dt, i === n - 1); };
  const msg = (t: string) => { app.ui.msg(t); rt.msg(t); };

  // ---------------------------------------------------------------- boot: the URL's mode + scene, else Level on the office
  const startScene = url.scene ? (findVariant(url.scene, url.variant ?? '') ?? (SCENES.find(s => s.id === url.scene) ? { scene: SCENES.find(s => s.id === url.scene)!, variant: SCENES.find(s => s.id === url.scene)!.variants[0] } : null)) : null;
  if (startScene) { const stg = !!startScene.scene.staging; if (!stg && !url.mode) mode = 'chars'; vui.applyScene(startScene.scene.id, startScene.variant.id, url.sel ?? undefined); }
  booting = false;
  if (url.paint && Object.hasOwn(ed.data.materials, url.paint)) app.ui.paintUi.paint = url.paint;
  loading.style.display = 'none';
  wireSplitters();
  setMode(mode, { quiet: true, boot: true });
  if (world === 'level') { if (staged) frameFigure(); else tools.frameSelection(); }   // start framed on the level, or on the man a deep link staged in it
  msg(`workbench: ${MODES.map(m => `${m.n} ${m.label}`).join(' · ')} (Ctrl+digit) — scenes ▸ variants on the left stand a figure in the studio or IN THE LEVEL`);

  // ---- the loop, with the editor's IDLE THROTTLE (3 s untouched → one render in 12 rAF ticks; any input / document / camera change = full rate). A figure that
  // walks or breathes is a changing picture, so while one is up the window is IDLE_AFTER_FIGURE (20 s) — long enough to watch a leg of his walk, short enough that
  // a workbench left open beside the game costs next to nothing (he then moves at ~5 fps until the mouse comes back)
  const IDLE_AFTER = 3.0, IDLE_AFTER_FIGURE = 20.0, IDLE_EVERY = 12;
  let lastActivity = performance.now(); let idleSkip = 0; let lastCamKey = ''; let lastRevSeen = -1; let skippedDt = 0;
  const poke = () => { lastActivity = performance.now(); };
  for (const ev of ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) window.addEventListener(ev, poke, { capture: true, passive: true });
  let last = performance.now();
  function frame() {
    const now = performance.now(); const rawDt = (now - last) / 1000; const dt = Math.min(1 / 20, rawDt); last = now;
    if (rawDt > 0) fpsSm = fpsSm * 0.95 + (1 / rawDt) * 0.05; app.fpsSm = fpsSm;
    const camKey = `${view.focus.map(x => x.toFixed(3))}|${view.cam.yaw.toFixed(4)}|${view.cam.pitch.toFixed(4)}|${view.cam.desiredDistance.toFixed(3)}|${view.plan}`;
    if (camKey !== lastCamKey || ed.doc.rev !== lastRevSeen || tools.drag || tools.routeDraft) { lastCamKey = camKey; lastRevSeen = ed.doc.rev; poke(); }
    const idle = (now - lastActivity) / 1000 > (actorOn() && !rt.st.paused ? IDLE_AFTER_FIGURE : IDLE_AFTER) && !(window as any).__testVisible;
    let render = true; if (idle) { idleSkip = (idleSkip + 1) % IDLE_EVERY; render = idleSkip === 0; } else idleSkip = 0;
    try { if (render) { frame1(dt + skippedDt, true); skippedDt = 0; } else { skippedDt = Math.min(0.25, skippedDt + dt); frameLite(dt); } } catch (e) { console.error(e); showFatal(String((e as Error)?.stack ?? e)); return; }
    if (frameCount % 10 === 0) app.ui.setFps(idle ? `idle · ~${Math.round(fpsSm / IDLE_EVERY)} fps` : `${fpsSm.toFixed(0)} fps`);
    requestAnimationFrame(frame);
  }
  (window as any).__idle = { get idle() { return (performance.now() - lastActivity) / 1000 > (actorOn() && !rt.st.paused ? IDLE_AFTER_FIGURE : IDLE_AFTER); }, poke, after: IDLE_AFTER, afterFigure: IDLE_AFTER_FIGURE, every: IDLE_EVERY };
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- column sizing: the inspector's width is the editor Ui's grip; the two vertical splits are ours
  function wireSplitters() {
    const K = { pal: 'twopointsix.workbench.palH', voutl: 'twopointsix.workbench.voutlH' };
    try { const a = parseInt(localStorage.getItem(K.pal) ?? '', 10); if (a > 40 && a < 2000) app$.style.setProperty('--pal-h', `${a}px`); const b = parseInt(localStorage.getItem(K.voutl) ?? '', 10); if (b > 40 && b < 2000) app$.style.setProperty('--voutl-h', `${b}px`); } catch { /* */ }
    const drag = (grip: HTMLElement | null, onMove: (e: MouseEvent) => void, onEnd: () => void) => grip?.addEventListener('mousedown', e => {
      e.preventDefault(); document.body.classList.add('resizing');
      const mm = (ev: MouseEvent) => onMove(ev); const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); document.body.classList.remove('resizing'); onEnd(); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    });
    let palH = 0; drag($('splitter-left'), e => { const bottom = $('left').getBoundingClientRect().bottom; palH = Math.round(Math.max(40, bottom - e.clientY)); app$.style.setProperty('--pal-h', `${palH}px`); }, () => { if (palH) try { localStorage.setItem(K.pal, String(palH)); } catch { /* */ } });
    let vo = 0; drag($('splitter-chars'), e => { const top = $('outliner-chars').getBoundingClientRect().top; vo = Math.round(Math.max(40, e.clientY - top)); app$.style.setProperty('--voutl-h', `${vo}px`); }, () => { if (vo) try { localStorage.setItem(K.voutl, String(vo)); } catch { /* */ } });
  }
}

main().catch(e => { console.error(e); showFatal(String(e?.stack ?? e)); });
