// The automation / debugging hooks the two pages hang on `window` (the game's in main.ts, the workbench's — level editor + viewer — in
// workbench/main.ts; CLAUDE.md and VIEWER.md list them), declared once so both assign them typed instead of through `(window as any)`. Types
// only: nothing here runs, nothing imports it — tsc picks the file up through tsconfig's include glob and merges the block into the global
// Window. Every hook is optional because it only exists once its page has installed it (and the automation-set ones only when a script sets
// them). The many knob-panel hooks (`__wet`, `__glass`, `__froxel` …) share the KnobHook shape: `summary()`, usually `knobs()` / `set({})`, plus
// their own verbs — described structurally here so a script gets completion without this file importing half the game.
import type { Engine } from './engine';
import type { Game } from './game/game';
import type { FollowCamera } from './game/camera';
import type { Demo } from './game/demo';
import type { Input } from './game/input';
import type { Character, Stance, SignalKind, LongStance } from './game/character';
import type { Rig } from './game/rigProps';
import type { SmokeSystem } from './smoke/smoke';
import type { Menu } from './ui/menu';
import type { Quality } from './ui/quality';
import type { AudioEngine } from './audio/audio';
import type { RigGizmo } from './viewerGizmo';
import type { Attract } from './game/attract';
import type { Director } from './game/director';
import type { PerfRecorder } from './ui/perfrec';
import type { BootSummary } from './ui/boot';
import type { EditorApi } from './editor/api';
import type { Tools as EditorTools } from './editor/tools';
import type { View as EditorView } from './editor/view';
import type { Scene as EditorScene } from './editor/scene';
import type { Ui as EditorUi } from './editor/ui';
import type { Runtime as ViewerRuntime } from './viewer/runtime';
import type { Ui as ViewerUi } from './viewer/ui';

/** One WGSL compiler message as __wgsl reports it (line numbers relative to the submitted source, prelude subtracted). */
export interface WgslLintMessage { type: GPUCompilationMessageType; line: number; col: number; msg: string; src: string; }
/** The shape the knob-panel hooks share (`__wet`, `__glass`, `__froxel`, `__rt`, `__gi`, `__dn`, `__taa`, `__sharp`, `__sdfrig`, `__mark`, `__destr` …): a one-line summary,
 *  usually the knob table and a setter taking a partial of it, plus the module's own verbs and read-outs (indexed loosely — each is documented in CLAUDE.md's bullet). */
export interface KnobHook { summary(): string; knobs?(): Record<string, unknown>; set?(patch: Record<string, unknown>): unknown; [verb: string]: unknown; }
/** a shader hot-swap hook: recompile the pass from `src` (or the file the dev server serves under /qa/shader/) into the live page — resolves to the compiler's verdict */
export type HotSwapHook = (src?: string) => Promise<unknown>;

