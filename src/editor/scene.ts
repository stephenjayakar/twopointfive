// LevelData → the renderer: keeps the Engine's static box list, light set and sky in step with the editor's document, so what you edit is lit by the
// game's own renderer (that is the point of building the editor on the engine). Rebuilt from the data whenever the document changes — the whole
// conversion is loadLevel (scene/levelLoad.ts, ~1 ms for the office), so the editor and the game cannot disagree about what a record means:
//   statics  = data.boxes in ORDER (world.statics[i] ≡ data.boxes[i] — the CPU pick returns that index) + every prop's parts + volumes as thin outlines
//   dynamics = door leaves at their authored angle (game/doors.ts Door, the class the game hangs) + whatever preview boxes the active tool hands in
//   lights   = data.lights (lightFromDef) + the analytic AREA lights game.ts derives from thin lit switchable boxes (its rule mirrored here: Game's
//              constructor, 'flat emissive fixtures … light the scene through analytic one-sided area lights') + the sun when the daylight variant is on
//   sky / haze / exposure = data.sky, or data.daylight's when day is on (lighting.ts setDaylight's swap: groupsOn / groupsOff / lightsOff too)
// Headless (tools/qa/editor-probes.ts) the same code runs over BoxWorld / LightSet on the fake device.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import { Box, BoxFlag, BoxWorld, makeBox, rayBox } from '../scene/boxes';
import { LightSet, RtLight, lightFromDef } from '../render/lights';
import type { RenderSettings } from '../engine';
import type { Level } from '../scene/level';
import { loadLevel } from '../scene/levelLoad';
import { Door } from '../game/doors';
import type { Editor } from './editor';
import { yawAxes } from './geom';
import { DEVICE_DEFAULTS } from '../scene/levelData';

export interface EngineLike { world: BoxWorld; lights: LightSet; settings: RenderSettings }
export interface PickHit { ref: string; t: number; point: Vec3; normal: Vec3; /** index into world.all */ index: number }

const VOL_COLOR: Record<string, Vec3> = { hide: [0.2, 0.9, 0.6], utility: [0.9, 0.75, 0.25], trigger: [0.9, 0.35, 0.8] };

export class Scene {
  level: Level | null = null;
  /** why the last rebuild failed (an unresolved reference mid-edit) — the previous scene stays up meanwhile */
  error: string | null = null;
  /** statics layout: [0, nBoxes) = data.boxes · then per prop its parts · then volume outline sticks */
  nBoxes = 0; propRanges: { id: string; start: number; count: number }[] = []; volRanges: { id: string; start: number; count: number }[] = []; devRanges: { id: string; start: number; count: number }[] = [];
  doors: { id: string; door: Door }[] = [];
  lightsById = new Map<string, RtLight>(); areaLights: RtLight[] = []; sun: RtLight | null = null;
  /** boxes the active tool wants drawn this frame (footprint previews, a light's stand-in bulb) — dynamics after the leaves */
  preview: Box[] = [];
  private geoDirty = true; private lightDirty = true;
  private facingCache = new Map<string, Vec3>();
  stats = { rebuilds: 0, lastMs: 0, boxes: 0, lights: 0, areaLights: 0 };
  private night = { skyZenith: [0, 0, 0] as Vec3, skyHorizon: [0, 0, 0] as Vec3, haze: 0.035, exposure: 2.0 };

  constructor(readonly engine: EngineLike, readonly ed: Editor) {
    this.night = { skyZenith: [...engine.settings.skyZenith] as Vec3, skyHorizon: [...engine.settings.skyHorizon] as Vec3, haze: engine.settings.hazeDensity, exposure: engine.settings.exposure };
    ed.doc.onChange((changed) => {
      if (changed.has('*') || changed.has('boxes') || changed.has('props') || changed.has('volumes') || changed.has('doors') || changed.has('devices') || changed.has('materials') || changed.has('floors')) this.geoDirty = true;
      this.lightDirty = true;   // (lights, switchables, daylight, sky — and area lights follow the boxes)
      if (changed.has('*')) this.facingCache.clear();
    });
    ed.onSettings.push(() => { this.geoDirty = true; this.lightDirty = true; });
  }
  invalidate() { this.geoDirty = true; this.lightDirty = true; }

