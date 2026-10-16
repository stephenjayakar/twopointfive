// The 'moves' family: THE LOUD DEMO'S MOTION PASS (src/game/character.ts MOVES / MV) — a rifle that recoils, the bang tossed off the support hand, the stun
// charge's hunch, the flinch and the hit as two different things, the two sides' gaits, the stack's squeeze. The harness stands the game up with the pass OFF
// (host/standup.ts) so every older probe and frozen digest measures the animator as it was; this family turns it on.
//
//   bun run tools/qa/probes.ts moves | moves-off | moves-recoil | moves-react | moves-toss | moves-dazzle | moves-gait | moves-game | moves-reload | moves-kept | moves-entry | moves-second | moves-hands | moves-snap
//
//   moves-off     · with the pass off the new calls ARE the old ones: flinchFrom / hitFrom = hit(), tossItem = signal('go'), signal('squeeze') = signal('hold') — the pose bit for bit
//   moves-recoil  · four rounds: the gun comes back and climbs, more for an untrained man than a trained one, both hands stay on it, and it settles back
//   moves-react   · the flinch and the hit: feet where they stood, hands on the gun, the head down in a flinch, the trunk knocked along the round in a hit, back at rest after
//   moves-toss    · the support hand leaves the gun, swings through and is back on it; the trigger hand keeps the rifle; feet where they stood
//   moves-dazzle  · blinded: head down and turned off the charge, the forearm up at the face, held as long as the game holds him; eased back out after
//   moves-gait    · the trained walk sits lower and leans in with every FOOT where the cycle had it; the untrained walk moves no pelvis
//   moves-game    · a staged fight with the pass on: each side is dealt its training, a blinded man is held bent, a minute runs with every bone finite
//   moves-hands   · the hand pass: an empty hand is relaxed, a grip is kept, a layer's hand is the layer's — and nothing the game reads moves (its head comment below)
//   moves-snap    · a pistol fired from the carry: the wrist eases up, the bare arm stays out from between carry and aim, a pitched shot keeps its pitch; the round's bore and frame unchanged
//   moves-steady  · the crouch walk carried level: the cycle's side-to-side rock most of the way out (head, pelvis, trunk, the width of the base), its stride, pace, height
//                   and mean carriage where they were (hands empty too, and at a creep where the cycle is half the pose); feet in the held gait travel no further on a turn;
//                   setting 2 rides higher; nothing at a crouched stand, upright, or with the part off; and the sprint with the rifle in both hands: the trunk and head stop rolling,
//                   the legs and the gun where they were (hands empty, and a man who does not steady his gun, to the bit)
//
// The family's own red path: MOVES_BREAK=1 bun run tools/qa/probes.ts moves-recoil must FAIL (the recoil switched off under the first check).
import { ROOT, loadCharacter } from './headless.ts';
const CH: any = await import(`${ROOT}/src/game/character.ts`);
const BREAK = !!process.env.MOVES_BREAK;
type V3 = [number, number, number];
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const DT = 1 / 60, cm = (m: number) => (m * 100).toFixed(1) + ' cm', deg = (r: number) => (r * 57.2958).toFixed(1) + '°';
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const keep = { ...CH.MOVES };
const restore = () => Object.assign(CH.MOVES, keep);
let gltf: any = null;
async function man(trained: number, o: { aim?: boolean; speed?: number; steady?: number } = {}) {
  gltf ??= await loadCharacter();
  const c: any = new CH.Character(gltf, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 });
  c.anim.phase = 0; c.anim.longGun = true; c.anim.longSteady = o.steady ?? (trained > 0.5 ? 1 : 0); c.muzzleAhead = 0.5; c.anim.trained = trained; c.anim.upper = o.aim === false ? 'relaxed' : 'aim';
  if (o.speed) c.anim.speed = o.speed;
  for (let i = 0; i < 90; i++) c.update(DT);
  return c;
}
const snap = (c: any) => ({ hR: [...c.bones.handR] as V3, hL: [...c.bones.handL] as V3, fL: [...c.bones.footL] as V3, fR: [...c.bones.footR] as V3, head: [...c.bones.head] as V3, hips: [...c.bones.hips] as V3, chest: [...c.bones.chest] as V3, pitch: Math.asin(c.gunDir[1]), grip: dist(c.bones.handL, c.bones.handR) });
const poseBits = (c: any) => { const b = c.bones; let h = 2166136261; const f = new Float64Array(1), u = new Uint8Array(f.buffer); for (const k of Object.keys(b).sort()) for (const x of b[k]) { f[0] = x; for (const y of u) { h ^= y; h = Math.imul(h, 16777619); } } return (h >>> 0).toString(16); };

export async function movesOff(): Promise<boolean> {
  const F = family('moves-off: the pass off — the new calls are the old ones, to the bit');
  try {
    CH.MOVES.on = 0;
    const run = async (neu: boolean) => {
      const c = await man(0.12); let out = '';
      const acts: [number, () => void][] = [[5, () => c.anim.fire()], [11, () => c.anim.fire()], [40, () => neu ? c.anim.flinchFrom([1, 0, 1]) : c.anim.hit()], [120, () => neu ? c.anim.hitFrom([0, 0, -1]) : c.anim.hit()],
        [200, () => neu ? c.anim.tossItem() : c.anim.signal('go')], [300, () => c.anim.signal(neu ? 'squeeze' : 'hold')], [380, () => { if (neu) c.anim.dazzle = { from: [1, 0, 2], k: 1 }; }], [380, () => { c.anim.trained = neu ? 1 : 0.12; }],
        [60, () => { if (neu) { c.anim.reloadBack = true; c.anim.clutch = 1; c.anim.dip = 1; c.anim.bound = 2; } }], [240, () => neu ? c.anim.reload(1.6, { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 }) : c.anim.reload(1.6)]];   // (the second pass: its inputs and the reload's beat are nobody's with the pass off)
      for (let f = 0; f < 460; f++) { for (const [at, fn] of acts) if (at === f) fn(); c.update(DT); if (f % 20 === 0) out += poseBits(c); }
      return out;
    };
    const a = await run(true), b = await run(false);
    F.verdict(a === b, 'off: fire, flinchFrom, hitFrom, tossItem, signal squeeze, a dazzle, a change of training, a reload with its beat and the second pass\'s inputs pose exactly as fire, hit, hit, signal go, signal hold, a plain reload and nothing did', `${a.length / 8 | 0} pose hashes over 460 frames · ${a === b ? 'identical' : 'DIFFER'}`);
  } finally { restore(); }
  return F.done();
}

export async function movesRecoil(): Promise<boolean> {
  const F = family('moves-recoil: four rounds — the gun comes back and climbs, less for a trained man, both hands on it, settled after');
  try {
    CH.MOVES.on = 1; if (BREAK) CH.MOVES.recoil = 0;
    const burst = async (tr: number) => {
      const c = await man(tr), k = await man(tr); const s0 = snap(c); let back = 0, climb = 0, part = 0;   // (k: the same man firing nothing — what "where it was" means a second later, the idle's own drift taken out)
      for (let f = 0; f < 100; f++) { if (f % 6 === 0 && f < 24) c.anim.fire(); c.update(DT); k.update(DT); const s = snap(c), z = snap(k); back = Math.max(back, z.hR[2] - s.hR[2]); climb = Math.max(climb, s.pitch - z.pitch); part = Math.max(part, Math.abs(s.grip - s0.grip)); }
      return { back, climb, part, rest: dist(snap(c).hR, snap(k).hR) };
    };
    const u = await burst(0.12), t = await burst(1);
    F.verdict(u.back > 0.04 && t.back > 0.02, 'the gun is driven back into the shoulder on each round', `trigger hand back by up to ${cm(u.back)} (untrained) · ${cm(t.back)} (trained) — want > 4 and > 2`);
    F.verdict(u.climb > t.climb * 1.8 && u.climb > 1.2 / 57.3 && t.climb < 1.2 / 57.3, 'the muzzle climbs away from an untrained man and is held down by a trained one', `climb over the burst ${deg(u.climb)} untrained · ${deg(t.climb)} trained`);
    F.verdict(u.part < 0.02 && t.part < 0.02, 'both hands stay on the weapon through it', `the hands' spacing moves by at most ${cm(u.part)} · ${cm(t.part)} — want < 2`);
    F.verdict(u.rest < 0.012 && t.rest < 0.012, 'and it settles back where it was', `trigger hand ${cm(u.rest)} · ${cm(t.rest)} from where a man who never fired has his, 1.3 s after the last round — want < 1.2`);
  } finally { restore(); }
  return F.done();
}

export async function movesReact(): Promise<boolean> {
  const F = family('moves-react: the flinch is a duck, the hit a blow — feet planted, hands on the gun, back at rest after');
  try {
    CH.MOVES.on = 1;
    const play = async (tr: number, what: 'flinch' | 'hit') => {
      const c = await man(tr), k = await man(tr); const s0 = snap(c); let foot = 0, part = 0, headDrop = 0, chestBack = 0, hipsDrop = 0;
      if (what === 'flinch') c.anim.flinchFrom([0.5, 0, 1]); else c.anim.hitFrom([0, 0, -1]);
      for (let f = 0; f < 110; f++) { c.update(DT); k.update(DT); const s = snap(c); foot = Math.max(foot, dist(s.fL, s0.fL), dist(s.fR, s0.fR)); part = Math.max(part, Math.abs(s.grip - s0.grip)); headDrop = Math.max(headDrop, s0.head[1] - s.head[1]); chestBack = Math.max(chestBack, s0.chest[2] - s.chest[2]); hipsDrop = Math.max(hipsDrop, s0.hips[1] - s.hips[1]); }
      const s1 = snap(c), z = snap(k); return { foot, part, headDrop, chestBack, hipsDrop, rest: Math.max(dist(s1.head, z.head), dist(s1.hR, z.hR)) };
    };
    const fu = await play(0.12, 'flinch'), ft = await play(1, 'flinch'), hu = await play(0.12, 'hit');
    F.verdict(fu.headDrop > 0.07 && fu.hipsDrop > 0.03, 'an untrained man ducks: head down, knees soft', `head down ${cm(fu.headDrop)} · pelvis down ${cm(fu.hipsDrop)} — want > 7 and > 3`);
    F.verdict(ft.headDrop > 0.015 && ft.headDrop < fu.headDrop * 0.6, 'a trained man dips and stays on the gun', `head down ${cm(ft.headDrop)} against the untrained ${cm(fu.headDrop)}`);
    F.verdict(hu.chestBack > 0.05, 'a hit from the front knocks the chest back along the round', `chest back ${cm(hu.chestBack)} — want > 5`);
    F.verdict(Math.max(fu.foot, ft.foot, hu.foot) < 0.004, 'the feet stay where they stood through all three', `worst foot travel ${(Math.max(fu.foot, ft.foot, hu.foot) * 1000).toFixed(1)} mm — want < 4`);
    F.verdict(Math.max(fu.part, ft.part, hu.part) < 0.015, 'the hands stay on the weapon', `the hands' spacing moves by at most ${cm(Math.max(fu.part, ft.part, hu.part))} — want < 1.5`);
    { // a second round / a second burst while the first still has him: the pose carries on from where it is (no snap back upright) — no frame moves him
      // further than the first blow's own onset does
      const run = async (again: boolean) => { const c = await man(0.12); let jump = 0, prev = snap(c);
        for (let f = 0; f < 70; f++) { if (f === 0 || (again && (f === 6 || f === 15))) c.anim.hitFrom([0.2, 0, -1]); if (f === 30 || (again && f === 44)) c.anim.flinchFrom([0.5, 0, 1]); c.update(DT); const s = snap(c); jump = Math.max(jump, dist(s.chest, prev.chest), dist(s.head, prev.head)); prev = s; }
        return jump; };
      const once = await run(false), again = await run(true);
      F.verdict(again < once * 1.15 + 0.003, 'hit again and startled again mid-reaction, he carries on from the pose he is in', `chest / head move at most ${cm(again)} in one frame — the first blow's own onset is ${cm(once)}`); }
    F.verdict(Math.max(fu.rest, ft.rest, hu.rest) < 0.012, 'each is over inside 1.8 s', `head / trigger hand ${cm(Math.max(fu.rest, ft.rest, hu.rest))} from where a man nothing happened to has his — want < 1.2`);
  } finally { restore(); }
  return F.done();
}

export async function movesToss(): Promise<boolean> {
  const F = family('moves-toss: the support hand tosses and comes back; the rifle stays in the trigger hand');
  try {
    CH.MOVES.on = 1;
    const c = await man(1, { aim: false }); c.anim.stance = 'highReady'; c.anim.upper = 'none'; for (let i = 0; i < 60; i++) c.update(DT);
    const s0 = snap(c); let off = 0, gun = 0, foot = 0, fwd = -9, low = 9; c.anim.tossItem();
    const busy0 = c.anim.tossing;
    for (let f = 0; f < 60; f++) { c.update(DT); const s = snap(c); off = Math.max(off, Math.abs(s.grip - s0.grip)); gun = Math.max(gun, dist(s.hR, s0.hR)); foot = Math.max(foot, dist(s.fL, s0.fL), dist(s.fR, s0.fR)); fwd = Math.max(fwd, s.hL[2]); low = Math.min(low, s.hL[1]); }
    const s1 = snap(c);
    F.verdict(busy0 && off > 0.2, 'the support hand comes off the gun', `the hands' spacing changes by up to ${cm(off)} — want > 20`);
    F.verdict(low < s0.hL[1] - 0.1 && fwd > s0.hL[2] + 0.12, 'down beside the hip, then through and out ahead of him', `the hand goes ${cm(s0.hL[1] - low)} below and ${cm(fwd - s0.hL[2])} ahead of where it held the gun`);
    F.verdict(gun < 0.08 && foot < 0.004, 'the trigger hand keeps the rifle where it was and the feet stay put', `trigger hand moves ${cm(gun)} at most · feet ${(foot * 1000).toFixed(1)} mm`);
    F.verdict(!c.anim.tossing && dist(s1.hL, s0.hL) < 0.012, 'and the hand is back on the gun inside a second', `support hand ${cm(dist(s1.hL, s0.hL))} from its grip`);
  } finally { restore(); }
  return F.done();
}

