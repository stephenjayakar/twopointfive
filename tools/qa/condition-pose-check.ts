// A MAN'S CONDITION SHOWS IN HOW HE MOVES — the figure's side of src/game/condition.ts (character.ts mvPost / mvArms: `hurt`, `shaken`, `foldToo`), measured on
// the bones of one figure with the MOVES pass on (the page's; the frozen stand holds that pass off and none of this is drawn there).
//   bun run tools/qa/condition-pose-check.ts        (also `probes.ts condition-pose`, and with `probes.ts condition`)
// Each line sets the inputs as conditionPose deals them and compares the figure with a sound twin stepped the same frames:
//   (a) hurt, standing, the gun out of his shoulder: the head comes forward and down, the support hand is off the gun and at his ribs, the feet stay planted
//   (b) hurt, the rifle in his shoulder: he braces — the bore within a few degrees of the sound man's, both hands on the gun — and the head is still down
//   (c) hurt, walking: over two strides the head rides over the side he favours, and over the other side for a man who favours the other
//   (d) under fire with the rifle up: the head is down and he has sunk, the bore within a few degrees; it is gone two seconds after the fire stops
//   (e) knocked about (the game's `clutch`): doubled over with `foldToo`, the trunk the base's without it (the wounds switch off)
//   (f) every input back at rest: two and a half seconds on he is the sound twin again, to the millimetre
//   (g) the gun carried, no stance (the gaze stabiliser's own case: it keeps the eye line level under a working body): a hurt man's head and a shaken
//       man's are bowed as far as at the low ready, standing and walking, and a sound man's eye line is where it was
// CONDITION_BREAK=1 = the looks not dealt (every input left at rest): (a) to (e) and (g) must fail.   exit 0 = all hold · 1 = one does not
import { ROOT, loadCharacter } from './headless.ts';

