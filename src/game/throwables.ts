// Simple rigid bodies for thrown / dropped items (smoke canisters, empty magazines): ballistic flight with
// swept collision against the static boxes, bounce + friction, settle. Rendered as small dynamic boxes.
import { Vec3, v3, quat } from '../math/vec';
import { StaticCollision } from '../scene/collision';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import type { PropSystem, Prop } from './props';

export type ItemKind = 'smoke' | 'mag' | 'flash' | 'pistol' | 'torch' | 'rifle' | 'ring';   // pistol / torch / rifle: dropped from a dying hand (combat.ts dropFromHand — the rifle is what the long-gun rows let go of, weapons.ts WeaponDef.drop: a rifleman's whole AKS-74U, or with fill 1 Sam's FN2000) — physical like the rest (tumble, bounce, settle, nudge props), and set dressing once down: nobody picks them up (a guard's magazines would not fit the Five-seveN anyway, and nothing on the floor is ammunition); ring: a spent ring airfoil (launcher.ts hands it over the moment its flight ends — off a wall, off a man — to clatter down and lie there: not retrievable either)

/** The FN2000 on the floor (a 'rifle' item with fill 1 — combat.ts hitPlayer drops it out of Sam's hands): the bullpup's own silhouette in RIG.sc20k's two albedos —
 *  the long polymer hull with the box straight down BEHIND the grip point, the fore-end and the can ahead, the sight block on top — same contact sphere and dead
 *  bounces as the carbine's item, lying on its side once down like every dropped gun. */
export const SC20K_ITEM = {
  hull: { z: -0.06, h: [0.024, 0.04, 0.215] as [number, number, number] },      // centre along the item's length (+ toward the muzzle, 0 = the grip) and half extents: hull + buttpad −0.275‥0.155
  fore: { z: 0.3, h: [0.02, 0.024, 0.155] as [number, number, number] },        // fore-end + suppressor as one length out to the muzzle at 0.455
  mag: { z: -0.115, y: -0.1, h: [0.012, 0.06, 0.016] as [number, number, number] },   // the box straight down behind the grip
  optic: { z: 0.02, y: 0.06, h: [0.017, 0.02, 0.06] as [number, number, number] },
  thick: 0.024,
  polymer: [0.045, 0.05, 0.046] as Vec3, metal: [0.026, 0.026, 0.03] as Vec3,   // rigProps COL.polymer / COL.darkMetal, so the thing on the floor is the thing that was in his hands
};
/** the spent ring on the floor: a rubber ring 6 cm across drawn as three thin crossed slats (a hexagon's worth of ring at this size), pale so it reads on the lino */
export const RING_ITEM = { radius: 0.03, restitution: 0.3, friction: 0.6, life: 60, half: [0.03, 0.006, 0.007] as [number, number, number], albedo: [0.42, 0.4, 0.36] as Vec3 };

/** The dropped rifle's body (rifles, docs/internal/sc20k-design.md §3.5): a longer, heavier item than the sidearm — a bigger contact sphere so it does not fall
 *  through the gaps the pistol threads, deader bounces (a slung 2.7 kg carbine lands and skids, it does not hop), more friction, more of its momentum handed to a
 *  chair it strikes; drawn as four parts along its length (receiver, the wood ahead of it out to the booster, the curved box under, the skeleton stock behind —
 *  0.72 m in all, the hand's grip point about a third of the way along) tumbling end over end in the air and lying on its SIDE once down, like the pistol. */
export const RIFLE_ITEM = {
  radius: 0.06, restitution: 0.18, friction: 0.55, life: 240, propShare: 0.3,
  thick: 0.02,                                                    // half-thickness of the receiver: what rests on the floor when it lies on its side
  receiver: { z: -0.02, h: [0.018, 0.03, 0.13] as [number, number, number] },   // centre along the item's length (m, + toward the muzzle) and half extents
  fore: { z: 0.24, h: [0.02, 0.022, 0.13] as [number, number, number] },        // handguard + barrel + booster as one length of wood-and-steel
  mag: { z: 0.06, y: -0.075, h: [0.013, 0.05, 0.03] as [number, number, number], cant: 0.35 },   // the bakelite box out of the receiver floor, canted forward
  stock: { z: -0.27, h: [0.008, 0.026, 0.12] as [number, number, number] },      // the triangle stock, as one thin slab
  steel: [0.05, 0.05, 0.055] as Vec3, wood: [0.2, 0.085, 0.05] as Vec3,          // rigProps COL.gun / COL.furniture, so the thing on the floor is the thing that was in his hands
};