export async function movesDazzle(): Promise<boolean> {
  const F = family('moves-dazzle: blinded — bent away from the charge with the forearm up at the face, for as long as he is held');
  try {
    CH.MOVES.on = 1;
    const c = await man(0.12), k = await man(0.12); const s0 = snap(c);
    c.anim.dazzle = { from: [1.5, 0, 2], k: 1 }; c.anim.upper = 'none'; c.anim.stance = 'lowReady';
    let foot = 0; for (let f = 0; f < 90; f++) { c.update(DT); const s = snap(c); foot = Math.max(foot, dist(s.fL, s0.fL), dist(s.fR, s0.fR)); }
    const a = snap(c); const face: V3 = a.head;   // (the skull's base joint: the eyes are ~14 cm up and ahead of it, the hand a palm off them)
    F.verdict(s0.head[1] - a.head[1] > 0.1, 'his head is down', `head ${cm(s0.head[1] - a.head[1])} lower — want > 10`);
    F.verdict(a.head[0] - s0.head[0] < -0.03, 'and turned off the charge (it went off to his front-left: he goes right)', `head ${cm(s0.head[0] - a.head[0])} to his right`);
    F.verdict(dist(a.hL, face) < 0.25 && a.hL[1] > a.chest[1] + 0.05, 'the support hand is up over the eyes', `wrist ${cm(dist(a.hL, face))} from the skull's base joint, ${cm(a.hL[1] - a.chest[1])} above the chest joint — want < 25 and > 5`);
    { const B = c.bones, fa: V3 = [B.handL[0] - B.forearmL[0], B.handL[1] - B.forearmL[1], B.handL[2] - B.forearmL[2]], hd: V3 = [B.fingerL[0] - B.handL[0], B.fingerL[1] - B.handL[1], B.fingerL[2] - B.handL[2]];
      const bend = Math.acos(Math.max(-1, Math.min(1, (fa[0] * hd[0] + fa[1] * hd[1] + fa[2] * hd[2]) / (Math.hypot(...fa) * Math.hypot(...hd)))));
      F.verdict(bend < 70 / 57.3 && a.hL[1] < a.head[1] + 0.09, 'held under the brow (a brim or a helmet rim sits there), on a wrist a man could bend', `wrist ${cm(a.hL[1] - a.head[1])} above the skull's base joint — want < 9 (the eyes are 10 up) · forearm to fingers ${deg(bend)} — want < 70°`); }
    for (let f = 0; f < 120; f++) c.update(DT); const b = snap(c);
    F.verdict(dist(b.head, a.head) < 0.05 && foot < 0.006, 'held there while the game holds him, feet planted', `head moves ${cm(dist(b.head, a.head))} over two more seconds (the stagger's sway) · feet ${(foot * 1000).toFixed(1)} mm`);
    c.anim.dazzle = null; c.anim.upper = 'aim'; c.anim.stance = 'none'; for (let f = 0; f < 130; f++) c.update(DT); for (let f = 0; f < 340; f++) k.update(DT); const e = snap(c), z = snap(k);
    // the gun: a blinded man with his carbine up keeps it on its line (the defenders' blind burst flies along the drawn bore and is refused under 12° down) —
    // and the side he turns away to is chosen once: sweeping his facing across the charge must not flip him
    { const a2 = await man(0.12), k2 = await man(0.12); a2.anim.dazzle = { from: [0.05, 0, 3], k: 1 };
      let off = 0, low = 0, stepMax = 0, prev: V3 | null = null;
      for (let f = 0; f < 150; f++) {
        const yaw = f < 30 ? 0 : 0.25 * Math.sin((f - 30) / 60 * Math.PI * 2); a2.bodyYaw = k2.bodyYaw = yaw; a2.aimYaw = k2.aimYaw = yaw; a2.update(DT); k2.update(DT);
        const cd: V3 = [a2.chestDir[0] * Math.cos(yaw) - a2.chestDir[2] * Math.sin(yaw), 0, a2.chestDir[0] * Math.sin(yaw) + a2.chestDir[2] * Math.cos(yaw)];   // (his chest's facing in his own frame)
        if (prev) stepMax = Math.max(stepMax, Math.acos(Math.min(1, (cd[0] * prev[0] + cd[2] * prev[2]) / (Math.hypot(cd[0], cd[2]) * Math.hypot(prev[0], prev[2]))))); prev = cd;
        if (f >= 20) { const g1 = a2.gunDir, g0 = k2.gunDir; off = Math.max(off, Math.acos(Math.min(1, g1[0] * g0[0] + g1[1] * g0[1] + g1[2] * g0[2]))); low = Math.min(low, g1[1] - g0[1]); }
      }
      F.verdict(off < 6 / 57.3 && low > -0.08, 'blinded with his carbine up, the bore stays on the line it had (his blind burst still goes at the door)', `bore at most ${deg(off)} off a man never blinded's, ${(-low).toFixed(3)} lower in y — want < 6° and < 0.08`);
      F.verdict(stepMax < 5 / 57.3, 'and his turn away keeps its side while his facing sweeps across the charge', `chest facing steps at most ${deg(stepMax)} in a frame — want < 5°`); }
    F.verdict(dist(e.head, z.head) < 0.015 && Math.abs(e.grip - s0.grip) < 0.015, 'and he comes back up onto the gun when it passes', `head ${cm(dist(e.head, z.head))} from where a man never blinded has his · hands' spacing ${cm(Math.abs(e.grip - s0.grip))} off`);
  } finally { restore(); }
  return F.done();
}

export async function movesGait(): Promise<boolean> {
  const F = family('moves-gait: the trained walk sits lower and leans in over the same feet; the untrained one keeps its pelvis');
  try {
    const walk = async (on: number, tr: number) => {
      CH.MOVES.on = on; const c = await man(tr, { aim: false, speed: 1.3, steady: 1 }); c.anim.stance = 'lowReady'; c.anim.upper = 'none';
      const out: any[] = []; for (let f = 0; f < 240; f++) { c.update(DT); if (f >= 120) out.push(snap(c)); } return out;
    };
    const off = await walk(0, 1), tr = await walk(1, 1), un = await walk(1, 0.12);
    const mean = (a: any[], k: (s: any) => number) => a.reduce((x, s) => x + k(s), 0) / a.length;
    const range = (a: any[], k: (s: any) => number) => Math.max(...a.map(k)) - Math.min(...a.map(k));
    let foot = 0, footU = 0, hipU = 0; for (let i = 0; i < off.length; i++) { foot = Math.max(foot, dist(off[i].fL, tr[i].fL), dist(off[i].fR, tr[i].fR)); footU = Math.max(footU, dist(off[i].fL, un[i].fL), dist(off[i].fR, un[i].fR)); hipU = Math.max(hipU, dist(off[i].hips, un[i].hips)); }
    const drop = mean(off, s => s.hips[1]) - mean(tr, s => s.hips[1]), lean = mean(tr, s => s.chest[2] - s.hips[2]) - mean(off, s => s.chest[2] - s.hips[2]);
    F.verdict(drop > 0.02 && drop < 0.06, 'a trained man with a rifle walks sunk onto his knees', `pelvis ${cm(drop)} lower on average than with the pass off — want 2 to 6`);
    F.verdict(lean > 0.012, 'leaning into the gun', `chest ${cm(lean)} further ahead of the hips`);
    F.verdict(range(tr, s => s.hips[1]) < range(off, s => s.hips[1]) * 0.85, 'with less bob', `pelvis height varies ${cm(range(tr, s => s.hips[1]))} over the cycle against ${cm(range(off, s => s.hips[1]))}`);
    F.verdict(foot < 0.004, 'and every foot exactly where the walk cycle had it', `worst foot difference from the pass off, frame for frame over two seconds: ${(foot * 1000).toFixed(1)} mm — want < 4`);
    F.verdict(hipU < 0.002 && footU < 0.002, 'the untrained walk moves no pelvis and no foot (its difference is in the shoulders)', `pelvis ${(hipU * 1000).toFixed(1)} mm · feet ${(footU * 1000).toFixed(1)} mm off the pass-off walk`);
  } finally { restore(); }
  return F.done();
}

