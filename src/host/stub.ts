// stubHost — the HEADLESS HostApi, promoted from tools/qa/headless.ts: a Proxy that is
// anything you ask of it stands in for the GPU device, so the CPU halves of BoxWorld (packing, grid, raycasts) and LightSet (add / flash / update / upload) run for real and
// nothing renders; the light probe the Game builds on it never answers (player.visibility / irradiance stay whatever a script sets, every guard's smokeTrans stays 1).
// The member set is EXACTLY headless.ts's stand-in — device, sceneLayout, skin, lights, world, settings, effectiveScale — and nothing more: every frozen digest in tools/qa was
// recorded against a Game that found no setParticles / setDecals / weather / viewFocus on its engine, and the game's defensive reads keep it that way (src/host/api.ts).
// Import ORDER matters under bun: './gpuEnums' first — the WebGPU enum globals must exist before any render module that names one at load evaluates.
import './gpuEnums';
import type { HostApi } from './api';
import { BoxWorld } from '../scene/boxes';
import { LightSet } from '../render/lights';
import { defaultSettings } from '../settings';
import type { RenderSettings } from '../settings';

/** An object that is anything you ask of it: every property is another fake, every call returns one, promises never settle (except shader compile info) — the harness's GPU. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fake(name = 'gpu'): any {
  const fn = function () { /* callable target */ };
  return new Proxy(fn, {
    get(_t, p) {
      if (p === 'then') return undefined;                       // never look like a thenable
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === 'toString' || p === Symbol.toStringTag) return () => `[fake ${name}]`;
      if (p === 'getCompilationInfo') return () => Promise.resolve({ messages: [] });
      if (p === 'mapAsync') return () => new Promise(() => { /* never resolves: no readbacks headless */ });
      if (p === 'label') return name;
      return fake(`${name}.${String(p)}`);
    },
    apply() { return fake(`${name}()`); },
    construct() { return fake(`${name}#new`); },
    set() { return true; },
  });
}

/** the stand-in as headless.ts always built it, typed: a fresh device / layout fake, an empty world + light set on it, default settings, effectiveScale 1, skin null.
 *  `settings` may be handed in (a replayed recording's env applied first — tools/qa/replay.ts / headless.ts standUp({env})) */
export function stubHost(opts: { settings?: RenderSettings } = {}): HostApi & { device: GPUDevice; skin: HostApi['skin'] } {
  const device = fake('device') as GPUDevice;
  return { device, sceneLayout: fake('sceneLayout') as GPUBindGroupLayout, skin: null, lights: new LightSet(device), world: new BoxWorld(device), settings: opts.settings ?? defaultSettings(), effectiveScale: 1 };
}