export async function conditionPoseCheck(): Promise<boolean> {
  const CH: any = await import(`${ROOT}/src/game/character.ts`);
  type V3 = [number, number, number];
  let all = true; const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== condition-pose: a hurt man hunches, favours a side and takes his hand to his ribs; a man under fire tucks his head; one knocked about folds ===');
  const DT = 1 / 60, cm = (m: number) => (m * 100).toFixed(1) + ' cm', deg = (r: number) => (r * 57.2958).toFixed(1) + '°';
  const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const off = (a: V3, b: V3) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))));   // the angle between two bores
  const keep = { ...CH.MOVES }, deal = process.env.CONDITION_BREAK !== '1'; CH.MOVES.on = 1;
  const gltf = await loadCharacter();
  const man = (o: { aim?: boolean; speed?: number; carried?: boolean } = {}) => { const c: any = new CH.Character(gltf, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 });
    c.anim.phase = 0; c.anim.longGun = true; c.anim.longSteady = 1; c.muzzleAhead = 0.5; c.anim.trained = 1;
    if (o.aim === false) { c.anim.upper = 'none'; if (!o.carried) c.anim.stance = 'lowReady'; } else c.anim.upper = 'aim';
    if (o.speed) c.anim.speed = o.speed; for (let i = 0; i < 90; i++) c.update(DT); return c; };
  const snap = (c: any) => ({ hR: [...c.bones.handR] as V3, hL: [...c.bones.handL] as V3, fL: [...c.bones.footL] as V3, fR: [...c.bones.footR] as V3, head: [...c.bones.head] as V3, chest: [...c.bones.chest] as V3, pitch: Math.asin(c.gunDir[1]), dir: [...c.gunDir] as V3, grip: dist(c.bones.handL, c.bones.handR) });
  const run = (cs: any[], secs: number) => { for (let f = 0; f < Math.round(secs * 60); f++) for (const c of cs) c.update(DT); };
  const set = (c: any, k: Record<string, unknown>) => { if (deal) Object.assign(c.anim, k); };
  try {
    // (a) hurt at the low ready
    { const c = man({ aim: false }), k = man({ aim: false }), f0 = snap(c); set(c, { hurt: 1 }); run([c, k], 2.5); const a = snap(c), z = snap(k);
      const fwd = a.head[2] - z.head[2], low = z.head[1] - a.head[1], ribs = dist(a.hL, a.chest), feet = Math.max(dist(a.fL, f0.fL), dist(a.fR, f0.fR));
      const moved = dist(a.hL, z.hL);
      line(fwd > 0.05 && low > 0.03 && Math.abs(a.grip - z.grip) > 0.08 && moved > 0.1 && ribs < 0.35 && feet < 0.03, '(a) hurt at the low ready: the head forward and down, the support hand off the gun at his ribs, the feet where they were',
        `head ${cm(fwd)} forward, ${cm(low)} lower — want > 5 and > 3 · the support hand ${cm(moved)} from where a sound man's is on the gun — want > 10 — and ${cm(ribs)} from the chest joint — want < 35 (hands ${cm(a.grip)} apart, sound ${cm(z.grip)}) · feet ${cm(feet)} — want < 3`); }
    // (b) hurt with the rifle up
    { const c = man(), k = man(); set(c, { hurt: 1 }); run([c, k], 2.5); const a = snap(c), z = snap(k); const dp = off(a.dir, z.dir), low = z.head[1] - a.head[1];
      line(dp < 6 / 57.3 && Math.abs(a.grip - z.grip) < 0.03 && low > 0.015, '(b) hurt with the rifle in his shoulder: he braces — the bore within 6° of the sound man\'s, both hands on the gun — and the head is still down',
        `bore ${deg(dp)} off the sound man's · hands ${cm(a.grip)} apart (sound ${cm(z.grip)}) · head ${cm(low)} lower — want > 1.5`); }
    // (c) the step: the head's mean place across two strides, for a man who favours each side
    { const ride = (side: 1 | -1 | 0) => { const c = man({ aim: false, speed: 1.3 }); if (side) set(c, { hurt: 1, hurtSide: side }); run([c], 2); let x = 0, y = 0, n = 0, lo = 1e9, hi = -1e9;
        for (let f = 0; f < 240; f++) { c.update(DT); const h = c.bones.head; x += h[0]; y += h[1]; n++; lo = Math.min(lo, h[0]); hi = Math.max(hi, h[0]); } return { x: x / n, y: y / n, sway: hi - lo }; };
      const s = ride(0), l = ride(1), r = ride(-1);
      line(l.x - s.x > 0.012 && r.x - s.x < -0.012 && l.sway > s.sway + 0.02 && s.y - l.y > 0.03, '(c) hurt and walking: the head rides over the side he favours (and over the other for a man who favours the other), sways further than a sound man\'s, and is carried lower',
        `mean head across four seconds: sound ${cm(s.x)} · favours his left ${cm(l.x)} · his right ${cm(r.x)} — want ±1.2 off the sound man's · sway ${cm(l.sway)} against ${cm(s.sway)} · ${cm(s.y - l.y)} lower`); }
    // (d) under fire
    { const c = man(), k = man(); set(c, { shaken: 1 }); run([c, k], 1.2); const a = snap(c), z = snap(k); const dp = off(a.dir, z.dir), low = z.head[1] - a.head[1];
      set(c, { shaken: 0 }); run([c, k], 2.5); const b = snap(c), z2 = snap(k);
      line(low > 0.05 && dp < 5 / 57.3 && dist(b.head, z2.head) < 0.01, '(d) fire on him with the rifle up: the head down and he has sunk, the bore within 5°; gone two and a half seconds after it stops',
        `head ${cm(low)} lower — want > 5 · bore ${deg(dp)} off · afterwards the head ${cm(dist(b.head, z2.head))} from the sound man's`); }
    // (e) the fold
    { const c = man({ aim: false }), n = man({ aim: false }), k = man({ aim: false }); set(c, { clutch: 1, foldToo: true }); set(n, { clutch: 1, foldToo: false }); run([c, n, k], 1.5); const a = snap(c), b = snap(n), z = snap(k);
      const low = z.head[1] - a.head[1], base = dist(b.head, z.head);
      line(low > 0.08 && base < 0.02 && CH.MOVES.fold === 0, '(e) knocked about: doubled over with the fold dealt him, the trunk the base\'s without it (the wounds switch off, MOVES.fold 0)',
        `folded: head ${cm(low)} lower — want > 8 · not dealt: head ${cm(base)} from the sound man's — want < 2`); }
    // (f) back at rest
    { const c = man({ aim: false }), k = man({ aim: false }); Object.assign(c.anim, { hurt: 1, shaken: 1, foldToo: true, clutch: 1 }); run([c, k], 1.5); const mid = dist(snap(c).head, snap(k).head);
      Object.assign(c.anim, { hurt: 0, shaken: 0, foldToo: false, clutch: 0 }); run([c, k], 2.5); const a = snap(c), z = snap(k); const gap = Math.max(dist(a.head, z.head), dist(a.hL, z.hL), dist(a.hR, z.hR), dist(a.chest, z.chest));
      line(mid > 0.08 && gap < 0.002, '(f) every input back at rest: two and a half seconds on he is the sound twin again', `with all of it on him the head was ${cm(mid)} off the sound man's · afterwards head, hands and chest within ${(gap * 1000).toFixed(2)} mm`); }
    // (g) the gun carried: the stabiliser's eye line goes down with the looks
    { const el = (c: any) => { let sum = 0; for (let i = 0; i < 60; i++) { c.update(DT); sum += Math.asin(c.headDir()[1]); } return sum / 60 * 57.2958; };
      const bow = (carried: boolean, speed: number, k: Record<string, unknown>) => { const c = man({ aim: false, carried, speed }), z = man({ aim: false, carried, speed }); set(c, k); run([c, z], 2.5); return el(z) - el(c); };
      const rows = [0, 1.2].map(speed => ({ speed, hurt: bow(true, speed, { hurt: 1 }), hurtLow: bow(false, speed, { hurt: 1 }), shaken: bow(true, speed, { shaken: 1 }), shakenLow: bow(false, speed, { shaken: 1 }) }));
      const sound = el(man({ aim: false, carried: true })), want = CH.GAZE_EL.stand;
      line(rows.every(r => r.hurt > 14 && Math.abs(r.hurt - r.hurtLow) < 5 && r.shaken > 22 && Math.abs(r.shaken - r.shakenLow) < 5) && sound < -want + 20 && sound > -want - 20,
        '(g) the gun carried, no stance: a hurt man\'s head and a shaken man\'s are bowed as far as at the low ready, standing and walking',
        rows.map(r => `${r.speed} m/s: hurt ${r.hurt.toFixed(1)}° further down (low ready ${r.hurtLow.toFixed(1)}°) — want > 14 · shaken ${r.shaken.toFixed(1)}° (low ready ${r.shakenLow.toFixed(1)}°) — want > 22`).join(' · ') + ` · a sound man's head ${sound.toFixed(1)}°`); }
  } finally { Object.assign(CH.MOVES, keep); }
  console.log(all ? '\ncondition-pose: ALL PASS' : '\ncondition-pose: FAIL');
  return all;
}
if (import.meta.main) process.exit((await conditionPoseCheck()) ? 0 : 1);