export async function movesGame(): Promise<boolean> {
  const F = family('moves-game: a staged fight with the pass on — training dealt by side, a blinded man held bent, every bone finite');
  try {
    const { stage } = await import('./bang-tally.ts');
    const S: any = await quiet(() => stage('night-breach', 1)); const { g, step } = S; CH.MOVES.on = 1; step(30);
    const ops = g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead'), foes = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead');
    F.verdict(ops.length > 0 && foes.length > 0 && ops.every((x: any) => x.char.anim.trained === 1) && foes.every((x: any) => x.char.anim.trained < 0.3) && g.player.char.anim.trained === 1,
      'the team and the player are dealt trained, the defenders untrained', `${ops.length} operatives at ${ops[0]?.char.anim.trained} · ${foes.length} defenders at ${foes[0]?.char.anim.trained} · the player at ${g.player.char.anim.trained}`);
    const h = foes[0]; const p = h.char.pos; const head0 = h.char.bones.head[1];
    h.dazzledAt = [p[0] + 1.5, 0, p[2] + 1]; h.dazzledUntil = g.time + 2.5; h.reactT = 2.5; step(60);
    const bent = head0 - h.char.bones.head[1];
    F.verdict(!!h.char.anim.dazzle && bent > 0.06, 'a defender blinded by a charge is bent away from it while it lasts', `${h.callsign}: head ${cm(bent)} lower a second in — want > 6`);
    step(200); const up = head0 - h.char.bones.head[1];
    F.verdict(h.state === 'dead' || (!h.char.anim.dazzle && up < 0.05), 'and stands back up when his eyes clear', `${h.callsign}: ${h.state === 'dead' ? 'died meanwhile' : `head ${cm(up)} below where it was`}`);
    const sam = g.player.char.pos; await quiet(() => g.orders.give('fallIn', g.orders.targetAt([sam[0], 0, sam[2]]), 'all'));
    let bad = '', frames = 0; for (let i = 0; i < 60 && !bad; i++) { step(60); frames += 60; for (const x of [g.player, ...g.guards]) for (const [k, v] of Object.entries(x.char.bones as Record<string, number[]>)) if (!v.every(Number.isFinite)) bad = `${x.callsign ?? 'player'} ${k}`; }
    F.verdict(!bad, 'a minute of it runs with every bone of every man finite', bad ? `not finite: ${bad} after ${frames} frames` : `${frames} frames · ${g.guards.length} men`);
  } finally { restore(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the second pass (MOVES.reload / bound / clutch / entry — rebuild/cast-faces-and-moves/moves) ────
//   moves-reload  · the long gun's magazine change on the support arm: at the well when the game lets the empty go, off the gun for a fresh one, back at the well when
//                   it seats, on the handle when it racks, on the fore-end after — and NOTHING the fight reads has moved, to the bit (trigger hand, bore, muzzle, head, trunk)
//   moves-kept    · a hostage's wrists behind her back, hands on the head for a man told to stay down, the support hand to the ribs of a man knocked about — arms only, to the bit
//   moves-entry   · the muzzle down past a friend's back: OFF as shipped (the input is ignored to the bit); on, the bore goes down with both hands on the gun and comes back
//   moves-cast    · the key poses of the three arm layers against the cast's own meshes, every variant: no hand inside a vest, a pouch, a hat or the head
//   moves-second  · in a staged game: hostages are dealt their bound arms, a man the game makes reload shows the magazine change, the entry switch off deals no dip
/** everything the fight reads off a pose: the trigger hand and its finger line (→ gunDir, muzzle), the head and where it looks, the trunk's hit columns, the feet */
const simBits = (c: any) => [c.bones.handR, c.bones.fingerR, c.muzzle, c.gunDir, c.bones.head, c.bones.headTop, c.headDir(), c.bones.hips, c.bones.spine2, c.bones.chest, c.bones.footL, c.bones.footR].map((v: any) => v ? [...v].join(',') : '-').join('|');
const gunFrame = (c: any) => { const d = c.gunDir as V3, g = c.gunUnder() as V3, u: V3 = [-g[0], -g[1], -g[2]], x: V3 = [u[1] * d[2] - u[2] * d[1], u[2] * d[0] - u[0] * d[2], u[0] * d[1] - u[1] * d[0]]; return { x, u, d }; };
const inGun = (c: any, p: V3): V3 => { const F = gunFrame(c), r: V3 = [p[0] - c.bones.handR[0], p[1] - c.bones.handR[1], p[2] - c.bones.handR[2]]; const dot = (a: V3) => a[0] * r[0] + a[1] * r[1] + a[2] * r[2]; return [dot(F.x), dot(F.u), dot(F.d)]; };
export async function movesReload(): Promise<boolean> {
  const F = family('moves-reload: the long gun\'s magazine change on the support arm — and nothing the fight reads moved');
  try {
    CH.MOVES.on = 1;
    const run = async (trained: number, back: boolean, beat: any, clip: number, on: number, long = true) => {
      CH.MOVES.reload = BREAK ? 0 : on; const c = await man(trained); if (!long) { c.anim.longGun = false; for (let i = 0; i < 60; i++) c.update(DT); }
      c.anim.reloadBack = back; c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.reload(clip, beat);
      const fr: { sim: string; all: string; loc: V3; w: number }[] = [];
      for (let i = 0; i < Math.round((beat.dur + 0.4) * 60); i++) { c.update(DT); fr.push({ sim: simBits(c), all: poseBits(c), loc: inGun(c, c.bones.handL), w: c.anim.mv2Shown.reload }); }
      return fr;
    };
    const at = (fr: any[], t: number) => fr[Math.round(t * 60) - 1];
    const { RIG } = await import(`${ROOT}/src/game/rigProps.ts`);
    for (const [who, trained, back, beat, clip, rigMag] of [['an operator, the FN2000 (the box behind the grip)', 1, true, { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 }, 2.4, RIG.sc20k.mag],
      ['a defender, the short carbine (the box ahead of it; the clip 1.6 s under a 2.6 s beat)', 0.12, false, { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 }, 1.6, RIG.carbine.mag]] as any[]) {
      const M = CH.reloadMarks(back), mag = M.mag as V3, handle = M.handle as V3, top = rigMag.adj.off as V3, len = rigMag.l1 - rigMag.l0;
      // the mark is the WRIST with the palm round the box: beside the magazine the rig draws (a hand's width to his left), somewhere down its length, at its place along the gun
      F.verdict(Math.abs(mag[2] - top[2]) < 0.07 && mag[1] < top[1] - 0.03 && mag[1] > top[1] - len - 0.12 && mag[0] > 0.04 && mag[0] < 0.13, '… the hand\'s mark sits on the magazine rigProps draws on this gun', `mark ${mag.map(v => v.toFixed(3)).join(', ')} · the drawn box tops at ${top.map((v: number) => v.toFixed(3)).join(', ')}, ${cm(len)} long`);
      const a = await run(trained, back, beat, clip, 1), b = await run(trained, back, beat, clip, 0);
      let same = 0, moved = 0; for (let i = 0; i < a.length; i++) { if (a[i].sim === b[i].sim) same++; if (a[i].all !== b[i].all) moved++; }
      F.verdict(same === a.length && moved > 60, `${who}: the trigger hand, the bore, the muzzle, the head, its look, the trunk and the feet are the same numbers with the layer on and off, every frame`, `${same} of ${a.length} frames identical in what the fight reads · the pose itself differs on ${moved} (the support arm)`);
      const o = at(a, beat.out), mid = at(a, (beat.out + beat.in_) / 2 + 0.06), inn = at(a, beat.in_), rk = at(a, beat.rack), end = at(a, beat.dur + 0.3), endB = at(b, beat.dur + 0.3);
      const dOut = dist(o.loc, mag), dMid = Math.hypot(...(mid.loc as V3)), dIn = dist(inn.loc, mag), dRk = dist(rk.loc, handle), dEnd = dist(end.loc, endB.loc);
      F.verdict(dOut < 0.05 && dMid > 0.22 && dIn < 0.05 && dRk < 0.05 && dEnd < 0.002 && o.w > 0.95,
        'the support hand is at the well when the empty goes, off the gun for a fresh one, at the well when it seats, on the handle when it racks, back on the fore-end after',
        `off its mark: out ${cm(dOut)} · seat ${cm(dIn)} · rack ${cm(dRk)} (want < 5) · mid-way ${cm(dMid)} from the trigger hand (want > 22) · after, ${cm(dEnd)} from where the gun hold has it (want < 0.2)`);
    }
    { // the game's clock: a man whose beat the GAME holds (a guard's reloadT, a room-fight teammate's) shows that beat — it stands still, so does the hand; it is taken away mid-change, the arm eases back
      CH.MOVES.reload = BREAK ? 0 : 1; const beat = { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 }, M = CH.reloadMarks(true), c = await man(1), ref = await man(1); c.anim.reloadBack = true; c.anim.reloadRow = beat;
      let t = 0, held = 0, atOut = 9, atIn = 9, top = 0, prev: V3 | null = null; const stepAt = (tt: number) => { c.anim.reloadAt = tt; c.update(DT); ref.update(DT); const l = inGun(c, c.bones.handL); const d = prev ? dist(l, prev) : 0; prev = l; return d; };
      for (; t < beat.out - 1e-9; t += DT) stepAt(t); atOut = dist(inGun(c, c.bones.handL), M.mag as V3);
      stepAt(t); for (let i = 0; i < 45; i++) held = Math.max(held, stepAt(t));   // (¾ s with the beat standing still: off his man, the fire branch not ticking it)
      for (; t < beat.in_ - 1e-9; t += DT) stepAt(t); atIn = dist(inGun(c, c.bones.handL), M.mag as V3);
      c.anim.reloadAt = -1; for (let i = 0; i < 40; i++) { c.anim.reloadAt = -1; c.update(DT); ref.update(DT); const l = inGun(c, c.bones.handL); top = Math.max(top, dist(l, prev!)); prev = l; }
      const back = dist(c.bones.handL, ref.bones.handL), same = simBits(c) === simBits(ref);
      F.verdict(atOut < 0.05 && atIn < 0.05 && held < 0.002 && top < 0.045 && back < 0.004 && same, 'on the game\'s own clock: at the well when ITS beat says so, still while it stands still; the beat taken away mid-change, the arm eases back to the gun (no jump)',
        `off the mark at out ${cm(atOut)} · at in ${cm(atIn)} (want < 5) · moved ${cm(held)} a frame while held (want < 0.2) · fastest frame easing back ${cm(top)} (want < 4.5) · then ${cm(back)} from the gun hold · what the fight reads ${same ? 'the same' : 'DIFFERS'}`); }
    { // a toss in the middle of a change: the support hand is the toss's whole, and where it lets go is where it let go before this layer existed
      const beat = { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 }; const mk = async (on: number) => { CH.MOVES.reload = BREAK ? 1 - on : on; const c = await man(1); c.anim.reloadBack = true; c.anim.reloadRow = beat; const fr: string[] = []; let w = 0;
        for (let i = 0; i < 120; i++) { c.anim.reloadAt = 0.3 + i * DT; if (i === 30) c.anim.tossItem(); c.update(DT); if (i >= 30 + 4 && i <= 30 + 30) fr.push([...c.bones.handL].join(',')); if (i === 29) w = c.anim.mv2Shown.reload; } return { fr, w }; };
      const a = await mk(1), b = await mk(0); let same = 0; for (let i = 0; i < a.fr.length; i++) if (a.fr[i] === b.fr[i]) same++;
      F.verdict(a.w > 0.9 && same === a.fr.length, 'a toss in the middle of a change: from 4 frames in until well past the release the support hand is exactly where the toss alone has it', `${same} of ${a.fr.length} frames identical with the layer on and off · the layer was at ${a.w.toFixed(2)} the frame before the toss`); }
    { // a round still up the pipe: no handle
      const beat = { dur: 2.4, out: 0.5, in_: 1.5, rack: null as number | null }, M = CH.reloadMarks(true); CH.MOVES.reload = BREAK ? 0 : 1; const c = await man(1); c.anim.reloadBack = true; c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.reload(2.4, beat);
      const off = (await run(1, true, { ...beat, rack: 2.0 }, 2.4, 0)), full = (await run(1, true, { ...beat, rack: 2.0 }, 2.4, 1)); CH.MOVES.reload = BREAK ? 0 : 1;
      let atIn = 9, back = 9, fullBack = 9; for (let i = 0; i < Math.round(2.8 * 60); i++) { c.update(DT); const l = inGun(c, c.bones.handL); if (i === Math.round(1.5 * 60) - 1) atIn = dist(l, M.mag as V3); if (i === Math.round(2.0 * 60) - 1) { back = dist(l, off[i].loc); fullBack = dist(full[i].loc, off[i].loc); } }
      F.verdict(atIn < 0.05 && back < 0.02 && fullBack > 0.05 && c.anim.mv2Shown.reload === 0, 'a top-up (a round still chambered): the fresh one seated and the hand straight back to the gun — the handle is not run', `at the well ${cm(atIn)} when it seats · at 2.0 s (where an empty gun racks) the hand is ${cm(back)} from the gun hold (want < 2; ${cm(fullBack)} on a full change, on the handle) · the layer out by the end`); }
    { const beat = { dur: 1.6, out: 0.38, in_: 1.02, rack: 1.38 }; const a = await run(0.12, false, beat, 1.6, 1, false), b = await run(0.12, false, beat, 1.6, 0, false); let same = 0; for (let i = 0; i < a.length; i++) if (a[i].all === b[i].all) same++;
      F.verdict(same === a.length, 'a sidearm\'s reload is the clip as it was (the layer is the long gun\'s)', `${same} of ${a.length} frames identical, whole pose`); }
  } finally { restore(); }
  return F.done();
}
export async function movesKept(): Promise<boolean> {
  const F = family('moves-kept: wrists behind the back, hands on the head, a hand to the ribs — arms only');
  try {
    CH.MOVES.on = 1; gltf ??= await loadCharacter();
    const civ = async (bound: number) => { const c: any = new CH.Character(gltf, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 }); c.anim.phase = 0; c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.crouchTarget = 1; c.anim.trained = 0.5;
      for (let i = 0; i < 90; i++) c.update(DT); c.anim.bound = BREAK ? 0 : bound; const fr: string[] = []; for (let i = 0; i < 90; i++) { c.anim.lookYawExtra = 0.5 * Math.sin(i / 20); c.update(DT); fr.push(simBits(c)); } return { c, fr }; };
    for (const [kind, label] of [[1, 'a hostage: wrists together behind her back'], [2, 'told to stay down: both hands on the head']] as const) {
      const free = await civ(0), k = await civ(kind), b = k.c.bones; let same = 0; for (let i = 0; i < k.fr.length; i++) if (k.fr[i].split('|').slice(4).join('|') === free.fr[i].split('|').slice(4).join('|')) same++;
      const apart = dist(b.handL, b.handR), mid: V3 = [(b.handL[0] + b.handR[0]) / 2, (b.handL[1] + b.handR[1]) / 2, (b.handL[2] + b.handR[2]) / 2];
      const behind = -((mid[0] - b.hips[0]) * Math.sin(k.c.bodyYaw) + (mid[2] - b.hips[2]) * Math.cos(k.c.bodyYaw)), toCrown = dist(mid, b.headTop);
      const ok = kind === 1 ? apart < 0.14 && behind > 0.06 : apart < 0.2 && toCrown < 0.17;
      F.verdict(ok && k.c.anim.mv2Shown.bound > 0.95, label, kind === 1 ? `wrists ${cm(apart)} apart (want < 14), ${cm(behind)} behind the pelvis (want > 6)` : `wrists ${cm(apart)} apart (want < 20), their middle ${cm(toCrown)} from the crown (want < 17)`);
      F.verdict(same === k.fr.length, '… and her head, where it looks, the trunk and the feet are the same numbers as with her arms free, every frame', `${same} of ${k.fr.length} frames identical`);
      { CH.MOVES.on = 0; const was = await civ(kind); CH.MOVES.on = 1; const low = Math.min(b.toeL[1], b.toeR[1]), lowWas = Math.min(was.c.bones.toeL[1], was.c.bones.toeR[1]);   // (toesUp: the kneeling foot's toe, which the crouch had 8 cm under the floor — by the foot joint alone)
        F.verdict(low > CH.TOE_FLOOR_Y - 0.002 && dist(b.footL, was.c.bones.footL) < 1e-6 && dist(b.footR, was.c.bones.footR) < 1e-6, '… kept down, neither toe is under the floor, and both ankles are where the game as it was has them', `lowest toe ${cm(low)} off the floor (MOVES off: ${cm(lowWas)}) · ankles moved ${(dist(b.footL, was.c.bones.footL) * 1000).toFixed(3)} / ${(dist(b.footR, was.c.bones.footR) * 1000).toFixed(3)} mm`); }
      k.c.anim.bound = 0; for (let i = 0; i < 120; i++) { k.c.anim.lookYawExtra = free.c.anim.lookYawExtra = 0; k.c.update(DT); free.c.update(DT); }
      const offL = dist(k.c.bones.handL, free.c.bones.handL), offR = dist(k.c.bones.handR, free.c.bones.handR);
      F.verdict(offL < 0.003 && offR < 0.003 && k.c.anim.mv2Shown.bound === 0, '… and let go of, her arms are her own again', `hands ${cm(offL)} / ${cm(offR)} from where the free pose has them`);
    }
    // the clutch: a rifleman rooted by a blast, the support hand to his ribs; the trigger hand keeps the gun where the game has it
    const rif = async (cl: number) => { const c = await man(0.12); c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.clutch = BREAK ? 0 : cl; const fr: string[] = []; for (let i = 0; i < 90; i++) { c.update(DT); fr.push(simBits(c)); } return { c, fr }; };
    CH.MOVES.fold = -1;   // (the arm alone, whatever the wounds switch says: with the fold — below — the trunk is in it, by design)
    // …and shot while a layer shows, the body that FALLS is the one under the arms: where a body comes to lie is the game's (bodies are found where they lie), so the
    // ragdoll is seeded from the pose and the momentum without them (Character.ragdollize ← the animator's armsPre) — particle for particle the fall of the layer off
    { const fall = async (mk: () => Promise<{ c: any }>) => { const { c } = await mk(), r = Math.random; let s = 12345; Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
        const sh = c.anim.mv2Shown, w = Math.max(sh.reload, sh.bound, sh.clutch), hand = [...(c.jointUnder('handL') as V3)] as V3, drawn = [...c.bones.handL] as V3;
        try { c.ragdollize(null, [0.6, 0, 0.8], false); for (let k = 0; k < 90; k++) c.update(DT); } finally { Math.random = r; } return { x: Array.from(c.ragdoll.x as ArrayLike<number>).join(','), w, hand, drawn }; };
      // (a magazine change on the game's clock, caught with the hand off the gun at the well; the same man with no reload beside him)
      const rel = async (on: boolean) => { const c = await man(0.12); c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.reloadBack = true; c.anim.reloadRow = { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 };
        for (let i = 0; i < 60; i++) { c.anim.reloadAt = on && !BREAK ? 0.3 + i * DT : -1; c.update(DT); } return { c }; };
      const free = await fall(() => civ(0)), tied = await fall(() => civ(1)), head = await fall(() => civ(2)), plain = await fall(() => rif(0)), ribs = await fall(() => rif(1)), gun = await fall(() => rel(false)), mag = await fall(() => rel(true));
      const shown = (...a: { w: number }[]) => a.every(o => o.w > 0.9), say = (a: { x: string }, b: { x: string, w: number }) => `${a.x === b.x ? 'identical' : 'DIFFERS'} (layer shown ${b.w.toFixed(2)})`;
      F.verdict(free.x === tied.x && free.x === head.x && shown(tied, head), 'shot with her wrists tied or her hands on her head, she falls exactly as with her arms free', `tied ${say(free, tied)} · hands on the head ${say(free, head)} · every particle, 1.5 s on`);
      F.verdict(plain.x === ribs.x && shown(ribs), 'shot with his hand at his ribs, a rifleman falls exactly as without it', `${say(plain, ribs)} · every particle, 1.5 s on`);
      // (crouched too: the knee the kneeling man is on is the game's — the hand at his ribs changes nothing of how he comes to lie)
      { const low = async (cl: number) => { const o = await rif(cl); o.c.anim.crouchTarget = 1; for (let i = 0; i < 90; i++) o.c.update(DT); return o; };
        const kneel = await fall(() => low(0)), kneelRibs = await fall(() => low(1));
        F.verdict(kneel.x === kneelRibs.x && shown(kneelRibs) && kneel.x !== plain.x, 'shot crouched with his hand at his ribs, he falls exactly as crouched without it', `${say(kneel, kneelRibs)} · ${kneel.x !== plain.x ? 'not the standing fall' : 'THE STANDING FALL: he never crouched'} · every particle, 1.5 s on`); }
      F.verdict(gun.x === mag.x && mag.w > 0.5, 'shot half way through a magazine change, a rifleman falls exactly as with his hand on the gun', `${say(gun, mag)} · every particle, 1.5 s on`);
      const off = dist(mag.drawn, gun.drawn), under = dist(mag.hand, gun.hand);
      F.verdict(off > 0.05 && under < 1e-9 && dist(gun.hand, gun.drawn) === 0, '… and a can thrown from that hand leaves where the hand is without the magazine change (jointUnder)', `drawn hand ${cm(off)} off the gun hold (want > 5) · the hand the game reads ${(under * 1000).toFixed(3)} mm from it (want 0)`); }
    const a = await rif(1), b = await rif(0); let same = 0; for (let i = 0; i < a.fr.length; i++) if (a.fr[i] === b.fr[i]) same++;
    const off = dist(a.c.bones.handL, b.c.bones.handL), toRibs = dist(a.c.bones.handL, a.c.bones.spine2);
    F.verdict(off > 0.12 && toRibs < 0.3 && same === a.fr.length, 'knocked about and still up: the support hand leaves the gun for his ribs, and nothing the fight reads moves', `the hand ${cm(off)} off the fore-end (want > 12), ${cm(toRibs)} from the chest joint (want < 30) · ${same} of ${a.fr.length} frames identical in what the fight reads`);
    a.c.anim.clutch = 0; for (let i = 0; i < 90; i++) { a.c.update(DT); b.c.update(DT); }
    F.verdict(dist(a.c.bones.handL, b.c.bones.handL) < 0.002, 'let go of, the hand is back on the gun', `${cm(dist(a.c.bones.handL, b.c.bones.handL))} from where the gun hold has it`);
    // the fold (MOVES.fold — off unless the wounds switch or ?fold raises it; pinned on here): he stays doubled over for the whole stagger — the trunk and the head, so NOT arms-only — and stands back up as he was
    if ('fold' in CH.MOVES) {
      CH.MOVES.fold = 1;
      const f = await man(0.12), u = await man(0.12); for (const c of [f, u]) { c.anim.upper = 'none'; c.anim.stance = 'lowReady'; } f.anim.clutch = BREAK ? 0 : 1;
      let low = 9, lowAt = 0; for (let i = 0; i < 90; i++) { f.update(DT); u.update(DT); if (i >= 30) { const d = u.bones.head[1] - f.bones.head[1]; if (d < low) { low = d; lowAt = i; } } }
      F.verdict(low > 0.07 && dist(f.bones.handL, f.bones.spine2) < 0.3, 'with the fold he stays doubled over for as long as he is rooted: head down every frame from half a second on, the hand on his ribs', `the head at least ${cm(low)} lower than upright (frame ${lowAt}; want > 7) · the hand ${cm(dist(f.bones.handL, f.bones.spine2))} from the chest joint`);
      f.anim.clutch = 0; let back = -1; for (let i = 0; i < 120; i++) { f.update(DT); u.update(DT); if (back < 0 && simBits(f) === simBits(u)) back = i; }
      F.verdict(back >= 0 && simBits(f) === simBits(u), 'let go of, he is upright again and bit for bit what the fight reads of a man never hit', back >= 0 ? `identical from frame ${back} after the stagger ends` : 'never identical again in 2 s');
      // as shipped (MOVES.fold 0) the fold is nobody's unless the wounds switch is on: off, a staggered man's trunk is the base's, frame for frame
      if (CH.FOLD_WITH) {
        const keepWith = CH.FOLD_WITH.on; CH.MOVES.fold = 0;
        try {
          const run = async (wounds: boolean) => { CH.FOLD_WITH.on = () => wounds; const s = await man(0.12), n = await man(0.12); for (const c of [s, n]) { c.anim.upper = 'none'; c.anim.stance = 'lowReady'; } s.anim.clutch = 1; let eq = 0, low = 0; for (let i = 0; i < 90; i++) { s.update(DT); n.update(DT); if (simBits(s) === simBits(n)) eq++; low = Math.max(low, n.bones.head[1] - s.bones.head[1]); } return { eq, low }; };
          const offR = await run(false), onR = await run(!BREAK);
          F.verdict(offR.eq === 90 && onR.low > 0.07, 'as shipped the fold comes up with the wounds switch and only with it: wounds off, a staggered man is frame for frame what the fight reads of one never hit', `wounds off: ${offR.eq} of 90 frames identical · wounds on: the head ${cm(onR.low)} down (want > 7)`);
        } finally { CH.FOLD_WITH.on = keepWith; }
      }
    }
  } finally { restore(); }
  return F.done();
}
export async function movesEntry(): Promise<boolean> {
  const F = family('moves-entry: the muzzle down past a friend\'s back — off as shipped, its own switch');
  try {
    CH.MOVES.on = 1;
    F.verdict(keep.entry === 0 && keep.entryEyes === 0 && keep.reload === 1 && keep.bound === 1 && keep.clutch === 1, 'as shipped the entry switch and its eyes-up part are off, the three arms-only layers are on', `MOVES: entry ${keep.entry} · entryEyes ${keep.entryEyes} · reload ${keep.reload} · bound ${keep.bound} · clutch ${keep.clutch}`);
    const run = async (entry: number, dip: number) => { CH.MOVES.entry = BREAK ? 0 : entry; const c = await man(1, { speed: 1.3 }); const fr: string[] = []; c.anim.dip = dip; for (let i = 0; i < 60; i++) { c.update(DT); fr.push(poseBits(c)); } return { c, fr }; };
    const offA = await run(0, 1), offB = await run(0, 0); let same = 0; for (let i = 0; i < offA.fr.length; i++) if (offA.fr[i] === offB.fr[i]) same++;
    F.verdict(same === offA.fr.length, 'off: a friend before the muzzle changes nothing, to the bit', `${same} of ${offA.fr.length} frames identical, whole pose`);
    const on = await run(1, 1), lvl = await run(1, 0), c = on.c, pitch = Math.asin(c.gunDir[1]), pitch0 = Math.asin(lvl.c.gunDir[1]);
    const gripOn = inGun(c, c.bones.handL), grip0 = inGun(lvl.c, lvl.c.bones.handL), stock = dist(c.bones.handR, lvl.c.bones.handR);
    F.verdict(pitch < pitch0 - 0.4 && dist(gripOn, grip0) < 0.03 && stock < 0.09, 'on: the bore goes down past him, both hands still on the gun, the stock still in the shoulder', `bore ${deg(pitch)} against ${deg(pitch0)} · the support hand ${cm(dist(gripOn, grip0))} off its grip (want < 3) · the trigger hand moved ${cm(stock)} (want < 9)`);
    { CH.MOVES.entryEyes = BREAK ? 0 : 1; const ey = await run(1, 1); CH.MOVES.entryEyes = 0; const lift = ey.c.anim.sightsLift, back = Math.asin(ey.c.gunDir[1]) + lift; const flat = Math.hypot(ey.c.gunDir[0], ey.c.gunDir[2]), flatUp = Math.cos(back), SIGHTS = 0.866;   // guards.ts SIGHTS_COS: the flat part of the bore the sights eye asks for (MOVES.entryEyes: guards.ts canSeeChar adds the lift back before its eyes-on-the-sights test — asked of canSeeChar itself in roomfight-eyes)
      let samePose = 0; for (let i = 0; i < ey.fr.length; i++) if (ey.fr[i] === on.fr[i]) samePose++;
      F.verdict(c.anim.sightsLift === 0 && lift > 0.4 && Math.abs(back - pitch0) < 0.03 && samePose === on.fr.length && flat < SIGHTS && flatUp > SIGHTS, 'eyes up (entryEyes): the pose is the dip\'s to the bit; dipped, the bore fails the eyes-on-the-sights test, and the lift it publishes puts the gun line back where the undipped man\'s is', `flat part of the dipped bore ${flat.toFixed(3)} against the test's ${SIGHTS} (fails), ${flatUp.toFixed(3)} read with the lift (passes) · lift ${deg(lift)} · bore ${deg(Math.asin(ey.c.gunDir[1]))} + lift = ${deg(back)} against ${deg(pitch0)} undipped · ${samePose} of ${on.fr.length} frames the dip's own pose · without the part the lift is ${c.anim.sightsLift}`); }
    { const rows: string[] = []; let worst = -9;   // only ever down: a muzzle already lower stays, one carried high is over him already
      for (const st of ['portLong', 'lowLong', 'patrolLong', 'shoulder'] as const) { const mk = async (dip: number) => { CH.MOVES.entry = BREAK ? 0 : 1; const m = await man(1); m.anim.upper = 'none'; m.anim.longStance = st; m.anim.dip = dip; for (let i = 0; i < 90; i++) m.update(DT); return Math.asin(m.gunDir[1]); };
        const p1 = await mk(1), p0 = await mk(0); worst = Math.max(worst, p1 - p0); rows.push(`${st} ${deg(p0)} → ${deg(p1)}`); }
      F.verdict(worst < 0.01, 'whatever the carriage, the dip never RAISES a muzzle', rows.join(' · ')); }
    c.anim.dip = 0; for (let i = 0; i < 40; i++) { c.update(DT); lvl.c.update(DT); }
    F.verdict(Math.abs(Math.asin(c.gunDir[1]) - Math.asin(lvl.c.gunDir[1])) < 0.03, 'clear of him, the gun is back up inside two thirds of a second', `bore ${deg(Math.asin(c.gunDir[1]))} against ${deg(Math.asin(lvl.c.gunDir[1]))}`);
  } finally { restore(); }
  return F.done();
}
export { movesCast } from './moves-cast.ts';   // (the same poses against what each variant of the cast WEARS — its own file: it skins the cast on the CPU)
export async function movesSecond(): Promise<boolean> {
  const F = family('moves-second: the second pass in a staged game — hostages bound, a reloading man shows it, no dip dealt with the switch off');
  try {
    const { stage } = await import('./bang-tally.ts');
    { const S: any = await quiet(() => stage('hostage-rescue', 1)); const { g, step } = S; CH.MOVES.on = 1; step(90);
      const hs = g.civilians.filter((x: any) => g.rescue?.isHostage(x) && x.state !== 'dead');
      F.verdict(hs.length > 0 && hs.every((x: any) => x.char.anim.bound === 1 && x.char.anim.mv2Shown.bound > 0.9), 'every living hostage is down with her wrists behind her', `${hs.length} hostages · bound ${hs.map((x: any) => `${x.char.anim.bound}/${x.char.anim.mv2Shown.bound.toFixed(2)}`).join(' ')}`);
      const ops = g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead'); let dips = 0; for (let i = 0; i < 600; i++) { step(1); for (const x of ops) if (x.char.anim.dip > 0 || x.char.anim.mv2Shown.dip > 0) dips++; }
      F.verdict(dips === 0, 'with the entry switch off no man is dealt a dip in ten seconds of it', `${dips} man-frames with a dip`);
      // a teammate the room fight makes reload (roomfight.ts reloadUntil — it plays no clip): the hand shows the change on the game's clock, and the fight's own state is what it was
      const tm = ops.map((x: any) => ({ x, O: g.fight.opOf(x) })).filter((r: any) => r.O && r.x.state !== 'dead' && r.x.char.anim.longGun)[0];
      if (!tm) F.verdict(BREAK, 'a teammate the room fight makes reload shows the change', 'no operative on the room fight\'s list in this stage');
      else { const R = tm.x.weapon.def.reload; tm.O.reloadUntil = g.time + R.dur; let shown = 0, n = 0; for (let i = 0; i < Math.round(R.dur * 60) - 6; i++) { if (tm.x.state === 'dead') break; if (tm.O.reloadUntil <= g.time) break; step(1); const t = R.dur - (tm.O.reloadUntil - g.time); if (t > 0.4 && t < R.dur - 0.4) { n++; if (tm.x.char.anim.mv2Shown.reload > 0.5) shown++; } }
        F.verdict(n > 30 && shown >= n * 0.9, 'a teammate the room fight makes reload shows the change through the middle of it', `${tm.x.callsign}: ${n} frames mid-reload · the layer in the pose on ${shown}`); } }
    { const S: any = await quiet(() => stage('night-breach', 1)); const { g, W } = S; CH.MOVES.on = 1; S.step(30);
      // the defenders down to their last round and Sam walked into their room in the light (god mode): the round that empties the box starts the game's own reload beat
      const foes = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead' && x.char.anim.longGun); for (const x of foes) { x.weapon.mag = 0; x.weapon.chamber = 1; }
      const h = foes[0], hp = h.char.pos, y = h.char.bodyYaw; g.playerInvisible = false; g.teleportPlayer([hp[0] + Math.sin(y) * 2.2, 0, hp[2] + Math.cos(y) * 2.2]);
      let seen = 0, shown = 0, bad = '', who = new Set<string>(); for (let i = 0; i < 1200 && !bad; i++) { g.player.visibility = 1; W.step(DT); for (const x of g.guards) { if (x.state !== 'dead' && x.reloadT > 0.3 && x.reloadT < x.weapon.def.reload.dur - 0.3 && x.char.anim.longGun && !x.char.anim.dazzle) { seen++; who.add(x.callsign); if (x.char.anim.mv2Shown.reload > 0.5) shown++; } for (const [k, v] of Object.entries(x.char.bones as Record<string, number[]>)) if (!v.every(Number.isFinite)) bad = `${x.callsign} ${k}`; } }
      F.verdict(!bad && seen > 30 && shown >= seen * 0.9, 'a man the game makes reload shows the magazine change through the middle of his beat, every bone finite', bad ? `not finite: ${bad}` : `${[...who].join(', ') || 'nobody'} reloading: ${seen} man-frames mid-beat · the layer in the pose on ${shown} of them`); }
  } finally { restore(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── moves-hands: THE HAND PASS (character.ts HAND / handsPass) ─────────────────────────────────────
//   moves-hands   · an empty hand is a relaxed hand (not the clips' fist, not a paddle; index → pinky a little more; a man's two hands and two men's hands differ),
//                   a hand on a gun / a torch / a can keeps its grip, a hand a layer shaped keeps that shape, the crouch clips keep their own — and it is LOOKS ONLY:
//                   with the pass in and with it taken out, every bone the game reads, the bore, the muzzle, the proxies and the drawn props are the same numbers
const DIGITS = (s: 'L' | 'R') => ['thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky'].map(f => [1, 2, 3].map(j => `DEF-${f}.0${j}.${s}`));
/** per digit (thumb, index ‥ pinky) the mean angle its three joints stand from the bind pose (straight), degrees */
function flexOf(c: any, s: 'L' | 'R'): number[] {
  const ch = c.ch, P = c.anim.pose;
  return DIGITS(s).map(names => names.reduce((n, nm) => { const i = ch.nodeByName.get(nm), a = P.rot(i), b = ch.nodes[i].r; const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return n + (d >= 1 ? 0 : 2 * Math.acos(d) * 57.2958); }, 0) / 3);
}
/** a man with the pass taken out of his animator (the rest of MOVES untouched): what the pose is without it */
const noHands = (c: any) => { c.anim.handsPass = () => { }; return c; };
/** everything the GAME reads off a pose, as one string of exact bits: the bones (the knuckles the bore is measured to among them), the bore, the muzzle, the chest's
 *  facing, the 15 proxies, where the drawn gun's boxes are — and the pose itself, joint by joint, with the digit joints left out */
function gameBits(c: any, RP: any): string {
  const f = new Float64Array(1), u = new Uint8Array(f.buffer); let h = 2166136261; const add = (x: number) => { f[0] = x; for (const y of u) { h ^= y; h = Math.imul(h, 16777619); } };
  for (const k of Object.keys(c.bones).sort()) for (const x of c.bones[k]) add(x);
  for (const v of [c.gunDir, c.muzzle, c.chestDir, c.pos]) for (const x of v) add(x); add(c.bodyYaw); add(c.aimYaw);
  for (const k of c.capsules().caps) for (const x of k) add(x);
  const out: any[] = []; RP.rigBoxes(c, { goggles: false, nv: false, slot: 1, lightOn: true, isGuard: true, torch: c.anim.upper === 'torch', weapon: c.anim.longGun ? 'carbine' : 'pistol' }, out);
  for (const b of out) { for (const x of b.c) add(x); for (const x of b.h) add(x); if (b.rot) for (const x of b.rot) add(x); }
  const lp = RP.rigLightPose(c); for (const x of [...lp.pos, ...lp.dir]) add(x);
  const dig = new Set<number>(); for (const s of ['L', 'R'] as const) for (const names of DIGITS(s)) for (const nm of names) dig.add(c.ch.nodeByName.get(nm));
  const d = c.anim.pose.data; for (let i = 0; i < c.ch.nodes.length; i++) if (!dig.has(i)) for (let k = 0; k < 10; k++) add(d[i * 10 + k]);
  for (const t of c.anim.twists) { add(t.node); add(t.yaw); add(t.pitch); }
  return (h >>> 0).toString(16);
}
const digitBits = (c: any) => { let s = ''; for (const sd of ['L', 'R'] as const) for (const names of DIGITS(sd)) for (const nm of names) s += c.anim.pose.rot(c.ch.nodeByName.get(nm)).map((x: number) => x.toFixed(6)).join(',') + ';'; return s; };
async function bare(id: number, trained: number, o: { rifle?: boolean; upper?: string } = {}) {
  gltf ??= await loadCharacter();
  const c: any = new CH.Character(gltf, { id, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 });
  c.anim.phase = 0; c.anim.trained = trained; c.anim.upper = o.upper ?? 'none'; c.anim.stance = 'none';
  if (o.rifle) { c.anim.longGun = true; c.anim.longSteady = trained > 0.5 ? 1 : 0; c.muzzleAhead = 0.5; }
  return c;
}
export async function movesHands(): Promise<boolean> {
  const F = family('moves-hands: an empty hand is a relaxed hand, a hand on something keeps its grip, a layer\'s hand is the layer\'s — and nothing the game reads moves by a bit');
  try {
    CH.MOVES.on = 1; const RP: any = await import(`${ROOT}/src/game/rigProps.ts`); const run = (c: any, n: number) => { for (let i = 0; i < n; i++) c.update(DT); };
    const d1 = (a: number[]) => a.map(x => x.toFixed(0)).join(' ');
    // (1) the relaxed hand, standing and walking
    { const a = await bare(11, 0.12), b = noHands(await bare(11, 0.12)); run(a, 90); run(b, 90);
      const L = flexOf(a, 'L'), R = flexOf(a, 'R'), L0 = flexOf(b, 'L'); const fin = (x: number[]) => x.slice(1);
      F.verdict(fin(L0).every(x => x > 70) && (BREAK ? fin(L).every(x => x > 70) : true), 'without the pass a standing man\'s empty hands are the library\'s fist', `mean flexion per joint, left index ‥ pinky: ${d1(fin(L0))}°`);
      F.verdict([...fin(L), ...fin(R)].every(x => x > 14 && x < 52), 'with it they are neither a fist nor a paddle: every finger curled between 14° and 52° a joint', `left ${d1(fin(L))}° · right ${d1(fin(R))}°`);
      F.verdict(fin(L)[3] > fin(L)[0] + 4 && fin(R)[3] > fin(R)[0] + 4 && fin(L)[2] > fin(L)[0] && fin(R)[2] > fin(R)[0], 'curled a little more from the index to the little finger', `left index ${fin(L)[0].toFixed(0)}° → pinky ${fin(L)[3].toFixed(0)}° · right ${fin(R)[0].toFixed(0)}° → ${fin(R)[3].toFixed(0)}°`);
      F.verdict(L[0] < L0[0] - 8, 'the thumb is loose, not folded over a fist', `thumb ${L[0].toFixed(0)}° a joint (the fist's: ${L0[0].toFixed(0)}°)`);
      const o = await bare(12, 0.12); run(o, 90); const O = flexOf(o, 'L'); const twin = await bare(11, 0.12); run(twin, 90);
      const dLR = Math.max(...fin(L).map((x, i) => Math.abs(x - fin(R)[i]))), dMen = Math.max(...fin(L).map((x, i) => Math.abs(x - fin(O)[i])));
      F.verdict(dLR > 0.5 && dLR < 12 && dMen > 0.5 && dMen < 14 && digitBits(twin) === digitBits(a), 'a man\'s two hands differ a little, two men\'s hands differ a little, and the same man is dealt the same hands every time (off his id, no dice)', `left vs right: up to ${dLR.toFixed(1)}° a joint · id 11 vs id 12: up to ${dMen.toFixed(1)}° · id 11 twice: ${digitBits(twin) === digitBits(a) ? 'identical' : 'DIFFER'}`);
      a.anim.speed = 1.4; b.anim.speed = 1.4; run(a, 120); run(b, 120); const W = flexOf(a, 'R');
      F.verdict(fin(W).every(x => x > 14 && x < 52), 'walking, the same', `right ${d1(fin(W))}°`); }
    // (2) crouched: the clip's own open hand — its FINGERS untouched, its thumb (a straight peg in the clip) brought to the standing hand's relaxed thumb
    { const a = await bare(11, 0.5), b = noHands(await bare(11, 0.5)), st = await bare(11, 0.5); a.anim.crouchTarget = b.anim.crouchTarget = 1; run(a, 120); run(b, 120); run(st, 120);
      const bits = (c: any, thumb: boolean) => { let s = ''; for (const sd of ['L', 'R'] as const) for (const names of thumb ? DIGITS(sd).slice(0, 1) : DIGITS(sd).slice(1)) for (const nm of names) s += c.anim.pose.rot(c.ch.nodeByName.get(nm)).map((x: number) => x.toFixed(6)).join(',') + ';'; return s; };
      const offOf = (x: any, y: any) => Math.max(...(['L', 'R'] as const).flatMap(sd => DIGITS(sd)[0].map(nm => { const i = x.ch.nodeByName.get(nm), q = x.anim.pose.rot(i), r = y.anim.pose.rot(i), d = Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]); return d >= 1 ? 0 : 2 * Math.acos(d) * 57.2958; })));
      const was = offOf(b, st), now = offOf(a, st);
      F.verdict(bits(a, false) === bits(b, false), 'crouched, the fingers are the crouch clip\'s own (already open): not a finger joint moved', `left ${d1(flexOf(a, 'L'))}° — ${bits(a, false) === bits(b, false) ? 'identical with and without' : 'DIFFER'}`);
      F.verdict(was > 8 && now < 2, 'crouched, the thumb is the relaxed hand\'s (the clip holds it out as a straight peg)', `thumb joints off the standing hand's: up to ${was.toFixed(1)}° in the clip, ${now.toFixed(1)}° with the pass`); }
    // (3) a hand on something keeps its grip: the long gun's two, the pistol's two, the torch's fist, a can
    { const same: string[] = [], diff: string[] = [];
      for (const [name, mk] of [['rifle shouldered (untrained)', async () => bare(11, 0.12, { rifle: true, upper: 'aim' })], ['rifle carried (untrained)', async () => bare(11, 0.12, { rifle: true, upper: 'relaxed' })],
        ['pistol aimed (untrained)', async () => bare(11, 0.12, { upper: 'aim' })], ['pistol lowered (untrained)', async () => bare(11, 0.12, { upper: 'relaxed' })]] as [string, () => Promise<any>][]) {
        const a = await mk(), b = noHands(await mk()); run(a, 90); run(b, 90); (digitBits(a) === digitBits(b) ? same : diff).push(name); }
      F.verdict(diff.length === 0, 'both hands on a long gun or a pistol: every digit as it was', diff.length ? `MOVED: ${diff.join(', ')}` : same.join(' · '));
      const t = await bare(11, 0.12, { upper: 'torch' }), t0 = noHands(await bare(11, 0.12, { upper: 'torch' })); run(t, 90); run(t0, 90);
      const R = flexOf(t, 'R'), R0 = flexOf(t0, 'R');
      F.verdict(R.every((x, i) => Math.abs(x - R0[i]) < 0.01), 'the torch hand keeps its fist round the torch', `right ${d1(R)}° (without the pass ${d1(R0)}°)`);
      const k = await bare(11, 1); k.anim.grip[1] = true; run(k, 90); const K = flexOf(k, 'R'), KL = flexOf(k, 'L');
      F.verdict(K.slice(1).every(x => x > 70) && KL.slice(1).every(x => x < 52), 'a can in the right fist (grip): that hand stays closed, the other is relaxed', `right ${d1(K)}° · left ${d1(KL)}°`);
      k.anim.grip[1] = false; let worst = 0, prev = flexOf(k, 'R'); for (let i = 0; i < 40; i++) { k.update(DT); const n = flexOf(k, 'R'); worst = Math.max(worst, ...n.map((x, j) => Math.abs(x - prev[j]))); prev = n; }
      F.verdict(prev.slice(1).every(x => x < 52) && worst < 14, 'let go of, it opens over a few frames, not in one', `largest step ${worst.toFixed(1)}° a joint a frame · ends ${d1(prev)}°`); }
    // (4) a layer's hand is the layer's: the fist of 'hold', the flat hand over a blinded man's eyes, hands on the head, a hand at the ribs, the reload — at full weight exactly what it posed
    { const rows: string[] = []; let ok = true;
      const cases: [string, 'L' | 'R' | 'LR', (c: any) => void][] = [
        ['signal hold (the fist up)', 'L', c => { c.anim.signal('hold'); run(c, 30); }],
        ['hands on the head', 'LR', c => { c.anim.crouchTarget = 1; run(c, 60); c.anim.bound = 2; run(c, 80); }],
        ['wrists behind the back', 'LR', c => { c.anim.crouchTarget = 1; run(c, 60); c.anim.bound = 1; run(c, 80); }],
        ['back to the wall', 'LR', c => { c.anim.stance = 'wall'; run(c, 90); }] ];
      for (const [name, sides, go] of cases) { const a = await bare(11, 0.5), b = noHands(await bare(11, 0.5)); run(a, 60); run(b, 60); go(a); go(b);
        const worst = Math.max(...(sides === 'LR' ? ['L', 'R'] as const : [sides] as ('L' | 'R')[]).flatMap(s => flexOf(a, s).map((x, i) => Math.abs(x - flexOf(b, s)[i]))));
        ok &&= worst < 1.5; rows.push(`${name} ${worst.toFixed(2)}°`); }
      for (const [name, go] of [['hand over the eyes', (c: any) => { c.anim.dazzle = { from: [0.5, 1, 2], k: 1 }; run(c, 60); }], ['hand to the ribs', (c: any) => { c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.clutch = 1; run(c, 70); }],
        ['reload, the fresh magazine', (c: any) => { c.anim.upper = 'none'; c.anim.stance = 'lowReady'; run(c, 30); c.anim.reload(1.6, { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 }); run(c, 76); }]] as [string, (c: any) => void][]) {
        const a = await bare(11, 0.12, { rifle: true, upper: 'aim' }), b = noHands(await bare(11, 0.12, { rifle: true, upper: 'aim' })); run(a, 60); run(b, 60); go(a); go(b);
        const worst = Math.max(...flexOf(a, 'L').map((x, i) => Math.abs(x - flexOf(b, 'L')[i]))); ok &&= worst < 1.5; rows.push(`${name} ${worst.toFixed(2)}°`); }
      F.verdict(ok, 'hands a layer has shaped are what the layer posed (the pass moves no joint of them by 1.5°)', rows.join(' · ')); }
    // (5) a layer coming on and going off: no digit jumps (the hold signal from a relaxed hand, and back)
    { const a = await bare(11, 0.5); run(a, 60); let worst = 0, prev = flexOf(a, 'L'); a.anim.signal('hold');
      for (let i = 0; i < 100; i++) { a.update(DT); const n = flexOf(a, 'L'); worst = Math.max(worst, ...n.map((x, j) => Math.abs(x - prev[j]))); prev = n; }
      F.verdict(worst < 16 && prev.slice(1).every(x => x < 52), 'the fist of a signal comes up out of the relaxed hand and goes back to it without a jump', `largest step ${worst.toFixed(1)}° a joint a frame over the signal · after it ${d1(prev)}°`); }
    // (6) the drilled trigger finger: straight along the frame until he fires, on the trigger while he does; an untrained man's is where the clip has it
    { const a = await bare(11, 1, { rifle: true, upper: 'aim' }), b = noHands(await bare(11, 1, { rifle: true, upper: 'aim' })); run(a, 90); run(b, 90);
      const ix = (c: any) => flexOf(c, 'R')[1], rest = (c: any) => flexOf(c, 'R').filter((_, i) => i !== 1), others = Math.max(...rest(a).map((x, i) => Math.abs(x - rest(b)[i])));
      const i0 = ix(a), c0 = ix(b); a.anim.fire(); b.anim.fire(); run(a, 6); run(b, 6); const i1 = ix(a), c1 = ix(b); run(a, 90); run(b, 90); const i2 = ix(a);
      F.verdict(i0 < 14 && c0 > 25 && others < 0.01 && (BREAK ? i0 > 25 : true), 'a drilled man with the gun up and no round going: the index lies straight, and only the index differs', `index ${i0.toFixed(0)}° a joint (the clip's: ${c0.toFixed(0)}°) · every other digit of that hand within ${others.toFixed(3)}°`);
      F.verdict(Math.abs(i1 - c1) < 4 && i2 < 14, 'a tenth of a second into a round it is on the trigger, and back along the frame a second and a half after', `0.1 s after the round ${i1.toFixed(0)}° (the clip's ${c1.toFixed(0)}°) · 1.6 s after ${i2.toFixed(0)}°`);
      const u = await bare(11, 0.12, { rifle: true, upper: 'aim' }), u0 = noHands(await bare(11, 0.12, { rifle: true, upper: 'aim' })); run(u, 90); run(u0, 90);
      F.verdict(digitBits(u) === digitBits(u0), 'an untrained man\'s finger stays where the clip has it: inside the guard', `index ${ix(u).toFixed(0)}° — ${digitBits(u) === digitBits(u0) ? 'identical with and without' : 'DIFFER'}`); }
    // (7) LOOKS ONLY: a scripted two minutes each of a rifleman (both drills), a pistol man, an unarmed man and a torch carrier, with the pass in and with it out —
    //     bones, bore, muzzle, chest, the 15 proxies, the drawn gun's boxes, the light's pose and every non-digit joint of the pose, hashed every frame
    { const rows: string[] = []; let ok = true, moved = 0;
      const script = (c: any, f: number) => { const A = c.anim;
        if (f % 97 === 5 && (A.longGun || A.upper === 'aim')) A.fire(); if (f === 150) A.flinchFrom([1, 0, 1]); if (f === 260) A.hitFrom([0, 0, -1]); if (f === 380 && A.longGun) A.tossItem(); if (f === 520) A.signal('hold'); if (f === 640) A.signal('go');
        if (f === 760 && A.longGun) A.reload(1.6, { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 }); if (f === 1000) A.dazzle = { from: [1, 1, 2], k: 1 }; if (f === 1100) A.dazzle = null; if (f === 1200) A.speed = 1.4; if (f === 1500) A.crouchTarget = 1;
        if (f === 1800) { A.crouchTarget = 0; A.speed = 3.4; } if (f === 2100) { A.speed = 0; if (!A.longGun && A.upper === 'none') A.bound = 2; } if (f === 2300) { A.bound = 0; A.clutch = 1; } if (f === 2450) A.clutch = 0;
        if (f === 2600 && !A.longGun) A.throwItem?.(); if (f === 2800) A.kickDoor(); if (f === 3000) A.stance = 'wall'; if (f === 3200) A.stance = 'none';
        c.aimYaw = 0.6 * Math.sin(f * 0.013); c.aimPitch = 0.2 * Math.sin(f * 0.021); };
      for (const [name, mk] of [['operator, rifle', () => bare(21, 1, { rifle: true, upper: 'aim' })], ['defender, rifle', () => bare(25, 0.12, { rifle: true, upper: 'relaxed' })], ['pistol', () => bare(12, 0.12, { upper: 'aim' })],
        ['unarmed', () => bare(40, 0.5)], ['torch', () => bare(10, 0.12, { upper: 'torch' })]] as [string, () => Promise<any>][]) {
        const a = await mk(), b = noHands(await mk()); let bad = -1, dig = 0;
        for (let f = 0; f < 3400; f++) { script(a, f); script(b, f); a.update(DT); b.update(DT); if (bad < 0 && gameBits(a, RP) !== gameBits(b, RP)) bad = f; if (digitBits(a) !== digitBits(b)) dig++; }
        ok &&= bad < 0; moved += dig; rows.push(`${name}: ${bad < 0 ? 'identical' : `DIFFERS at frame ${bad}`} (digits differ on ${dig} of 3400 frames)`); }
      F.verdict(ok && moved > 3000, 'with the pass in and with it out, everything the game reads off a pose is bit for bit the same over 3400 scripted frames a man — only finger and thumb joints differ', rows.join(' · ')); }
    // (8) with MOVES off nothing of it runs: the pose is the pose, whatever the grip input says
    { CH.MOVES.on = 0; const a = await bare(11, 1), b = await bare(11, 1); a.anim.grip[0] = a.anim.grip[1] = true; let same = true;
      for (let f = 0; f < 200; f++) { a.update(DT); b.update(DT); same &&= poseBits(a) === poseBits(b) && digitBits(a) === digitBits(b); }
      F.verdict(same && flexOf(a, 'L').slice(1).every(x => x > 70), 'MOVES off: no pass — the clips\' fists, as the build was', `left ${d1(flexOf(a, 'L'))}° · 200 frames ${same ? 'identical' : 'DIFFER'} with the grip input set and not`); CH.MOVES.on = 1; }
  } finally { restore(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the 'turn' family: TURN WEIGHT (character.ts TURN) ──────────────────────────────────────────
const keepTurn = { ...CH.TURN };
const restoreTurn = () => Object.assign(CH.TURN, keepTurn);
const wrapA = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
/** a man handed one wish (his gun to `aim`, his feet to `body`, both from 0) and stepped until he is on it: seconds, top rates, the worst frame-to-frame change of rate, whether he ever passed the point */
async function swing(h: number, k: number, aim: number, body: number, secs = 2.5) {
  const c = await man(k); c.turn.on = true; c.turn.h = h; c.turn.k = k; c.bodyYaw = 0; c.aimYaw = 0; c.update(DT);
  let t = NaN, tb = NaN, peak = 0, peakB = 0, jerk = 0, past = 0, w0 = 0, a0 = 0, b0 = 0; const rel = (): number => wrapA(c.aimYaw - c.bodyYaw);
  for (let i = 0; i < secs * 60; i++) {
    c.turnBegin(); c.bodyYaw = body; c.aimYaw = aim; c.update(DT);
    const a = c.aimYaw, b = c.bodyYaw, w = wrapA(a - a0) / DT, wb = wrapA(b - b0) / DT; peak = Math.max(peak, Math.abs(w)); peakB = Math.max(peakB, Math.abs(wb));
    if (i > 0 && Math.abs(w) > Math.abs(w0)) jerk = Math.max(jerk, Math.abs(w - w0) / DT);   // (speeding up only: the brake is the profile's)
    if (Math.sign(aim) * wrapA(a - aim) > 1e-6 && Math.abs(aim) < 3) past = Math.max(past, Math.abs(wrapA(a - aim)));
    if (isNaN(t) && Math.abs(wrapA(a - aim)) < 3 / 57.2958) t = (i + 1) * DT; if (isNaN(tb) && Math.abs(wrapA(b - body)) < 3 / 57.2958) tb = (i + 1) * DT;
    w0 = w; a0 = a; b0 = b;
  }
  return { t, tb, peak, peakB, jerk, past, rel: rel(), c };
}
export async function turnOff(): Promise<boolean> {
  const F = family('turn-off: with the weight off — or a man nobody weighs — his yaws are the ones written, to the bit');
  try {
    CH.TURN.on = 0; let c = await man(1); c.turn.on = true; let worst = 0;
    for (let i = 0; i < 120; i++) { const b = Math.sin(i * 0.37) * 2, a = b + Math.cos(i * 0.91); c.turnBegin(); c.bodyYaw = b; c.aimYaw = a; c.update(DT); worst = Math.max(worst, Math.abs(c.bodyYaw - b), Math.abs(c.aimYaw - a)); }
    F.verdict(worst === 0, 'TURN.on 0: bodyYaw and aimYaw come out of update() as they went in', `worst difference over 120 frames of thrown yaws: ${worst}`);
    CH.TURN.on = 1; c = await man(1); c.turn.on = false; worst = 0;
    for (let i = 0; i < 120; i++) { const b = Math.sin(i * 0.37) * 2, a = b + Math.cos(i * 0.91); c.turnBegin(); c.bodyYaw = b; c.aimYaw = a; c.update(DT); worst = Math.max(worst, Math.abs(c.bodyYaw - b), Math.abs(c.aimYaw - a)); }
    F.verdict(worst === 0, 'a man not weighed (Sam, a civilian, a showcase\'s cast): the same, with TURN on', `worst difference ${worst}`);
  } finally { restoreTurn(); restore(); }
  return F.done();
}
export async function turnWeight(): Promise<boolean> {
  const F = family('turn-weight: a muzzle and a body come round as masses — up to speed, a top rate by the weapon, off speed onto the point and never past it');
  try {
    CH.TURN.on = 1; const T = CH.TURN, Q = Math.PI / 2;
    const car = await swing(0.82, 1, Q, 0), pis = await swing(1, 1, Q, 0), rif = await swing(0.7, 1, Q, 0), green = await swing(0.82, 0.12, Q, 0);
    F.verdict(car.t > 0.2 && car.t < 0.5 && (BREAK ? car.t < 0.1 : true), 'a trained man brings a carbine a quarter turn round in over a fifth and under half a second (it was 0.2 s flat out, no run-up)', `90° with handling 0.82: on the point (inside 3°) after ${car.t.toFixed(2)} s`);
    F.verdict(car.peak <= T.aim * 0.82 + 0.05 && car.peak > 4, 'its top rate is the weapon\'s', `peak ${deg(car.peak)}/s — the cap ${deg(T.aim * 0.82)}/s`);
    F.verdict(car.jerk <= T.aimAcc * 0.82 * 1.02 + 1, 'it gets up to speed (no frame gains more than the acceleration allows)', `fastest gain ${deg(car.jerk)}/s² — allowed ${deg(T.aimAcc * 0.82)}/s²`);
    F.verdict(car.past < 1e-4 && pis.past < 1e-4 && green.past < 1e-4, 'and stops on the point: never carried past it', `past the point: carbine ${deg(car.past)}, pistol ${deg(pis.past)}, untrained ${deg(green.past)}`);
    F.verdict(pis.t < car.t && car.t < rif.t, 'a pistol comes round quicker than a carbine, a carbine quicker than a full rifle', `90°: pistol ${pis.t.toFixed(2)} s · carbine ${car.t.toFixed(2)} s · rifle (0.7) ${rif.t.toFixed(2)} s`);
    F.verdict(green.t > car.t * 1.08, 'an untrained man is slower getting the same gun there', `90°: trained ${car.t.toFixed(2)} s · untrained ${green.t.toFixed(2)} s`);
    const piv = await swing(0.82, 1, Math.PI * 0.98, Math.PI * 0.98);
    F.verdict(piv.tb > 0.5 && piv.tb < 1.0 && piv.peakB <= T.body * (1 - T.bodyShare * 0.18) + 0.05, 'an about-face takes over half a second, at the body\'s own top rate', `176°: body on it after ${piv.tb.toFixed(2)} s, peak ${deg(piv.peakB)}/s (unweighed, bodies in whole play-throughs turned at a flat 290‥340°/s)`);
    { const ts: number[] = [], was = { ...T };   // the three named settings (TURN_FEEL; `?turn=light|medium|heavy`, `TPS_TURN=<name>`): each heavier than the last, and setTurn is the one way in
      for (const k of ['light', 'medium', 'heavy'] as const) { CH.setTurn(k); ts.push((await swing(0.8, 1, Q, 0)).t); }
      const named = CH.turnFeel(), own = (CH.setTurn('1,aim=9'), CH.turnFeel()), offW = (CH.setTurn('0'), CH.turnFeel()); Object.assign(T, was);
      F.verdict(ts[0] < ts[1] && ts[1] < ts[2] && named === 'heavy' && own === 'own numbers' && offW === 'off', 'light, medium, heavy: each named setting is slower than the last, and the switch says which one is live', `the team's rifle a quarter turn: ${ts.map(t => t.toFixed(2) + ' s').join(' · ')} · after 'heavy': ${named} · after '1,aim=9': ${own} · after '0': ${offW}`);
      const warn = console.warn; let said = 0; console.warn = () => { said++; }; let bad: boolean, badOn: number, typo: boolean, typoAim: number;
      try { bad = CH.setTurn('hevy', 0); badOn = T.on; Object.assign(T, was); typo = CH.setTurn('1,aimm=7'); typoAim = T.aim; } finally { console.warn = warn; Object.assign(T, was); }
      F.verdict(!bad && badOn === 0 && !typo && typoAim === was.aim && said === 2, 'a mistyped name or number is refused aloud, never quietly taken as another setting', `'hevy' → understood ${bad}, on ${badOn} · '1,aimm=7' → understood ${typo}, aim still ${typoAim} · warnings ${said}`); }
  } finally { restoreTurn(); restore(); }
  return F.done();
}
export async function turnEasing(): Promise<boolean> {
  const F = family('turn-easing: the AI\'s own easings still arrive (they run wish to wish), a point behind his back swings the gun across his front, a staging is taken as written');
  try {
    CH.TURN.on = 1; const { approachAngle } = await import(`${ROOT}/src/math/vec.ts`); const Q = Math.PI / 2;
    // (a) an easing at 8 rad/s (guards.ts PACE.turn) through turnBegin, as updateGuard runs it
    let c = await man(1); c.turn.on = true; c.turn.h = 0.82; c.turn.k = 1; c.bodyYaw = c.aimYaw = 0; c.update(DT); let t = NaN;
    for (let i = 0; i < 120; i++) { c.turnBegin(); c.aimYaw = approachAngle(c.aimYaw, Q, 8 * DT); c.update(DT); if (isNaN(t) && Math.abs(c.aimYaw - Q) < 3 / 57.2958) t = (i + 1) * DT; }
    F.verdict(t < 0.5, 'a muzzle eased at 8 rad/s by his AI is on a point 90° off inside half a second', `on it after ${t.toFixed(2)} s (the easing alone: 0.20 s)`);
    // (b) the same easing from OUTSIDE his update (no turnBegin): through wantBody it arrives as well
    c = await man(0.12); c.turn.on = true; c.turn.h = 0.82; c.turn.k = 0.12; c.bodyYaw = c.aimYaw = 0; c.update(DT); t = NaN;
    for (let i = 0; i < 180; i++) { c.bodyYaw = approachAngle(c.wantBody, Q, 3 * DT); c.aimYaw = c.bodyYaw; c.update(DT); if (isNaN(t) && Math.abs(c.bodyYaw - Q) < 3 / 57.2958) t = (i + 1) * DT; }
    F.verdict(t < 1.0, 'a defender\'s calm turn to a door (roomfight.ts applyWatch, 3 rad/s, eased outside his update) arrives in about its own time', `90° after ${t.toFixed(2)} s (the easing alone: 0.52 s)`);
    // (c) the point passes behind his back: the gun goes across his chest, in steps
    c = await man(1); c.turn.on = true; c.turn.h = 0.82; c.turn.k = 1; c.bodyYaw = 0; c.aimYaw = 1.4; for (let i = 0; i < 60; i++) { c.turnBegin(); c.bodyYaw = 0; c.aimYaw = 1.4; c.update(DT); }
    let worst = 0, crossedFront = false, r0 = wrapA(c.aimYaw - c.bodyYaw);
    for (let i = 0; i < 90; i++) { c.turnBegin(); c.bodyYaw = 0; c.aimYaw = -1.4; c.update(DT); const r = wrapA(c.aimYaw - c.bodyYaw); worst = Math.max(worst, Math.abs(r - r0)); if (Math.abs(r) < 0.2) crossedFront = true; r0 = r; }
    F.verdict(crossedFront && worst < CH.TURN.aim * DT + 1e-6 && Math.abs(r0 + 1.4) < 0.02, 'a point that jumps from one shoulder to the other is swung to across his front, a step at a time', `largest step ${deg(worst)} a frame, through his front: ${crossedFront}, ends ${deg(r0)} off his chest`);
    // (d) a staging: moved more than TURN.jump, or baked with dt 0 — the yaws as written
    c = await man(1); c.turn.on = true; c.bodyYaw = c.aimYaw = 0; c.update(DT); c.update(DT);
    c.pos = [3, 0, 0]; c.bodyYaw = c.aimYaw = 2; c.update(DT); const a1 = c.bodyYaw === 2 && c.aimYaw === 2;
    c.turnBegin(); c.bodyYaw = c.aimYaw = -1; c.update(0); const a2 = c.bodyYaw === -1 && c.aimYaw === -1;
    c.turnBegin(); c.update(DT); const a3 = c.bodyYaw === -1 && c.aimYaw === -1;
    F.verdict(a1 && a2 && a3, 'a man put somewhere else, or baked with dt 0, faces as he was written — and stays there', `after a 3 m move: ${a1} · after update(0): ${a2} · the frame after: ${a3}`);
    // (e) a RE-BAKE in place mid-swing (game.ts updateProps: update(0), yaws untouched): the turn carries on, the neck's lead does not pop
    c = await man(1); c.turn.on = true; c.turn.h = 0.82; c.turn.k = 1; c.bodyYaw = c.aimYaw = 0; c.update(DT);
    for (let i = 0; i < 6; i++) { c.turnBegin(); c.aimYaw = Q; c.update(DT); }
    const mid = c.aimYaw, lead = c.anim.turnLead; c.update(0); const kept = c.aimYaw === mid && c.anim.turnLead === lead && c.wantBody === 0;
    c.turnBegin(); const wish = c.aimYaw; c.update(DT); const step = wrapA(c.aimYaw - mid);
    F.verdict(kept && wish === Q && step > 0.05 && step < CH.TURN.aim * DT + 1e-6, 'a man re-baked where he stands in mid-swing carries his turn on: the wish still stands, the gun does not jump to it', `mid-swing ${deg(mid)} of 90°, lead ${deg(lead)}; after update(0): yaw and lead kept ${kept}, wish still ${deg(wish)}, next frame +${deg(step)}`);
    // (e2) the clock frozen (dt 0 through his whole update: turnBegin, then update(0)) — the same: nothing snaps; and a man whose weight is taken off mid-turn (grabbed) keeps facing where he had got to
    c.turnBegin(); c.update(0); const froze = Math.abs(wrapA(c.aimYaw - (mid + step))) < 1e-9 && c.wantBody === 0; c.turnBegin(); const wish2 = c.aimYaw; c.update(DT);
    const at = c.aimYaw; c.turn.on = false; c.turnBegin(); c.update(DT); const let_go = c.aimYaw === at; c.turn.on = true;
    F.verdict(froze && wish2 === Q && let_go, 'with the clock frozen nothing snaps either, and a man whose weight is taken off mid-turn (grabbed, a showcase) stays facing where he had got to', `dt 0 inside his update: kept ${froze}, wish still ${deg(wish2)} · weight off at ${deg(at)}: stays ${let_go}`);
    // (f) inside his AI update the fire gates ask gunYaw: where the gun IS, not where he wants it
    c = await man(1); c.turn.on = true; c.turn.h = 0.82; c.turn.k = 1; c.bodyYaw = c.aimYaw = 0; c.update(DT);
    c.turnBegin(); c.aimYaw = Q; c.update(DT); c.turnBegin(); const g1 = c.gunYaw, w1 = c.aimYaw; c.update(DT);
    for (let i = 0; i < 60; i++) { c.turnBegin(); c.aimYaw = Q; c.update(DT); } c.turnBegin(); const g2 = c.gunYaw; c.update(DT);
    CH.TURN.on = 0; const o = await man(1); o.turn.on = true; o.aimYaw = 1.23; o.update(DT); const g3 = o.gunYaw === 1.23; CH.TURN.on = 1;
    F.verdict(w1 === Q && g1 < 0.1 && Math.abs(g2 - Q) < 1e-6 && g3, 'inside his own update the gates read the gun, not the wish: a frame into a quarter turn it is still near where it was, and it ends on the point', `wish ${deg(w1)}, gun ${deg(g1)} a frame in · gun ${deg(g2)} once round · weight off: gunYaw is aimYaw ${g3}`);
  } finally { restoreTurn(); restore(); }
  return F.done();
}
export async function turnGame(): Promise<boolean> {
  const F = family('turn-game: a staged fight with the weight on — who is weighed and by what, nobody turns faster than his weapon lets him, every yaw finite');
  try {
    const { stage } = await import('./bang-tally.ts'); const { handlingOf } = await import(`${ROOT}/src/game/weapons.ts`);
    const S: any = await quiet(() => stage('night-breach', 2)); const { g, step } = S; CH.TURN.on = 1; step(5);
    const men = g.guards.filter((x: any) => x.state !== 'dead');
    F.verdict(men.length > 3 && men.every((x: any) => x.char.turn.on && x.char.turn.h === handlingOf(x.weapon.def)) && !g.player.char.turn.on, 'every man on the floor is weighed by the handling of what he carries; Sam is not',
      men.slice(0, 4).map((x: any) => `${x.callsign} ${x.weapon.def.short} ${x.char.turn.h}`).join(' · ') + ` · the player ${g.player.char.turn.on}`);
    const sam = g.player.char.pos; await quiet(() => g.orders.give('fallIn', g.orders.targetAt([sam[0], 0, sam[2]]), 'all'));
    const last = new Map<any, { a: number; b: number; x: number; z: number }>(); let top = 0, topB = 0, bad = '', who = '';
    for (let i = 0; i < 60 * 40 && !bad; i++) { step(1);
      for (const x of g.guards) { const c = x.char; if (x.state === 'dead' || !c.turn.on) { last.delete(x); continue; } if (!Number.isFinite(c.aimYaw + c.bodyYaw)) bad = x.callsign;
        const L = last.get(x); if (L && Math.hypot(c.pos[0] - L.x, c.pos[2] - L.z) < 0.5) { const wb = Math.abs(wrapA(c.bodyYaw - L.b)) / DT, wa = Math.abs(wrapA(c.aimYaw - L.a)) / DT - wb; if (wb > topB) topB = wb; if (wa > top) { top = wa; who = x.callsign; } }
        last.set(x, { a: c.aimYaw, b: c.bodyYaw, x: c.pos[0], z: c.pos[2] }); } }
    const T = CH.TURN;
    F.verdict(!bad && topB <= T.body + 0.05 && top <= T.aim + 0.05, 'forty seconds of the night breach: no body over the body\'s top rate, no muzzle over the weapon\'s on top of it, every yaw finite',
      bad ? `not finite: ${bad}` : `fastest body ${deg(topB)}/s (cap ${deg(T.body)}) · fastest muzzle over its body ${deg(top)}/s (${who}; cap ${deg(T.aim)})`);
  } finally { restoreTurn(); restore(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the snap shot (MOVES.snap) ─────────────────────────────────────────────────────────────
// A pistol fired from the relaxed carry. The carry and the two-hand aim eased on two clocks, so between them the base clip's hanging arm came through: the wrist
// went 10 cm on the fire frame and dipped a hand's length on the way back; and the shot clip, keyed level, took a pitched aim's hands up to level for the shot.
// On: the two layers trade (the bare arm's share stays small both ways), the aim comes in from rest, the recoil is laid on the pitched pose. What the game reads
// off the shot is the same: the round's own frame and the bore (Character.gunDir = aimDir()).
export async function movesSnap(): Promise<boolean> {
  const F = family('moves-snap: a pistol fired from the carry — the hand eases up, the bare arm never shows between carry and aim, a pitched shot keeps its pitch');
  try {
    CH.MOVES.on = 1;
    type Upper = 'relaxed' | 'aim' | 'torch';
    const pistol = async (pitch: number, upper: Upper) => {
      gltf ??= await loadCharacter(); const c: any = new CH.Character(gltf, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 });
      c.anim.phase = 0; c.anim.longGun = false; c.muzzleAhead = 0.2; c.anim.upper = upper; c.aimPitch = pitch; for (let i = 0; i < 150; i++) c.update(DT); return c;
    };
    /** `n` frames of one man, `drive(c, f)` before each: the wrist's travel each frame, its height, how far it is from where it began, the bare arm's share under
     *  the three layers, and EVERY frame's whole pose (bits: all the bones, the bore and the muzzle hashed frame by frame) */
    const take = async (snapOn: number, pitch: number, upper: Upper, n: number, drive: (c: any, f: number) => void) => {
      CH.MOVES.snap = BREAK ? 0 : snapOn; const c = await pistol(pitch, upper); const y0 = c.bones.handR[1], h0 = [...c.bones.handR] as V3; let prev = h0;
      const d: number[] = [], y: number[] = [], bare: number[] = [], off: number[] = [], bits: string[] = [];
      for (let f = 0; f < n; f++) { drive(c, f); c.update(DT); const h = [...c.bones.handR] as V3; d.push(dist(h, prev)); prev = h; y.push(h[1]); off.push(dist(h, h0));
        const u = c.anim.upperW; bare.push((1 - u.relaxed) * (1 - u.aim) * (1 - u.torch)); bits.push(`${poseBits(c)} ${c.gunDir.join(',')} ${c.muzzle.join(',')} ${c.anim.shooting}`); }
      return { d, y, y0, bare, off, bits };
    };
    const shot = (snapOn: number, pitch: number, upper: Upper, n = 110) => take(snapOn, pitch, upper, n, (c, f) => { if (f === 0) c.anim.fire(); });
    const same = (a: { bits: string[] }, b: { bits: string[] }) => a.bits.length === b.bits.length && a.bits.every((v, i) => v === b.bits[i]);
    const max = (a: number[]) => Math.max(...a), min = (a: number[]) => Math.min(...a);
    // level, from the carry
    { const was = await shot(0, 0, 'relaxed'), now = await shot(1, 0, 'relaxed');
      F.verdict(now.d[0] < 0.015 && was.d[0] > 0.06, 'the fire frame: the wrist eases off the carry instead of jumping', `wrist travel on the frame the round leaves ${cm(now.d[0])} (snap off: ${cm(was.d[0])}) — want < 1.5, and > 6 with it off`);
      F.verdict(max(now.d) < 0.03 && max(was.d) > 0.08, 'no frame of the shot, up or back down, throws the hand', `worst frame over the whole shot ${cm(max(now.d))} (off: ${cm(max(was.d))}) — want < 3`);
      F.verdict(max(now.bare) < 0.08 && max(was.bare) > 0.25, 'the carry and the aim trade: the base clip\'s hanging arm stays out from under them', `the bare arm's share at worst ${max(now.bare).toFixed(3)} (off: ${max(was.bare).toFixed(3)}) — want < 0.08`);
      const low = Math.min(now.y0, now.y[30]);   // (frame 30: the aim fully up, the shot still running)
      F.verdict(min(now.y) > low - 0.03 && min(was.y) < low - 0.1, 'so the hand goes from the carry to the aim and back, not down past both', `lowest ${cm(min(now.y))} against the lower of carry and aim ${cm(low)} (off: ${cm(min(was.y))})`);
      F.verdict(Math.abs(now.y[109] - was.y[109]) < 0.004, 'and he ends back at the same carry', `wrist height ${cm(now.y[109])} · ${cm(was.y[109])} 1.8 s after the round`); }
    // the aim raised and let go by hand (no round), from the pistol's carry and from the torch's
    { const by = (snapOn: number, from: Upper) => take(snapOn, 0, from, 120, (c, f) => { if (f === 0) c.anim.upper = 'aim'; if (f === 60) c.anim.upper = from; });
      const was = await by(0, 'relaxed'), now = await by(1, 'relaxed'), tWas = await by(0, 'torch'), tNow = await by(1, 'torch');
      F.verdict(max(now.d) < 0.03 && max(now.bare) < 0.08 && max(was.d) > 0.08, 'the same trade when he raises the aim himself and lets it go', `worst frame ${cm(max(now.d))} (off: ${cm(max(was.d))}) · bare arm's share ${max(now.bare).toFixed(3)} (off: ${max(was.bare).toFixed(3)})`);
      F.verdict(max(tNow.bare) < 0.08 && max(tWas.bare) > 0.25 && tNow.d[0] < tWas.d[0] * 0.6 && tNow.d[60] < tWas.d[60] * 0.6 && max(tNow.d) < max(tWas.d), 'and from the torch\'s carry: a long way for the gun hand (it hangs under a torch), begun from rest both ways and no frame of it worse than it was',
        `bare arm's share ${max(tNow.bare).toFixed(3)} (off: ${max(tWas.bare).toFixed(3)}) · first frame up ${cm(tNow.d[0])} (off: ${cm(tWas.d[0])}) · first frame back ${cm(tNow.d[60])} (off: ${cm(tWas.d[60])}) · worst frame ${cm(max(tNow.d))} (off: ${cm(max(tWas.d))})`); }
    // a pitched aim, already up: the recoil rides the pitch
    { const was = await shot(0, -0.7, 'aim', 60), now = await shot(1, -0.7, 'aim', 60); const kick = max(now.off.slice(0, 12));
      F.verdict(max(now.off) < 0.1 && max(was.off) > 0.25, 'aimed at his feet, a round no longer lifts the hands to the level pose', `the wrist gets ${cm(max(now.off))} from where it aimed (off: ${cm(max(was.off))}) — want < 10`);
      F.verdict(kick > 0.015, 'and the gun still kicks', `recoil travel ${cm(kick)} — want > 1.5`);
      const lv0 = await shot(0, 0, 'aim', 60), lv1 = await shot(1, 0, 'aim', 60);
      F.verdict(same(lv0, lv1), 'a level aimed shot is the clip as it always was, to the bit', `every bone, the bore and the muzzle on each of 60 frames ${same(lv0, lv1) ? 'identical' : 'DIFFER'}`); }
    // pitched, from the carry
    { const was = await shot(0, -0.7, 'relaxed'), now = await shot(1, -0.7, 'relaxed');
      F.verdict(max(now.d) < max(was.d) * 0.65 && now.d[0] < was.d[0] * 0.5, 'a snap shot at his feet: a long way for the hand, taken over frames', `fire frame ${cm(now.d[0])} (off: ${cm(was.d[0])}) · worst frame ${cm(max(now.d))} (off: ${cm(max(was.d))})`); }
    // the master switch: with the pass off the part does nothing
    { CH.MOVES.on = 0; const a = await shot(0, -0.4, 'relaxed'), b = await shot(1, -0.4, 'relaxed'); CH.MOVES.on = 1;
      F.verdict(BREAK || same(a, b), 'MOVES off: the animator as it was, whatever the part says', `every bone, the bore and the muzzle on each of 110 frames ${same(a, b) ? 'identical' : 'DIFFER'}`); }
    // in the game: the rounds themselves. One from the carry, one a second later with the aim up, at a far mark and at the floor by his feet — where each left
    // from and where it went, with the part off and on (a round leaves from the muzzle as it stood BEFORE that frame's pose: from rest, the same floats)
    { const { standUp } = await import('./headless.ts');
      const rounds = async (snapOn: number) => quiet(async () => {
        const W: any = await standUp({ seed: 5 }); CH.MOVES.on = 1; CH.MOVES.snap = snapOn; const g = W.game, c = g.player.char; g.infiniteAmmo = true;
        for (const gd of g.guards) { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + gd.char.id * 1.2]; gd.char.update(0); }
        W.input.pressed.add('KeyE'); for (let i = 0; i < 90; i++) W.step(DT);
        const out: number[][] = []; let travel = 0;
        for (const cursor of [[10, 1.2, 45], [10, 0, 20.2]] as V3[]) {
          g.teleportPlayer([10, 0, 19]); c.bodyYaw = c.aimYaw = 0; for (let i = 0; i < 400; i++) { W.cursorAt(cursor); W.step(DT); }
          for (let k = 0; k < 120; k++) { W.cursorAt(cursor); const h0 = [...c.bones.handR] as V3; if (k === 0 || k === 60) W.input.clicked |= 1; W.step(DT);
            if (k === 0 && cursor[1] > 0) travel = dist(h0, c.bones.handR);
            if (k === 0 || k === 60) { const e = g.events.filter((x: any) => x.kind === 'shot').pop(); out.push(e?.from && e?.to ? [...e.from, ...e.to] : []); } }
        }
        // …and the rifle put away for the pistol with a round fired the moment the pistol will fire, at his feet: the long gun's share of the arms runs out
        // DURING that shot — it is posed one way from its fire frame to its end
        // (asked with the build's change of gun on the key's frame: a tree that has the kit-handling part carries the rifle away by hand for a second, the rifle's
        // share is long gone when the round leaves and this is then the snap shot from the carry the lines above already hold — so that part is put off for it)
        const KA = (await import(`${ROOT}/src/game/knobs.ts`)).knobRegistry().KITANIM as { on: boolean } | undefined, ka0 = KA?.on; if (KA) KA.on = false;
        const at: V3 = [10, 0, 20.2]; g.teleportPlayer([10, 0, 19]); c.bodyYaw = c.aimYaw = 0; for (let i = 0; i < 300; i++) { W.cursorAt(at); W.step(DT); }
        W.input.pressed.add('Digit2'); for (let i = 0; i < 150; i++) { W.cursorAt(at); W.step(DT); }
        W.input.pressed.add('Digit1'); const n0 = g.events.filter((x: any) => x.kind === 'shot').length; let fired = -1, swap = 0, pitch = NaN, prev = [...c.bones.handR] as V3;
        for (let k = 0; k < 140; k++) { W.cursorAt(at); if (fired < 0) W.input.clicked |= 1; W.step(DT); if (fired < 0 && g.events.filter((x: any) => x.kind === 'shot').length > n0) fired = k;
          const h = [...c.bones.handR] as V3; if (fired >= 0 && k > fired && k < fired + 45) swap = Math.max(swap, dist(h, prev)); if (k === fired) pitch = c.aimPitch; prev = h; }
        if (KA) KA.on = ka0!;
        return { out, travel, swap: fired >= 0 ? swap : NaN, fired, pitch };
      });
      const was = await rounds(0), now = await rounds(BREAK ? 0 : 1); const got = was.out.length === 4 && was.out.every(r => r.length === 6) && now.out.every(r => r.length === 6);
      const gap = (i: number) => got ? Math.max(...was.out[i].map((v, k) => Math.abs(v - now.out[i][k]))) : NaN;
      const rest = got && [0, 2].every(i => was.out[i].every((v, k) => v === now.out[i][k])), up = Math.max(gap(1), gap(3));
      F.verdict(got && rest && up < 1e-5 && now.travel < 0.02 && was.travel > 0.06, 'in the game the rounds are the same rounds: from the carry to the bit, with the aim up to a hundredth of a millimetre — far and at his feet',
        got ? `where each left from and where it went, the part off against on — from the carry: ${rest ? 'identical' : 'DIFFER'} · a second later with the aim up: within ${(up * 1e6).toFixed(2)} µm (the layers' weights end a hair apart; want < 10) · the wrist on the fire frame ${cm(now.travel)} (off: ${cm(was.travel)})` : 'a round was not fired');
      F.verdict(now.swap < was.swap + 0.02, 'a round fired as the rifle\'s share of the arms runs out is posed one way for its whole length', `rifle away, pistol up, fired at his feet at once (${now.fired} frames after the key, the aim pitched ${(now.pitch * 180 / Math.PI).toFixed(0)}° — 0° = this stand keeps a cursor on the floor's aim level, and the line is then about a level shot): the gun hand's worst frame through the shot ${cm(now.swap)} (off: ${cm(was.swap)}) — want no more than 2 over`); }
  } finally { restore(); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the crouch walk carried level (MOVES.steady) ─────────────────────────────────────────────────────────────
// The crouch cycle rocks the whole man over each foot in turn: the pelvis rolls 15°, the trunk tips 15° with it, the head goes 17 cm side to side and the feet land a
// third of a metre apart — at the player's 1.3 m/s nearly twice a second, which from the game's camera is a waddle. On, character.ts steadyLayer takes most of that
// swing out about the cycle's own mean and brings the feet and knees in under him. What it must not touch: how far and how often he steps, how high he rides, where
// the cycle carries him on average (the stances were posed on that), and any pose that is not the crouch walk.
export async function movesSteady(): Promise<boolean> {
  const F = family('moves-steady: the crouch walk carried level — the side-to-side rock most of the way out, the stride, the height and the mean carriage where they were');
  try {
    CH.MOVES.on = 1; gltf ??= await loadCharacter();
    type Kit = 'none' | 'relaxed' | 'pistol' | 'rifle';
    interface Ask { speed: number; crouch: number; kit: Kit; delib?: number; trained?: number; creep?: boolean; stack?: boolean; low?: boolean; loose?: boolean }
    const stand = (on: number, a: Ask) => { CH.MOVES.steady = on; const c: any = new CH.Character(gltf, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 });
      const an = c.anim; an.phase = 0; an.trained = a.trained ?? 1; an.crouchTarget = a.crouch; an.deliberate = a.delib ?? 0; an.upper = a.kit === 'none' ? 'none' : a.kit === 'relaxed' ? 'relaxed' : 'aim';
      if (a.kit === 'rifle') { an.longGun = true; an.longStance = a.stack || a.low ? 'lowLong' : 'shoulder'; an.longSteady = a.loose ? 0 : 1; if (a.low) an.upper = 'none'; } if (a.creep) an.creep = true; if (a.stack) { an.stance = 'stack'; an.stackSide = 1; an.upper = 'none'; } return c; };
    const pp = (v: number[]) => Math.max(...v) - Math.min(...v), mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
    /** two whole cycles of a steady gait after three seconds of it: what goes side to side, the base, the stride, and every frame's bones */
    const gait = (on: number, a: Ask) => { const c = stand(on, a), an = c.anim; an.speed = a.speed; const adv = () => { c.pos = [0, 0, c.pos[2] + a.speed * DT]; c.update(DT); };
      for (let i = 0; i < 180; i++) adv(); const rows: any[] = []; let prev = an.phase, wraps = 0, bits = '';
      for (let i = 0; i < 1200 && wraps < 3; i++) { adv(); if (an.phase - prev < -0.5) wraps++; prev = an.phase; if (wraps < 1 || wraps > 2) continue; const b = c.bones;
        rows.push({ gun: [...c.gunDir], hand: [...b.handR], hips: [...b.hips], neck: [...b.neck], head: [...b.head], aL: [...b.upperArmL], aR: [...b.upperArmR], tL: [...b.thighL], tR: [...b.thighR], kL: [...b.shinL], kR: [...b.shinR], fL: [b.footL[0], b.footL[1], b.footL[2] - c.pos[2]], fR: [b.footR[0], b.footR[1], b.footR[2] - c.pos[2]] });
        bits += JSON.stringify(b) + ';'; }
      const x = (k: string) => rows.map(q => q[k][0]); const plant = (k: string) => { const lo = Math.min(...rows.map(q => q[k][1])) + 0.015; return mean(rows.filter(q => q[k][1] < lo).map(q => q[k][0])); };
      const roll = rows.map(q => Math.atan2(q.tL[1] - q.tR[1], q.tL[0] - q.tR[0])), lean = rows.map(q => Math.atan2(q.neck[0] - q.hips[0], q.neck[1] - q.hips[1])), sh = rows.map(q => Math.atan2(q.aL[1] - q.aR[1], q.aL[0] - q.aR[0])), tilt = rows.map(q => Math.atan2(q.head[0] - q.neck[0], q.head[1] - q.neck[1]));
      return { rows, bits, tilt: pp(tilt), frames: rows.length, head: pp(x('head')), headAt: mean(x('head')), roll: pp(roll), rollAt: mean(roll), lean: pp(lean), leanAt: mean(lean), sh: pp(sh), shAt: mean(sh), hipsY: mean(rows.map(q => q.hips[1])), base: plant('fL') - plant('fR'),
        knees: Math.max(...rows.map(q => q.kL[0] - q.kR[0])), kneesMin: Math.min(...rows.map(q => q.kL[0] - q.kR[0])), feetMin: Math.min(...rows.map(q => q.fL[0] - q.fR[0])), kneeLow: Math.min(...rows.map(q => Math.min(q.kL[1], q.kR[1]))),
        finite: rows.every(q => Object.values(q).every((v: any) => v.every(Number.isFinite))) }; };
    const SNEAK: Ask = { speed: 1.3, crouch: 1, kit: 'rifle' };
    { const was = gait(0, SNEAK), now = gait(BREAK ? 0 : 1, SNEAK);
      F.verdict(was.head > 0.14 && was.roll > 0.2 && was.base > 0.29 && now.head < 0.09 && now.head < 0.5 * was.head && now.roll < 0.105 && now.lean < 0.105 && now.sh < 0.06 && now.base > 0.2 && now.base < 0.25 && now.knees < was.knees - 0.05,
        'the player sneaking with the rifle up (1.3 m/s): the head, the pelvis and the trunk stop rocking and the feet come in under him',
        `side to side over a cycle, as it was → carried level: head ${cm(was.head)} → ${cm(now.head)} · pelvis roll ${deg(was.roll)} → ${deg(now.roll)} · trunk lean ${deg(was.lean)} → ${deg(now.lean)} · shoulder line ${deg(was.sh)} → ${deg(now.sh)} · feet planted ${cm(was.base)} → ${cm(now.base)} apart · knees at their widest ${cm(was.knees)} → ${cm(now.knees)}`);
      let dy = 0, dz = 0, dh = 0; const n = Math.min(was.rows.length, now.rows.length);
      for (let i = 0; i < n; i++) for (const k of ['fL', 'fR']) { dy = Math.max(dy, Math.abs(was.rows[i][k][1] - now.rows[i][k][1])); dz = Math.max(dz, Math.abs(was.rows[i][k][2] - now.rows[i][k][2])); }
      for (let i = 0; i < n; i++) dh = Math.max(dh, Math.abs(was.rows[i].hips[1] - now.rows[i].hips[1]), Math.abs(was.rows[i].hips[2] - now.rows[i].hips[2]));
      F.verdict(was.frames === now.frames && dy < 0.002 && dz < 0.002 && dh < 1e-6, 'his steps are the same steps: the cycle as long, each ankle as high and as far fore and aft on every frame, the hips as high',
        `two cycles in ${was.frames} / ${now.frames} frames · an ankle off by at most ${(dy * 1000).toFixed(2)} mm in height, ${(dz * 1000).toFixed(2)} mm fore-aft · the hips by ${(dh * 1000).toFixed(3)} mm`);
      F.verdict(now.finite && now.feetMin > 0.1 && now.kneesMin > 0.1 && now.kneeLow > 0.06, 'nothing crosses and nothing digs in: the ankles and the knees stay each on its own side, the low knee stays off the floor',
        `ankles never nearer than ${cm(now.feetMin)}, knees ${cm(now.kneesMin)} · the lowest a knee joint comes ${cm(now.kneeLow)} (it was ${cm(was.kneeLow)}; the trousers there are about 5 cm deep)`); }
    { // where later layers sink the pelvis (the sneak near a threat, the close-in creep, a stance's squat) the rear knee is already at the floor: the part must not
      // take it lower — the narrowed base and the swung-in knees stand down there, the level pelvis stays
      const out: string[] = []; let ok = true;
      for (const [say, a] of [['the sneak near a threat', { speed: 1.3, crouch: 1, kit: 'none', delib: 1 }], ['the close-in creep', { speed: 1.0, crouch: 1, kit: 'none', creep: true }], ['the creep near a threat', { speed: 1.0, crouch: 1, kit: 'none', creep: true, delib: 1 }],
        ['the same, slower', { speed: 0.5, crouch: 1, kit: 'none', creep: true, delib: 1 }], ['half way to the threat', { speed: 1.3, crouch: 1, kit: 'none', delib: 0.5 }], ['stacked on a wall with the rifle', { speed: 1.0, crouch: 1, kit: 'rifle', stack: true }], ['stacked, near a threat', { speed: 1.0, crouch: 1, kit: 'rifle', stack: true, delib: 1 }]] as [string, Ask][]) {
        const was = gait(0, a), now = gait(1, a); const good = now.finite && now.kneeLow > was.kneeLow - (a.stack ? 0.008 : 0.002) && now.roll < 0.105 && now.head < 0.6 * was.head && was.frames === now.frames;
        ok &&= good; out.push(`${say}: the lowest a knee joint comes ${cm(was.kneeLow)} → ${cm(now.kneeLow)} · pelvis roll ${deg(was.roll)} → ${deg(now.roll)}, head ${cm(was.head)} → ${cm(now.head)}, base ${cm(was.base)} → ${cm(now.base)}${good ? '' : '  ← OUT'}`); }
      F.verdict(ok, 'sunk lower by the sneak, the creep or a stance: still level, and the rear knee no nearer the floor than it was', out.join('\n    ')); }
    { const out: string[] = []; let ok = true;
      for (const [say, a] of [['hands empty', { speed: 1.3, crouch: 1, kit: 'none' }], ['the pistol at the carry', { speed: 1.3, crouch: 1, kit: 'relaxed' }], ['the pistol up', { speed: 1.3, crouch: 1, kit: 'pistol' }], ['the rifle, at the clip\'s own pace', { speed: 0.72, crouch: 1, kit: 'rifle' }],
        ['the rifle, the deliberate sneak', { speed: 1.3, crouch: 1, kit: 'rifle', delib: 1 }], ['an untrained man', { speed: 1.0, crouch: 1, kit: 'rifle', trained: 0.12 }]] as [string, Ask][]) {
        const was = gait(0, a), now = gait(1, a); const good = now.head < 0.09 && now.roll < 0.105 && now.sh < 0.06 && (a.delib ? now.base < was.base + 0.005 : now.base < 0.25) && was.frames === now.frames && Math.abs(now.headAt - was.headAt) < 0.005 && Math.abs(now.rollAt - was.rollAt) < 0.005 && Math.abs(now.shAt - was.shAt) < 0.005;
        ok &&= good; out.push(`${say}: head ${cm(was.head)} → ${cm(now.head)}, roll ${deg(was.roll)} → ${deg(now.roll)}, shoulders ${deg(was.sh)} → ${deg(now.sh)}, base ${cm(was.base)} → ${cm(now.base)}, the head's mean place moved ${(Math.abs(now.headAt - was.headAt) * 1000).toFixed(1)} mm${good ? '' : '  ← OUT'}`); }
      F.verdict(ok, 'whatever he carries and however he paces it: level, and carried where the cycle carried him (its mean lean and dropped hip are a posture, kept)', out.join('\n    ')); }
    { // creeping, the crouch walk only half of the pose (the still crouch stands on a hip of its own): what is taken out is the cycle's swing, never the blend's posture
      const out: string[] = []; let ok = true;
      for (const kit of ['none', 'rifle'] as Kit[]) { const a: Ask = { speed: 0.2, crouch: 1, kit }, was = gait(0, a), now = gait(1, a);
        const d = Math.max(Math.abs(now.rollAt - was.rollAt), Math.abs(now.leanAt - was.leanAt), Math.abs(now.shAt - was.shAt)); const good = d < 0.005 && now.roll < 0.8 * was.roll && now.head < 0.85 * was.head && now.sh < Math.max(0.06, was.sh);
        ok &&= good; out.push(`${kit === 'none' ? 'hands empty' : 'the rifle up'} at 0.2 m/s: the mean pelvis roll ${deg(was.rollAt)} → ${deg(now.rollAt)}, mean lean ${deg(was.leanAt)} → ${deg(now.leanAt)}, mean shoulder line ${deg(was.shAt)} → ${deg(now.shAt)} · the rock: pelvis ${deg(was.roll)} → ${deg(now.roll)}, head ${cm(was.head)} → ${cm(now.head)}${good ? '' : '  ← OUT'}`); }
      F.verdict(ok, 'at a creep, half way between the still crouch and the walk: the same carriage, less rock', out.join('\n    ')); }
    { // the held gait (the close-in mode: the stride stands where he stopped), turned on the spot — the foot lock comes after this part, so it is never fought
      const sweep = (on: number, turn: number) => { const c = stand(on, { speed: 0, crouch: 1, kit: 'none' }), an = c.anim; an.creep = true; an.phase = 0.35;
        const step = (sp: number, dy = 0) => { an.speed = sp; c.bodyYaw += dy; c.aimYaw = c.bodyYaw; c.pos = [c.pos[0] + Math.sin(c.bodyYaw) * sp * DT, 0, c.pos[2] + Math.cos(c.bodyYaw) * sp * DT]; c.update(DT); };
        for (let i = 0; i < 90; i++) step(1.3); for (let i = 0; i < 60; i++) step(0); let path = 0, held = 0, prev = [[...c.bones.footL], [...c.bones.footR]], fin = true; const sw = [-1, -1];
        for (let i = 0; i < 90; i++) { step(0, i < 60 ? turn / 60 : 0); [c.bones.footL, c.bones.footR].forEach((q: number[], k: number) => { const d = Math.hypot(q[0] - prev[k][0], q[2] - prev[k][2]), s = an.feet[k ? 'R' : 'L'].swing; path += d; if (s < 0 && sw[k] < 0) held += d; sw[k] = s; prev[k] = [...q]; fin &&= q.every(Number.isFinite); }); }
        return { path, held, fin }; };
      const out: string[] = []; let ok = true;
      for (const t of [0.5, 1, 2]) { const was = sweep(0, t), now = sweep(1, t); const good = now.fin && now.path < was.path + 0.005 && now.held < was.held + 0.0005; ok &&= good; out.push(`turned ${deg(t)} in a second: both soles travel ${cm(was.path)} → ${cm(now.path)} over the floor, of it while planted ${(was.held * 1000).toFixed(1)} mm → ${(now.held * 1000).toFixed(1)} mm${good ? '' : '  ← OUT'}`); }
      F.verdict(ok, 'stopped mid-stride and turned on the spot: his feet travel no further over the floor than they did, and a planted sole slides no more', out.join('\n    ')); }
    { // setting 2, the option: ridden higher. The sideways mend the same; the low knee off the floor; the price named — his head is higher
      const was = gait(0, SNEAK), one = gait(1, SNEAK), two = gait(2, SNEAK); let dy = 0, dz = 0; const n = Math.min(was.rows.length, two.rows.length);
      for (let i = 0; i < n; i++) for (const k of ['fL', 'fR']) { dy = Math.max(dy, Math.abs(was.rows[i][k][1] - two.rows[i][k][1])); dz = Math.max(dz, Math.abs(was.rows[i][k][2] - two.rows[i][k][2])); }
      const up = two.hipsY - one.hipsY, headUp = mean(two.rows.map((q: any) => q.head[1])) - mean(one.rows.map((q: any) => q.head[1]));
      const ride = (on: number) => { const c = stand(on, SNEAK), an = c.anim, ys: number[] = []; let sp = 0; for (let i = 0; i < 300; i++) { const want = Math.floor(i * DT / 0.7) % 2 ? 0 : 1.3; sp += Math.sign(want - sp) * Math.min(Math.abs(want - sp), 6 * DT); an.speed = sp; c.pos = [0, 0, c.pos[2] + sp * DT]; c.update(DT); ys.push(c.bones.hips[1]); } return ys; };
      const r1 = ride(1), r2 = ride(2); let jerk = 0; for (let i = 1; i < r1.length; i++) jerk = Math.max(jerk, Math.abs((r2[i] - r1[i]) - (r2[i - 1] - r1[i - 1])));
      F.verdict(jerk < 0.012 && Math.abs(one.hipsY - was.hipsY) < 1e-6 && up > 0.03 && up < CH.MV.steady.rise + 1e-6 && two.kneeLow > 0.12 && dy < 0.002 && dz < 0.002 && two.frames === was.frames && two.finite && two.head < 0.09 && two.roll < 0.105 && Math.abs(two.base - one.base) < 0.005,
        'setting 2 (not the default): the same steps ridden higher — the rear knee no longer comes down to a hand off the floor; the default leaves his height alone',
        `the hips' mean height ${cm(was.hipsY)} → ${cm(one.hipsY)} (the default) → ${cm(two.hipsY)} (setting 2) · the lowest a knee joint comes ${cm(was.kneeLow)} → ${cm(one.kneeLow)} → ${cm(two.kneeLow)} · the head ${cm(headUp)} higher at setting 2 (what the eyes that look for him read) · ankles off by ${(dy * 1000).toFixed(2)} mm in height, ${(dz * 1000).toFixed(2)} mm fore-aft · setting off and stopping, the ride comes and goes by at most ${(jerk * 1000).toFixed(1)} mm a frame`); }
    { // THE SPRINT WITH THE RIFLE (the maintainer: "sprint animation still has some waddling"). A figure that steadies its long gun has the run clip's shoulder twist taken
      // back out down the spine; about the model's upright that left the forward-pitched trunk rolling ±11° and the head 17 cm across at three steps a second. On, the
      // twist is taken out about the trunk's own line: the trunk rides as level as the hands-empty sprint's, the legs and the gun are where they were
      const out: string[] = []; let ok = true; const RIFLE: Ask = { speed: 4.7, crouch: 0, kit: 'rifle', low: true }, empty = gait(1, { speed: 4.7, crouch: 0, kit: 'none' });
      for (const [say, a, share] of [['the sprint (4.7 m/s)', RIFLE, 1], ['part way up to it (3.3 m/s, the sprint 30 % of the pose)', { ...RIFLE, speed: 3.3 }, 0.3]] as [string, Ask, number][]) {
        const was = gait(0, a), now = gait(BREAK ? 0 : 1, a), n = Math.min(was.rows.length, now.rows.length); let legs = 0, hand = 0, bore = 0;
        for (let i = 0; i < n; i++) { for (const k of ['hips', 'tL', 'tR', 'kL', 'kR', 'fL', 'fR']) for (let j = 0; j < 3; j++) legs = Math.max(legs, Math.abs(was.rows[i][k][j] - now.rows[i][k][j]));
          for (let j = 0; j < 3; j++) { hand = Math.max(hand, Math.abs(was.rows[i].hand[j] - now.rows[i].hand[j])); bore = Math.max(bore, Math.abs(was.rows[i].gun[j] - now.rows[i].gun[j])); } }
        const twist = (g: any) => pp(g.rows.map((q: any) => Math.atan2(q.aL[2] - q.aR[2], q.aL[0] - q.aR[0])));
        // (the whole sprint: the roll is out, and the head sits on the neck as the hands-empty sprint carries it — without the twist handed back at the neck it counter-turns
        //  against a trunk that no longer turns, and tips twice as far; part way: by its share, never worse)
        const good = was.frames === now.frames && now.finite && twist(now) < 0.3 && legs < 1e-9 && hand < 0.04 && bore < 0.02 && (share === 1
          ? was.head > 0.14 && was.lean > 0.3 && now.head < 0.09 && now.head < 0.55 * was.head && now.lean < 0.09 && now.sh < 0.12 && now.tilt < empty.tilt + 0.06
          : now.head < was.head - 0.02 && now.lean < 0.85 * was.lean && now.sh < was.sh);
        ok &&= good; out.push(`${say}, side to side over a cycle, as it was → now: head ${cm(was.head)} → ${cm(now.head)} · trunk lean ${deg(was.lean)} → ${deg(now.lean)} · shoulder line roll ${deg(was.sh)} → ${deg(now.sh)}, twist ${deg(twist(was))} → ${deg(twist(now))} (the gun hangs from it: want it held) · the head tipped on the neck ${deg(was.tilt)} → ${deg(now.tilt)} · hips, knees and ankles off by ${(legs * 1000).toFixed(3)} mm · the trigger wrist by at most ${cm(hand)}, the bore by ${(bore * 57.3).toFixed(2)}°${good ? '' : '  ← OUT'}`); }
      F.verdict(ok && empty.lean < 0.12, 'the sprint with the rifle in both hands: the trunk and the head stop rolling from side to side, the shoulders stay on the gun, the legs and the gun are where they were',
        out.join('\n    ') + `\n    for scale, the sprint with nothing in the hands (not touched): head ${cm(empty.head)}, trunk lean ${deg(empty.lean)}, the head tipped on the neck ${deg(empty.tilt)}`);
      // a key of its own under the part's (an older recording's MOVES row has `steady` and no `steadyRun`: journal.ts replays it with this 0), and only ever the sprint's share:
      // every teammate steadies the same rifle and tops out under the jog's speed — his run must be the old hold to the bit
      CH.MOVES.steadyRun = 0; const keyOff = gait(1, RIFLE).bits; CH.MOVES.steadyRun = 1; const asWas = keyOff === gait(0, RIFLE).bits && (BREAK || keyOff !== gait(1, RIFLE).bits);
      const mates = [2.2, 2.7].every(sp => gait(0, { ...RIFLE, speed: sp }).bits === gait(1, { ...RIFLE, speed: sp }).bits) && gait(0, { speed: 2.2, crouch: 0, kit: 'rifle' }).bits === gait(1, { speed: 2.2, crouch: 0, kit: 'rifle' }).bits;
      F.verdict(asWas && mates, 'only the sprint: a teammate running with the same steadied rifle is the same to the bit, and with the sprint\'s own key off so is the sprint',
        `every bone on every frame — MOVES.steadyRun 0 against the part off, sprinting with the rifle: ${asWas ? 'identical' : 'DIFFERS'} · a man who steadies his rifle at a teammate's top pace (2.2 m/s) and at the jog's own (2.7), low carry and at the shoulder, the part off against on: ${mates ? 'identical' : 'DIFFERS'}`); }
    { const same = (a: Ask) => gait(0, a).bits === gait(1, a).bits; const hold = (on: number, kit: Kit) => { const c = stand(on, { speed: 0, crouch: 1, kit }); let b = ''; for (let i = 0; i < 300; i++) { c.anim.speed = 0; c.update(DT); b += JSON.stringify(c.bones) + ';'; } return b; };   // (gait() collects whole cycles: a man standing still turns none)
      const still = (['none', 'relaxed', 'rifle'] as Kit[]).every(k => hold(0, k) === hold(1, k) && hold(0, k) === hold(2, k)), walk = same({ speed: 1.55, crouch: 0, kit: 'rifle' }), run = same({ speed: 3.4, crouch: 0, kit: 'relaxed' }) && same({ speed: 4.7, crouch: 0, kit: 'none' }) && same({ speed: 2.2, crouch: 0, kit: 'rifle', low: true, loose: true });
      CH.MOVES.on = 0; const off = same(SNEAK); CH.MOVES.on = 1;
      F.verdict(still && walk && run && off, 'only the crouch walk and the steadied rifle\'s sprint: a crouched stand, the upright walk, the run and sprint with no long gun and an unsteadied rifle\'s jog are the same to the bit, and so is the crouch walk with MOVES off',
        `every bone on every frame, the part off against on — crouched and still ${still ? 'identical' : 'DIFFERS'} · walking ${walk ? 'identical' : 'DIFFERS'} · running (pistol at 3.4, hands empty at 4.7, a man who does not steady his rifle at all, at 2.2) ${run ? 'identical' : 'DIFFERS'} · MOVES off, sneaking ${off ? 'identical' : 'DIFFERS'}`); }
    { // away at the sneak, a stop, a creep, a stop, away again and up out of the crouch mid-walk, a last stop: finite throughout, and at each stand his feet are where the
      // part-off run plants them (the rest of him the same but for the rifle hands' springs still settling from another road in — millimetres, gone by the last)
      const take = (on: number) => { const c = stand(on, SNEAK), an = c.anim; let sp = 0, fin = true, slide = 0; let pf: number[] | null = null; const rest: any[] = [];
        for (let i = 0; i < 60 * 12; i++) { const t = i * DT; const want = t > 1 && t < 3 ? 1.3 : t > 4 && t < 5 ? 0.4 : t > 6 && t < 9 ? 1.3 : 0; sp += Math.sign(want - sp) * Math.min(Math.abs(want - sp), 6 * DT); if (t > 7) an.crouchTarget = 0;
          an.speed = sp; c.pos = [0, 0, c.pos[2] + sp * DT]; c.update(DT); const b = c.bones; fin &&= Object.values(b).every((v: any) => v.every(Number.isFinite));
          const f = [b.footL[0], b.footR[0]]; if (pf) slide = Math.max(slide, Math.abs(f[0] - pf[0]), Math.abs(f[1] - pf[1])); pf = f;
          if (i === 60 * 4 - 1 || i === 60 * 6 - 1 || i === 60 * 12 - 1) rest.push(JSON.parse(JSON.stringify(b))); }
        return { fin, rest, slide }; };
      const was = take(0), now = take(1); let feet = 0, body = 0, last = 0;
      for (let k = 0; k < 3; k++) for (const nm of Object.keys(was.rest[k])) { const d = dist(was.rest[k][nm], now.rest[k][nm]); if (nm === 'footL' || nm === 'footR') feet = Math.max(feet, d); body = Math.max(body, d); if (k === 2) last = Math.max(last, d); }
      F.verdict(now.fin && feet < 0.001 && body < 0.02 && last < 0.001 && now.slide < was.slide + 0.005, 'setting off, stopping, creeping, standing up out of it: every bone finite, and whenever he stands still he stands as he did',
        `against the part off, a second after each stop: the ankles within ${(feet * 1000).toFixed(2)} mm, every other bone within ${cm(body)} (the rifle hands still settling), upright three seconds on within ${(last * 1000).toFixed(2)} mm · the most an ankle moves sideways in one frame ${cm(now.slide)} (it was ${cm(was.slide)})`); }
  } finally { restore(); }
  return F.done();
}