export interface Item {
  kind: ItemKind; pos: Vec3; vel: Vec3; radius: number; restitution: number; friction: number;
  yaw: number; spin: number; settled: boolean; age: number; fuse: number; fired: boolean; life: number;
  tumble: number; tumbleRate: number;   // end-over-end angle (rad) about the axis across its travel, and its rate: cans and mags flip in the air, damp on each bounce, ease flat when settled
  emitT: number;                 // seconds of emission left (smoke)
  fill: number;                  // magazines: rounds fraction (for size/colour), unused for smoke
  bounces: number;
  heading: number;               // yaw of the horizontal travel (set at the throw, refreshed while it skids): a smoke can vents the way it was thrown
  who: number;                   // character id that threw / dropped it (blamed for furniture it knocks)
  on: Prop | null; onPose: number;   // the prop it came to rest on, if any, and a key of that prop's pose at the time (it drops off once the prop has moved out from under it)
  serial: number;                // a running number per spawned item (motion identity: Throwables.boxes keys the item's parts off it)
  onBounce?: (speed: number, p: Vec3) => void;
}

export interface ThrowSolution { v0: Vec3; T: number; points: Vec3[]; land: Vec3; }

export const GRAVITY = 9.81;

export class Throwables {
  items: Item[] = [];
  /** the next item's serial (Item.serial) */
  private serial = 1;
  /** `props`: loose furniture — items bounce off it and hand over a little momentum */
  constructor(private col: StaticCollision, private props: PropSystem) {}

  /** Closest hit among statics + door leaves and props. */
  private ray(ro: Vec3, rd: Vec3, tmax: number): { t: number; n: Vec3; prop: Prop | null } | null {
    const st = this.col.raycast(ro, rd, tmax); const ph = this.props.raycast(ro, rd, st ? st.t : tmax);
    return ph ? { t: ph.t, n: ph.n, prop: ph.prop } : st ? { t: st.t, n: st.n, prop: null } : null;
  }