  /** Bring the engine up to date with the document (call once a frame before render; cheap when nothing changed). */
  sync(): void {
    if (!this.geoDirty && !this.lightDirty) { this.setDynamics(); return; }
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let level: Level;
    try { level = loadLevel(this.ed.data, { validate: false }); this.error = null; }
    catch (e) { this.error = String((e as Error).message ?? e); this.setDynamics(); return; }   // keep the last good scene up
    this.level = level;
    this.buildGeometry(level);   // (both, always: the lights write emissive / AreaLit onto the level's boxes, which must be the ones the world holds — ~4 ms for the office)
    this.compactMarkTable();
    this.buildLights(level);
    this.geoDirty = false; this.lightDirty = false;
    this.setDynamics();
    this.stats.rebuilds++; this.stats.lastMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  }

  private buildGeometry(level: Level) {
    const W = this.engine.world; const statics: Box[] = W.statics; statics.length = 0;
    const showHidden = this.ed.settings.showHidden;
    for (const b of level.boxes) { if (showHidden && (b.flags & BoxFlag.NoPrimary)) b.flags &= ~BoxFlag.NoPrimary; statics.push(b); }
    this.nBoxes = level.boxes.length;
    // props: their parts as statics in the prop's frame (props.ts frameAt convention: local +X → (cos, −sin), +Z → (sin, cos))
    this.propRanges.length = 0;
    level.props.forEach((p, i) => {
      const start = statics.length; const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      for (const q of p.parts) statics.push(makeBox({ c: [p.x + cs * q.off[0] + sn * q.off[2], q.off[1], p.z - sn * q.off[0] + cs * q.off[2]], h: v3.copy(q.h), yaw: p.yaw + q.yaw, albedo: v3.copy(q.albedo), ...(q.marks?.length ? { marks: q.marks } : {}) }));   // (the part's markings ride on its box, as props.ts makes it: the tape and glyphs on a carton show in the editor too)
      this.propRanges.push({ id: this.ed.data.props[i].id, start, count: statics.length - start });
    });
    // volumes: twelve thin emissive sticks along the edges (the renderer has no transparency; sticks read as a wire box and cost few rays: NoShadow)
    this.volRanges.length = 0;
    for (const v of this.ed.data.volumes) {
      const start = statics.length; const col = VOL_COLOR[v.kind] ?? [0.8, 0.8, 0.8]; const t = 0.012; const yaw = v.yaw ?? 0; const { ax, az } = yawAxes(yaw);
      const c = v.c as Vec3, h = v.h as Vec3;
      const stick = (o: Vec3, hh: Vec3) => statics.push(makeBox({ c: o, h: hh, yaw, albedo: [0.05, 0.05, 0.05], emissive: v3.scale(col, 1.5), flags: BoxFlag.NoShadow }));
      for (const sy of [-1, 1]) for (const s of [-1, 1]) { stick(v3.mad(v3.mad(c, az, s * h[2]), [0, 1, 0], sy * h[1]), [h[0], t, t]); stick(v3.mad(v3.mad(c, ax, s * h[0]), [0, 1, 0], sy * h[1]), [t, t, h[2]]); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stick(v3.mad(v3.mad(c, ax, sx * h[0]), az, sz * h[2]), [t, h[1], t]);
      this.volRanges.push({ id: v.id, start, count: statics.length - start });
    }
    // devices: stand-ins the shape of what game/devices.ts draws (a camera's bracket / body / lens with its LED lit, a pad's plate + LED, an emitter, a receiver and
    // the beam as a thin emissive stick) — pickable as device:<id>; NoShadow like the volumes' sticks (gizmos, not geometry)
    this.devRanges.length = 0;
    for (const v of this.ed.data.devices) {
      const start = statics.length; const gz = BoxFlag.NoShadow;
      if (v.kind === 'camera') {
        const pitch = v.pitch ?? DEVICE_DEFAULTS.pitch; const cp = Math.cos(pitch); const look: Vec3 = [Math.sin(v.yaw) * cp, Math.sin(pitch), Math.cos(v.yaw) * cp];
        statics.push(makeBox({ c: v3.mad(v.pos as Vec3, [-Math.sin(v.yaw), 0, -Math.cos(v.yaw)], 0.16), h: [0.03, 0.03, 0.09], yaw: v.yaw, albedo: [0.05, 0.05, 0.06], flags: gz }));
        statics.push(makeBox({ c: v3.mad(v.pos as Vec3, look, -0.03), h: [0.07, 0.06, 0.11], yaw: v.yaw, albedo: [0.16, 0.17, 0.19], flags: gz }));
        statics.push(makeBox({ c: v3.mad(v.pos as Vec3, look, 0.09), h: [0.035, 0.035, 0.025], yaw: v.yaw, albedo: [0.02, 0.02, 0.03], emissive: [3, 0.2, 0.1], flags: gz }));
      } else if (v.kind === 'keypad') {
        const n: Vec3 = [Math.sin(v.yaw), 0, Math.cos(v.yaw)];
        statics.push(makeBox({ c: v3.mad(v.pos as Vec3, n, 0.012), h: [0.05, 0.07, 0.014], yaw: v.yaw, albedo: [0.22, 0.23, 0.25], flags: gz }));
        statics.push(makeBox({ c: v3.add(v3.mad(v.pos as Vec3, n, 0.028), [0, 0.05, 0]), h: [0.014, 0.008, 0.004], yaw: v.yaw, albedo: [0.04, 0.04, 0.04], emissive: [2.5, 0.2, 0.1], flags: gz }));
      } else {
        const seg = v3.sub(v.to as Vec3, v.from as Vec3); const L = v3.len(seg); const dir = v3.scale(seg, 1 / Math.max(L, 1e-6)); const yaw = Math.atan2(dir[0], dir[2]);
        statics.push(makeBox({ c: v3.mad(v.from as Vec3, dir, -0.03), h: [0.035, 0.04, 0.035], yaw, albedo: [0.14, 0.14, 0.16], flags: gz }));
        statics.push(makeBox({ c: v3.mad(v.to as Vec3, dir, 0.03), h: [0.035, 0.04, 0.035], yaw, albedo: [0.14, 0.14, 0.16], flags: gz }));
        if (Math.abs(dir[1]) < 0.3) statics.push(makeBox({ c: v3.lerp(v.from as Vec3, v.to as Vec3, 0.5), h: [0.006, 0.006, L / 2], yaw, albedo: [0.05, 0, 0], emissive: [9, 0.5, 0.3], flags: gz }));   // (a level beam — the game tilts a box for a sloped one; the editor's plan view does not need it)
      }
      this.devRanges.push({ id: v.id, start, count: statics.length - start });
    }
    W.staticsDirty = true;
    // door leaves (the game's Door places its own box at the authored angle)
    this.doors = level.doors.map((d, i) => ({ id: this.ed.data.doors[i].id, door: new Door({ ...d, albedo: d.exterior ? [0.2, 0.22, 0.25] : undefined }) }));
    this.stats.boxes = statics.length;
  }
  /** The marking table in the tail of BoxWorld.matBuf is APPEND-ONLY (scene/boxes.ts registers a box's list on first sight, keyed by content, and never frees a
   *  row — right for the game, which meets a fixed set of lists). An editor session paints: every stroke is a new list, ~30 rows for a 32 × 32 bitmap, and the
   *  6144-row table would fill inside a few hundred strokes (lists past it get slot 0 = not drawn). So once the table is more than two-thirds taken, drop the
   *  registry (BoxWorld.resetMarkTable) right after buildGeometry — every marked box is a fresh object at this point, so the next upload re-registers exactly the
   *  lists in use. (A level whose own lists alone approach the table is lint's 'mark-rows' warning: compaction cannot help that one.) */
  markCompactions = 0;
  private compactMarkTable() {
    const W = this.engine.world;
    if (W.markTableFill < 0.66) return;
    W.resetMarkTable();
    this.markCompactions++;
  }
  private setDynamics() {
    const dyn: Box[] = [];
    for (const { door } of this.doors) { dyn.push(door.box); for (const hb of door.handleBoxes) dyn.push(hb); }
    for (const b of this.preview) dyn.push(b);
    this.engine.world.dynamics = dyn;
  }

  private buildLights(level: Level) {
    const LS = this.engine.lights; const S = this.engine.settings; const data = this.ed.data;
    const keep = LS.lights.filter(l => l.ttl >= 0);   // (transients, were there any)
    LS.lights.length = 0; this.lightsById.clear(); this.areaLights.length = 0; this.sun = null;
    const day = this.ed.settings.day && !!data.daylight; const D = data.daylight;
    const on = new Set(day ? D!.groupsOn : []), off = new Set(day ? D!.groupsOff : []), lightsOff = new Set(day ? D!.lightsOff : []);
    level.lights.forEach((ld, i) => {
      const l = LS.add(lightFromDef(ld)); const id = data.lights[i].id;
      if (day) { if (lightsOff.has(id) || off.has(l.group)) l.enabled = false; else if (on.has(l.group)) l.enabled = true; }
      this.lightsById.set(id, l);
    });
    if (day && level.daylight) { this.sun = LS.add(lightFromDef(level.daylight.sun)); this.sun.enabled = true; }
    // switchables: box emissive follows the switch (as game.ts updateTargets writes it), and thin lit faces become area lights (Game constructor's rule)
    let nArea = 0;
    for (const sw of level.switchables) {
      const swOn = day ? (on.has(sw.group) ? true : off.has(sw.group) ? false : sw.on) : sw.on;
      for (const bi of sw.boxes) { const b = level.boxes[bi]; b.emissive = swOn ? v3.copy(sw.baseEmissive) : [0, 0, 0]; }
      if (sw.group === 'server_leds' || sw.group === 'emergency') continue;
      for (const bi of sw.boxes) {
        const b = level.boxes[bi]; const h = b.h;
        const thin = h[0] <= h[1] && h[0] <= h[2] ? 0 : h[1] <= h[2] ? 1 : 2; if (h[thin] > 0.06) continue;
        const a0 = (thin + 1) % 3, a1 = (thin + 2) % 3; const area = 4 * h[a0] * h[a1]; if (area < 0.01) continue;
        const n = this.facing(b, thin, bi);
        const e = sw.baseEmissive; const maxc = Math.max(e[0], e[1], e[2], 1e-3); const I0 = maxc * area;
        const light = LS.add({ name: `${sw.name}_area${bi}`, group: sw.group, kind: 3, pos: v3.mad(b.c, n, h[thin] + 0.07), dir: n, color: [e[0] / maxc, e[1] / maxc, e[2] / maxc], intensity: I0,
          range: Math.min(26, Math.max(3, Math.sqrt(I0 / 0.0015))), innerDeg: 0, outerDeg: 90, radius: Math.max(0.1, Math.min(Math.sqrt(area / Math.PI), Math.min(h[a0], h[a1]) + 0.02)), volumetric: 0, owner: 0, enabled: swOn, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: I0, broad: true });
        this.areaLights.push(light); b.flags |= BoxFlag.AreaLit; nArea++;
      }
    }
    for (const bc of level.beacons) level.boxes[bc.box].flags |= BoxFlag.AreaLit;
    for (const l of keep) LS.lights.push(l);
    // sky / haze / exposure
    if (day && level.daylight) { S.skyZenith = v3.copy(level.daylight.sky.zenith); S.skyHorizon = v3.copy(level.daylight.sky.horizon); S.hazeDensity = level.daylight.haze; S.exposure = level.daylight.exposure; }
    else { S.skyZenith = v3.copy(level.sky.zenith); S.skyHorizon = v3.copy(level.sky.horizon); S.hazeDensity = this.night.haze; if (S.exposure === (level.daylight?.exposure ?? -1)) S.exposure = this.night.exposure; }
    this.stats.lights = LS.lights.length; this.stats.areaLights = nArea;
  }
  /** which side a thin fixture emits from: ceiling fixtures down; wall / desk cards toward the open side (a short ray each way against the statics), cached per box shape */
  private facing(b: Box, thin: number, bi: number): Vec3 {
    if (thin === 1) return [0, b.c[1] > 1.5 ? -1 : 1, 0];
    const key = `${bi}|${b.c.join(',')}|${b.h.join(',')}|${b.yaw}`; const hit = this.facingCache.get(key); if (hit) return hit;
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const ax: Vec3 = thin === 0 ? [cs, 0, -sn] : [sn, 0, cs];
    const reach = b.h[thin] + 0.35;
    const blocked = (dir: Vec3) => { const statics = this.engine.world.statics; for (let i = 0; i < this.nBoxes; i++) { if (i === bi) continue; const o = statics[i]; if (o.flags & BoxFlag.NoShadow) continue; const r = rayBox(b.c, dir, o, reach); if (r && r.t >= 0) return true; } return false; };
    const front = !blocked(ax), back = !blocked(v3.scale(ax, -1));
    const n = front && !back ? ax : !front && back ? v3.scale(ax, -1) : ax;
    this.facingCache.set(key, n); if (this.facingCache.size > 4000) this.facingCache.clear();
    return n;
  }

  // ---------------------------------------------------------------- picking
  /** what a world.all index is: a data box, a prop, a volume, a door leaf — as a selection ref */
  refOfIndex(index: number): string | null {
    const W = this.engine.world; const nS = W.statics.length;
    if (index < this.nBoxes) return `box:${this.ed.data.boxes[index]?.id}`;
    if (index < nS) { for (const r of this.propRanges) if (index >= r.start && index < r.start + r.count) return `prop:${r.id}`; for (const r of this.volRanges) if (index >= r.start && index < r.start + r.count) return `volume:${r.id}`; for (const r of this.devRanges) if (index >= r.start && index < r.start + r.count) return `device:${r.id}`; return null; }
    const di = index - nS; let k = 0;
    for (const { id, door } of this.doors) { const n = 1 + door.handleBoxes.length; if (di < k + n) return `door:${id}`; k += n; }
    return null;   // a preview box
  }
  /** closest thing under a ray (CPU slab tests over world.all — statics then dynamics); NoPrimary boxes are skipped unless showHidden */
  pick(ro: Vec3, rd: Vec3, tmax = 500, opts: { skipRefs?: Set<string> } = {}): PickHit | null {
    const W = this.engine.world; const nS = W.statics.length;
    const skip = this.ed.settings.showHidden ? 0 : BoxFlag.NoPrimary;
    let best = tmax, bi = -1; let bn: Vec3 = [0, 1, 0];
    const nDoor = this.doors.reduce((s, d) => s + 1 + d.door.handleBoxes.length, 0);   // leaves + handles; never the tool's own preview boxes after them
    for (let i = 0; i < nS + Math.min(nDoor, W.dynamics.length); i++) {
      const b = i < nS ? W.statics[i] : W.dynamics[i - nS]; if (b.flags & skip) continue;
      if (opts.skipRefs?.size) { const r0 = this.refOfIndex(i); if (r0 && opts.skipRefs.has(r0)) continue; }
      const r = rayBox(ro, rd, b, best); if (r && r.t < best) { best = r.t; bi = i; bn = r.n; }
    }
    if (bi < 0) return null;
    const ref = this.refOfIndex(bi); if (!ref) return null;
    return { ref, t: best, point: v3.mad(ro, rd, best), normal: bn, index: bi };
  }
}