declare global {
  interface Window {
    // ---- shared by the game page (main.ts) and the viewer (viewer.ts)
    __engine?: Engine;
    __cam?: FollowCamera;
    /** render one offscreen frame, read it back and POST a JPEG to the capture sink (tools/shot-server.ts); the viewer's takes no scale */
    __shot?: (name: string, quality?: number, scale?: number) => Promise<string>;

    // ---- game page
    __game?: Game; __demo?: Demo; __input?: Input; __smoke?: SmokeSystem; __menu?: Menu; __audio?: AudioEngine; __quality?: Quality;
    /** n fixed steps of dt with the given key codes held (synthetic input; works with the rAF loop paused) */
    __runFrames?: (n: number, dt?: number, keys?: string[], draw?: boolean) => void;
    /** move the synthetic cursor (CSS px in the canvas); buttons: 1 LMB, 4 RMB held */
    __mouse?: (x: number, y: number, buttons?: number) => void;
    /** fixed camera framing + staging for captures (main.ts): pin = { look, yaw, pitch, dist } | null; opts.park / guards / player */
    __stage?: (pin: { look: [number, number, number]; yaw: number; pitch: number; dist: number } | null, opts?: { park?: boolean; guards?: { i: number; pos: [number, number, number]; yaw?: number; torch?: boolean; aimPitch?: number }[]; player?: { pos?: [number, number, number]; yaw?: number; crouch?: boolean; holstered?: boolean; invisible?: boolean } }) => { pinned: boolean; parked: boolean; guards: number; player: boolean };
    /** edge-trigger a mouse button this frame (0 LMB, 1 MMB, 2 RMB) */
    __click?: (button?: number) => void;
    /** lossless PNG readback to the capture sink (pixel A/B; pair with __pauseLoop) */
    __png?: (name: string) => Promise<string>;
    /** zero the per-frame counters behind jitter / grain / parities and snap the camera, for repeatable scripted captures */
    __resetClock?: () => void;
    /** compile-check WGSL against the live device with the scene passes' prelude ('scene' = world consts + common.wgsl, true | 'lighting' = + lighting_common.wgsl) */
    __wgsl?: (code: string, opts?: { prelude?: boolean | 'scene' | 'lighting'; label?: string }) => Promise<WgslLintMessage[]>;
    /** true: the rAF loop renders nothing and advances nothing — only __runFrames does (?paused sets it at boot) */
    __pauseLoop?: boolean;
    /** multiplier on the game clock (1 = real time) */
    __timeScale?: number;
    /** set by automation: treat the (headless, nominally hidden) pane as visible so quality calibration / sampling run */
    __testVisible?: boolean;
    /** the Audio panel's 'force tension' slider is pinning the score intensity (main.ts then leaves it alone) */
    __forcedTension?: boolean;
    /** decals (experiment E1): the panel's buttons by hand — the test pattern in front of Sam, n random interior marks, clear; each returns the count placed */
    __marks?: { test: () => number; random: (n?: number, seed?: number) => number; clear: () => void; bang: (p: [number, number, number]) => void; scuff: (door: string, from?: [number, number, number]) => boolean };
    /** replay tools/qa/mesh-shadow-fixture.json through the production mesh-shadow walk on the GPU and compare with the CPU reference (main.ts; ?paused page) */
    __meshTrace?: (fixture: { digest: string; joints: number[]; rays: number[][]; expect: number[]; nodes: number }) => Promise<unknown>;
    /** resolves once every hook is assigned and the start card is live (rejects if the boot dies) — `await window.__ready` is the one line a script needs */
    __ready?: Promise<void>;
    /** the boot timeline (ui/boot.ts): marks, pipeline counts, long tasks, frame gaps, first-frame GPU + the one console line */
    __boot?: BootSummary & { line: string };
    /** the numbers behind the HUD's read-outs (main.ts `readout`) */
    __readout?: Record<string, unknown>;
    /** the start card's attract mode (game/attract.ts): .start() / .stop() / .poke(), .active / .live */
    __attract?: Attract;
    /** the level script's DIRECTOR (game/director.ts): .programs, .armed, .problems, .start(name) / .stop(), .run, .log / rowsOf(), .frame, .summary() */
    __director?: Director;
    /** the F9 perf recorder (ui/perfrec.ts) */
    __perfrec?: PerfRecorder;
    __perfsweep?: import('./ui/perfsweep').PerfSweep;
    /** THE list of knob tables (game/knobs.ts): `registry()` every switch table by name (the live objects), `copy()` a deep copy, `back(copy)` puts one back */
    __knobs?: { registry(): Record<string, object>; copy(names?: readonly string[]): Record<string, Record<string, unknown>>; back(copy: Record<string, Record<string, unknown>>): void };
    /** the session journal (game/journal.ts, F10): start / stop / re-download the last file, its state and counters */
    __journal?: { start(opts?: { seed?: number; note?: string }): string; stop(immediate?: boolean): unknown; toggle(): string; save(): string; readonly state: string; readonly file: unknown; readonly stats: Record<string, unknown>; check(f?: unknown): string; summary(): string; [k: string]: unknown };
    /** staging: drop guard i as if shot / struck (killGuard through the real path); false if he is already down */
    __killGuard?: (i: number, how?: 'shot' | 'struck' | 'wounded', zone?: 'side' | 'leg', dir?: [number, number, number]) => boolean;
    /** the animation's life-layer / foot-lock constant tables (character.ts LIFE, FEET) — noise measurements zero their `on` */
    __anim?: { LIFE: Record<string, unknown>; FEET: Record<string, unknown> };
    /** warm the smoke + particle pipelines behind the start card once (false when it already ran) */
    __prewarm?: () => boolean;
    /** the response team by hand: request / perimeter / standDown, .state = Game.qrf */
    __qrf?: { request(why?: string): unknown; perimeter(why?: string): unknown; standDown(): void; readonly state: unknown };
    /** the civilians by hand: list, panic(i, 'panic' | 'phone'), set(on), knobs, stats, log, spots, check, summary */
    __civ?: KnobHook & { panic(i?: number, what?: 'panic' | 'phone'): unknown; set(on: boolean): unknown };
    /** wounds (game/wounds.ts, ?wounds): on, knobs, stats, men() */
    __wounds?: { on: boolean; [k: string]: unknown };
    __wallsnap?: { on: boolean; [k: string]: unknown };
    /** the 2010s issue kit (game/gear.ts, ?oldgear = off): the switch, live */
    __gear?: { on: boolean };
    /** the needs by hand: send(i, kind) / trip(i) / log */
    __needs?: { send(i?: number, kind?: string): unknown; trip(i?: number): unknown; [k: string]: unknown };
    /** checkpoints by hand (game/savestate.ts via main.ts): save / load / slots / newest / export / import / clear / auto / summary / canSave / snapshot */
    __save?: { save(label?: string, force?: boolean): unknown; load(key: string): string | null; slots(): unknown[]; summary(): string; [k: string]: unknown };
    /** destruction by hand (game/destruction.ts): chaos, stats, log, knobs, debris, inventory(), summary(), heat(p), escalation(p), bang(p), burst(p, n, every), reset(), defaults() */
    __destr?: KnobHook;
    /** the SDF character rig's ray queries on the live scene group vs a disc integral (render/rigDebug.ts) */
    __rigTrace?: (rays: number[][]) => Promise<unknown>;
    /** knob panels of the renderer's systems and the game's presentation modules — see KnobHook and each system's CLAUDE.md bullet */
    __wet?: KnobHook; __weather?: KnobHook; __glass?: KnobHook; __froxel?: KnobHook; __particles?: KnobHook; __taa?: KnobHook; __sharp?: KnobHook; __sdfrig?: KnobHook; __mark?: KnobHook; __dn?: KnobHook; __gi?: KnobHook;
    /** the RT-reflection + material knobs (renderer v3 phase 4) on the GAME page — the workbench's viewer Runtime is __vrt, not this */
    __rt?: KnobHook;
    /** shader hot-swap: volumetrics / restir / direct / reflect / gather / froxel / denoise from disk into the live page */
    __hotVol?: HotSwapHook; __hotRestir?: HotSwapHook; __hotDirect?: HotSwapHook; __hotReflect?: HotSwapHook; __hotGather?: HotSwapHook; __hotFroxel?: HotSwapHook; __hotDenoise?: HotSwapHook;
    /** the capture sink's port for this page's __shot / __png (default 5174; a lane's own sink on another) */
    __shotPort?: number;

    // ---- workbench (level editor + viewer in one shell: workbench/main.ts, editor/app.ts)
    /** the level editor's whole API (editor/api.ts makeApi — docs/level-format.md 'Editor') */
    __ed?: EditorApi;
    /** editor captures: the view + overlay / + the inspector column rasterised beside it */
    __edshot?: (name: string, q?: number, withOverlay?: boolean) => Promise<string>; __uishot?: (name: string, q?: number) => Promise<string>;
    __tools?: EditorTools; __view?: EditorView; __scene?: EditorScene; __ui?: EditorUi;
    /** reload the bundled office into the editor (the load menu's 'the bundled office') */
    __edLoadBundled?: () => unknown;
    /** the workbench shell: mode / setMode / modes / world / staged / actor / scene(id | null, variant) / hash / frameFigure / fps / collision */
    __wb?: { readonly mode: string; setMode(m: string): string; readonly modes: string[]; readonly world: string | null; readonly staged: string | null; scene(sceneId: string | null, variantId?: string): unknown; readonly collision: 'level' | 'studio'; [k: string]: unknown };
    /** the workbench's idle throttle: idle now?, poke(), the constants */
    __idle?: { readonly idle: boolean; poke(): void; after: number; afterFigure: number; every: number };
    /** the viewer Runtime itself (viewer/runtime.ts) and its chrome (viewer/ui.ts) inside the workbench */
    __vrt?: ViewerRuntime; __vui?: ViewerUi;
    /** the gait meter (`slip cadence stance bob gaze gazeBob`, line()), the viewer state under its lab name, the scenes ▸ variants table */
    __M?: unknown; __lab?: unknown; __scenes?: { id: string; staging: boolean; variants: string[] }[];

    // ---- viewer
    /** the viewer's panel state object (drive / kit / stance selections …) */
    __viewer?: unknown;
    /** the mannequin (a getter: respawn replaces the Character) */
    __char?: Character;
    __rig?: Rig; __gizmo?: RigGizmo; __rigSource?: () => string;
    /** advance the viewer n frames of 1/60 s */
    __step?: (n?: number) => void;
    /** toss a dropped item from the hand onto the stage */
    __toss?: (kind: 'pistol' | 'torch' | 'smoke' | 'flash' | 'mag', suppressed?: boolean) => void;
    __cans?: { smokeCan(): void; stunCan(): void };
    /** the viewer's running clock (what its __shot renders with) */
    __vtime?: number;
    /** scripted stills of the procedural tactical layer: __tac.stance('stack', -1); __tac.kick(); __tac.at(0.38, 'kick') … */
    __tac?: {
      stance(name: Stance, side?: -1 | 1): void; peek(v: number): void; kick(): void; signal(kind: SignalKind): void; flinch(): void; throw(): void;
      lockpick(on: boolean): void; loop(on: boolean, shot?: number, every?: number): void;
      at(t: number, shot?: 'kick' | SignalKind | 'flinch' | 'throw'): string; resume(): void;
      long(on: boolean, name?: LongStance | null): void;
    };
    /** the viewer's grab / hold section (holder or held man alone, arm or gun variant): __hold.set({ on: true, who: 0, variant: 1, phase: 3, auto: false, t: 0.6 }) */
    __hold?: { set(o: Record<string, unknown>): unknown; HOLD: unknown };
    /** rifles: the long gun's carriage table (character.ts LONG, edited live by the viewer's L· sliders) and its source text; the carbine itself: __tac.long(true, 'shoulder') */
    __long?: { LONG: unknown; source(): string };
  }
}