  spawn(kind: ItemKind, pos: Vec3, vel: Vec3, opts: Partial<Item> = {}): Item {
    const can = kind === 'smoke' || kind === 'flash';   // smoke and stun canisters share the body: same arc, same bounces
    const R = RIFLE_ITEM, rifle = kind === 'rifle', ring = kind === 'ring', G = RING_ITEM;
    const radius = can ? 0.055 : kind === 'pistol' ? 0.05 : kind === 'torch' ? 0.045 : rifle ? R.radius : ring ? G.radius : 0.03; const restitution = can ? 0.38 : kind === 'mag' ? 0.25 : rifle ? R.restitution : ring ? G.restitution : 0.22;
    const it: Item = { kind, pos: v3.copy(pos), vel: v3.copy(vel), radius, restitution, friction: kind === 'pistol' || kind === 'torch' ? 0.5 : rifle ? R.friction : ring ? G.friction : 0.35,
      yaw: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 14, tumble: Math.random() * 6.28, tumbleRate: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 9), settled: false, age: 0, fuse: 1.3, fired: false, life: kind === 'mag' ? 40 : ring ? G.life : 60, emitT: 0, fill: 0, bounces: 0, heading: v3.yawOf(vel), who: 0, on: null, onPose: 0, serial: this.serial++, ...opts };
    // FIFO cap (applied before the push, so the new item can never evict itself), but never evict a canister whose fuse is still running or that is still venting:
    // dropped mags and guns are items too, and a firefight must not swallow a stun charge already deducted from the player's kit — it would simply never go off —
    // nor take the can out from under a smoke screen still pouring from it (its emitter tracks the item: the smoke would go on from nowhere). Spent things first
    // (magazines, rings, a can that has gone off / finished venting), then the oldest dropped gun or torch; thirty-two LIVE cans (never, in play) evict nothing.
    // (Review B7.5: 'fired' alone read a venting smoke can as spent, and with nothing spent in the list the oldest item went whatever it was — the live can included.)
    if (this.items.length >= 32) {
      let i = this.items.findIndex(x => x.kind === 'mag' || x.kind === 'ring' || ((x.kind === 'smoke' || x.kind === 'flash') && !liveCan(x)));
      if (i < 0) i = this.items.findIndex(x => !liveCan(x));
      if (i >= 0) this.items.splice(i, 1);
    }
    this.items.push(it);
    return it;
  }

  /** Launch velocity from `from` to land at `to` with a pleasant arc; also returns sampled preview points until first impact. */
  solve(from: Vec3, to: Vec3, maxSpeed = 11): ThrowSolution {
    const d = v3.sub(to, from); const dist = Math.hypot(d[0], d[2]);
    let T = Math.min(1.25, Math.max(0.42, dist / 7.5));
    let v0: Vec3 = [d[0] / T, (d[1] + 0.5 * GRAVITY * T * T) / T, d[2] / T];
    const sp = v3.len(v0); if (sp > maxSpeed) { v0 = v3.scale(v0, maxSpeed / sp); }
    // preview: integrate until first hit
    const points: Vec3[] = []; let p = v3.copy(from); let v = v3.copy(v0); let land = v3.copy(to);
    const h = 1 / 30;
    for (let i = 0; i < 90; i++) {
      points.push(v3.copy(p));
      const np: Vec3 = [p[0] + v[0] * h, p[1] + v[1] * h - 0.5 * GRAVITY * h * h, p[2] + v[2] * h];
      const seg = v3.sub(np, p); const len = v3.len(seg);
      if (len > 1e-5) { const hit = this.ray(p, v3.scale(seg, 1 / len), len + 0.05); if (hit) { land = v3.mad(p, seg, hit.t / len); points.push(land); break; } }
      if (np[1] < 0.02) { land = [np[0], 0.02, np[2]]; points.push(land); break; }
      v = [v[0], v[1] - GRAVITY * h, v[2]]; p = np; T = i * h;
    }
    return { v0, T, points, land };
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt; it.life -= dt;
      if (it.life <= 0) { this.items.splice(i, 1); continue; }
      if (it.settled) { it.tumbleRate = 0; const flatA = Math.round(it.tumble / Math.PI) * Math.PI; it.tumble += (flatA - it.tumble) * Math.min(1, dt * 12);   // comes to rest lying along its axis (0 or half a turn)
        // resting on a chair seat / carton: stays put while that prop is still underneath (re-checked whenever its pose changes — shoved, or snapped home
        // by a reset), drops once it has moved out from under it
        if (!it.on || poseKey(it.on) === it.onPose) continue;
        const under = this.props.raycast([it.pos[0], it.pos[1] + 0.05, it.pos[2]], [0, -1, 0], 0.15);
        if (under && under.prop === it.on) { it.onPose = poseKey(it.on); continue; }
        it.settled = false; it.on = null; it.vel = [0, 0, 0];
      }
      const sub = 2; const h = dt / sub;
      for (let s = 0; s < sub && !it.settled; s++) {
        it.vel[1] -= GRAVITY * h;
        const move = v3.scale(it.vel, h); const len = v3.len(move);
        if (len < 1e-6) continue;
        const dir = v3.scale(move, 1 / len);
        // sphere-vs-box CCD from the centre ray: contact happens radius/cos(incidence) before the centre would hit
        let hit = this.ray(it.pos, dir, len + it.radius * 3.5);
        let back = 0;
        if (hit) { back = it.radius / Math.max(0.3, -v3.dot(dir, hit.n)); if (hit.t - back > len) hit = null; }
        if (hit) {
          // place at contact, reflect
          const tHit = Math.max(0, hit.t - back);
          it.pos = v3.mad(it.pos, dir, tHit);
          const n = hit.n; const vn = v3.dot(it.vel, n);
          if (vn < 0) {
            if (hit.prop) this.props.applyImpulse(hit.prop, it.pos, v3.scale(n, vn * (1 + it.restitution) * (it.kind === 'smoke' ? 0.35 : it.kind === 'rifle' ? RIFLE_ITEM.propShare : 0.1)), it.who);   // the item's lost momentum (canister ≈ 350 g; a rifle far more) goes into the chair / carton it struck
            const vN = v3.scale(n, vn); const vT = v3.sub(it.vel, vN);
            const speed = -vn;
            it.vel = v3.add(v3.scale(vT, Math.max(0, 1 - it.friction * (0.5 + 0.5 * Math.abs(n[1])))), v3.scale(vN, -it.restitution));
            it.spin *= 0.6; it.tumbleRate *= 0.45; it.bounces++; if (Math.hypot(it.vel[0], it.vel[2]) > 0.3) it.heading = v3.yawOf(it.vel);
            if (speed > 0.6) it.onBounce?.(speed, it.pos);
            // settle when slow on an upward-facing surface
            if (n[1] > 0.6 && Math.abs(it.vel[1]) < 0.5 && Math.hypot(it.vel[0], it.vel[2]) < 0.35) { it.settled = true; it.on = hit.prop; it.onPose = hit.prop ? poseKey(hit.prop) : 0; it.vel = [0, 0, 0]; it.spin = 0; it.pos[1] = it.pos[1] + 0.001; }
          }
          it.pos = v3.mad(it.pos, n, 0.002);
        } else {
          it.pos = v3.add(it.pos, move);
        }
        if (it.pos[1] < it.radius) { // safety floor
          it.pos[1] = it.radius; if (it.vel[1] < 0) { const sp = -it.vel[1]; it.vel[1] *= -it.restitution; it.vel[0] *= 0.7; it.vel[2] *= 0.7; it.bounces++; if (sp > 0.6) it.onBounce?.(sp, it.pos); }
          if (Math.abs(it.vel[1]) < 0.5 && Math.hypot(it.vel[0], it.vel[2]) < 0.35) { it.settled = true; it.vel = [0, 0, 0]; }
        }
        it.yaw += it.spin * h; it.tumble += it.tumbleRate * h;
      }
    }
  }

  /** Boxes for rendering / RT (small; canisters cast shadows, mags do not to keep the grid lean). */
  boxes(out: Box[]) {
    for (const it of this.items) {
      const n0 = out.length;   // (motion identity: every part this item emits below is keyed off its serial — tagged after the chain)
      if (it.kind === 'smoke' || it.kind === 'flash') {
        const standing = it.settled; const stun = it.kind === 'flash';
        // smoke can: olive body, red band. stun can: near-black body with a pale band, scorched once it has gone off
        const body: Vec3 = stun ? (it.fired ? [0.03, 0.03, 0.03] : [0.07, 0.075, 0.08]) : [0.25, 0.29, 0.2]; const band: Vec3 = stun ? (it.fired ? [0.12, 0.11, 0.1] : [0.7, 0.7, 0.66]) : [0.6, 0.08, 0.06];
        // A tossed can comes to rest on its SIDE: update() eases the end-over-end tumble to the nearest flat angle once it settles, so the same boxes as
        // in flight are drawn, lowered so the lying body (half-height 0.032) touches the floor instead of floating at the physics radius. (It used to be
        // drawn standing whenever settled — a leftover from before cans tumbled — which is why every can landed upright.)
        const c0: Vec3 = standing ? [it.pos[0], it.pos[1] - it.radius + 0.034, it.pos[2]] : v3.copy(it.pos);
          const rot = quat.mul(quat.yaw(it.yaw), quat.axisAngle([1, 0, 0], it.tumble));
          out.push(makeBox({ c: v3.copy(c0), h: [0.032, 0.032, 0.07], yaw: it.yaw, rot, albedo: body, flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: v3.add(c0, quat.rotate(rot, [0, 0, 0.045])), h: [0.034, 0.034, 0.012], yaw: it.yaw, rot, albedo: band, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
      } else if (it.kind === 'pistol' || it.kind === 'torch' || it.kind === 'rifle') {
        // dropped weapon: lies along its local z; in the air it flips end over end, on the floor it comes to rest on its side (tumble eased flat by update)
        // in the air: flips end over end about the across axis; settled: on its SIDE (a quarter roll about its own length) with that face on the floor
        const thick = it.kind === 'pistol' ? 0.016 : it.kind === 'rifle' ? (it.fill === 1 ? SC20K_ITEM.thick : RIFLE_ITEM.thick) : 0.022;
        const rot = it.settled ? quat.mul(quat.mul(quat.yaw(it.yaw), quat.axisAngle([1, 0, 0], Math.round(it.tumble / Math.PI) * Math.PI)), quat.axisAngle([0, 0, 1], Math.PI / 2))
                               : quat.mul(quat.yaw(it.yaw), quat.axisAngle([1, 0, 0], it.tumble));
        const c: Vec3 = it.settled ? [it.pos[0], it.pos[1] - it.radius + thick + 0.004, it.pos[2]] : v3.copy(it.pos);   // (the physics sphere rests at radius; the model's side face sits on the floor)
        const at = (off: Vec3): Vec3 => v3.add(c, quat.rotate(rot, off));
        if (it.kind === 'pistol') {   // slide + frame, grip raked back under the rear, suppressor can up front (the game's Five-seveN / the guards' sidearm read the same at this size)
          out.push(makeBox({ c: at([0, 0, 0]), h: [0.016, 0.026, 0.095], yaw: it.yaw, rot, albedo: [0.05, 0.05, 0.055], flags: BoxFlag.Dynamic }));
          const gripRot = quat.mul(rot, quat.axisAngle([1, 0, 0], 108 * Math.PI / 180));
          out.push(makeBox({ c: v3.add(at([0, -0.024, -0.045]), quat.rotate(gripRot, [0, 0, 0.047])), h: [0.014, 0.017, 0.047], yaw: it.yaw, rot: gripRot, albedo: [0.05, 0.05, 0.055], flags: BoxFlag.Dynamic }));
          if (it.fill > 0) out.push(makeBox({ c: at([0, 0, 0.17]), h: [0.019, 0.019, 0.075], yaw: it.yaw, rot, albedo: [0.09, 0.09, 0.09], flags: BoxFlag.Dynamic }));   // fill = 1: suppressed (the player's)
        } else if (it.kind === 'rifle' && it.fill === 1) {   // Sam's FN2000 (SC20K_ITEM): the polymer hull with its box down behind the grip, fore-end and can ahead, the sight block on the spine
          const S = SC20K_ITEM;
          out.push(makeBox({ c: at([0, 0, S.hull.z]), h: v3.copy(S.hull.h), yaw: it.yaw, rot, albedo: v3.copy(S.polymer), flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: at([0, 0, S.fore.z]), h: v3.copy(S.fore.h), yaw: it.yaw, rot, albedo: v3.copy(S.metal), flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: at([0, S.mag.y, S.mag.z]), h: v3.copy(S.mag.h), yaw: it.yaw, rot, albedo: v3.copy(S.metal), flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: at([0, S.optic.y, S.optic.z]), h: v3.copy(S.optic.h), yaw: it.yaw, rot, albedo: v3.copy(S.metal), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
        } else if (it.kind === 'rifle') {   // the carbine that was in his hands (RIFLE_ITEM): receiver, the wood and steel ahead of it, the canted box under it, the skeleton stock behind
          const R = RIFLE_ITEM;   // (copies: makeBox keeps the arrays it is given, and these numbers are shared by every rifle on the floor)
          out.push(makeBox({ c: at([0, 0, R.receiver.z]), h: v3.copy(R.receiver.h), yaw: it.yaw, rot, albedo: v3.copy(R.steel), flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: at([0, 0, R.fore.z]), h: v3.copy(R.fore.h), yaw: it.yaw, rot, albedo: v3.copy(R.wood), flags: BoxFlag.Dynamic }));
          const magRot = quat.mul(rot, quat.axisAngle([1, 0, 0], R.mag.cant));
          out.push(makeBox({ c: at([0, R.mag.y, R.mag.z]), h: v3.copy(R.mag.h), yaw: it.yaw, rot: magRot, albedo: v3.copy(R.wood), flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: at([0, -0.012, R.stock.z]), h: v3.copy(R.stock.h), yaw: it.yaw, rot, albedo: v3.copy(R.steel), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));   // (the open triangle as one thin slab: raster only, so no ray finds a paddle-shaped shadow caster the stock never was)
        } else {
          out.push(makeBox({ c: at([0, 0, 0]), h: [0.022, 0.022, 0.09], yaw: it.yaw, rot, albedo: [0.09, 0.09, 0.1], flags: BoxFlag.Dynamic }));
          out.push(makeBox({ c: at([0, 0, 0.095]), h: [0.026, 0.026, 0.008], yaw: it.yaw, rot, albedo: [0.16, 0.16, 0.15], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));   // dark lens: the torch died with its owner
        }
      } else if (it.kind === 'ring') {   // a spent ring airfoil: three thin slats crossed at 60° lying flat (or tumbling flat-on in the air) — a small pale ring on the floor
        const G = RING_ITEM; const c: Vec3 = it.settled ? [it.pos[0], it.pos[1] - it.radius + G.half[1] + 0.002, it.pos[2]] : v3.copy(it.pos);
        const base = it.settled ? quat.yaw(it.yaw) : quat.mul(quat.yaw(it.yaw), quat.axisAngle([1, 0, 0], it.tumble));
        for (let k = 0; k < 3; k++) { const rot = quat.mul(base, quat.axisAngle([0, 1, 0], k * Math.PI / 3)); out.push(makeBox({ c: v3.copy(c), h: v3.copy(G.half), yaw: it.yaw, rot, albedo: v3.copy(G.albedo), flags: BoxFlag.Dynamic | BoxFlag.NoShadow })); }
      } else {
        const flat = it.settled; const box30 = it.fill > 1, box20k = it.fill >= 3;   // fill 2: a rifleman's empty 30-round box (guards.ts tickReloadBeat) — longer, and bakelite-coloured like the one on the gun; fill 3: the FN2000's black thirty out of Sam's reload (player.ts); else a pistol magazine (fill 0 empty, 0‥1 part full)
        const col: Vec3 = box20k ? v3.copy(SC20K_ITEM.metal) : box30 ? v3.copy(RIFLE_ITEM.wood) : it.fill > 0 ? [0.09, 0.09, 0.1] : [0.06, 0.06, 0.065]; const hl = box30 ? 0.095 : 0.055, hw = box30 ? 0.014 : 0.018;
        if (flat) out.push(makeBox({ c: [it.pos[0], it.pos[1] + 0.012, it.pos[2]], h: [hw, 0.012, hl], yaw: it.yaw, albedo: col, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
        else out.push(makeBox({ c: v3.copy(it.pos), h: [hw, hl, 0.03], yaw: it.yaw, rot: quat.mul(quat.yaw(it.yaw), quat.axisAngle([1, 0, 0], it.tumble)), albedo: col, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));   // a dropped magazine tumbles too
      }
      for (let k = n0; k < out.length; k++) out[k].mkey = MKEY.item + (it.serial & 8191) * 8 + Math.min(7, k - n0);   // MOTION IDENTITY per part (scene/boxes.ts MKEY): the g-buffer reprojects the flying can through ITS last transform whatever spawned or died around it in the list
    }
  }
}

const poseKey = (p: Prop) => p.x * 7919 + p.z * 104729 + p.yaw;   // any change of pose changes this (exact float compare; not a hash to trust across different poses, just 'did it move')
/** a canister that is still SOMETHING: its fuse not yet gone, or (smoke) gone and still venting — never scenery for the item cap to sweep up */
const liveCan = (x: Item) => (x.kind === 'smoke' || x.kind === 'flash') && (!x.fired || x.emitT > 0);
