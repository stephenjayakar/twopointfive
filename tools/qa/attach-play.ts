// WHAT A MAN HOLDS, MEASURED AGAINST HIS HANDS IN REAL PLAY — every frame of whole scripted missions, every living man the fog shows.
//
//   TPS_PROFILE=shipped bun run tools/qa/attach-play.ts [--runs name,name|all|list] [--seeds 1,2] [--out <dir>] [--every 1]
//       plays each run of RUNS below (an existing scripted player: lights-out-run, command-tally, playthrough, solo-night, soak) in a child process with THIS
//       file preloaded, which wraps Game.update and samples after every step; then merges what the children wrote and prints / writes the tables
//       (<dir>/attach-play.json, <dir>/report-tables.md; dir: ./attach-play-out unless given).
//   … --merge <dir>      the tables again from the JSON files a previous call left in <dir>
//
// THE MEASURE, per man per frame, in his hands' own frames (Character.handFrameR / handFrameL off the wrists as they are drawn):
//   the fist's HOLLOW = wrist + 9 cm along the fingers + 3 cm out of the palm;
//   R  = distance from the right hollow to the nearest of HIS boxes (combat.ts handProps, by Box.owner) that lies within 30 cm of that wrist — 0 = the hollow is on
//        or in a box; 30 = nothing of his within reach. Taken when the game's own rule says a thing is in that hand. Boxes he only WEARS are left out: the thigh
//        holster, the goggles, the knife's sheath, a rifle on its sling while something else is in the hands.
//   L  = the same for the left hand, taken when the animator has it on a thing: a long gun in the hands, the two-hand pistol aim, a reload (the magazine);
//   G  = where a gun is in the hand, the right hollow to the CENTRE of its pistol grip (2 cm or so when it is held; the grip is 9 cm long);
//   A  = the angle between Character.gunDir (the shot's line) and the right hand's fingers, where a gun is in the hand.
// CLASSED by who (Sam / teammate / hostile / civilian), what the rule says he holds, and the animator's state (upper, stance, the long gun's carriage, crouched,
// moving, and whatever one-shot is under way). 'aimRise' = the pistol's aim clip still blending in (the weight between 0 and 1).
// A BODY (dead, or Sam down) is a class of its own: nothing is asked of its hands; its name says how many boxes are still drawn on it, and R there is how
// far the nearest of them that is not worn lies from the right hollow (30 = 30 cm or more, no wrist limit).
// The big slot's tool is three states: bigOut (on its way off his back), big (in his fists — L is taken on it too), bigBack. 'toss' = the support hand's own
// throw (MOVES); 'armL' = that pass has the left arm for something else. The left hand is not asked while it has somewhere else to be.
//   ATTACH_WHY='<regexp over a class>' in front of one child run (see the driver's spawn below) prints, for the first frames a left hand leaves its thing, which of
//   the animator's plain fields changed since it was last on it.
// A measuring tool: nothing of the game is edited; the one thing written is the kit cards (ATTACH_KIT) before a mission is staged.
import { resolve } from 'node:path';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '../..');
type V3 = [number, number, number];
const DBIN = 0.005, DN = 61, ABIN = 1, AN = 181;   // 0.5 cm bins to 30 cm · 1 degree bins
interface Stat { n: number; sum: number; worst: number; hist: number[]; at: string }
interface Cls { n: number; R: Stat; L: Stat; A: Stat; G: Stat }
const stat = (bins: number): Stat => ({ n: 0, sum: 0, worst: -1, hist: new Array(bins).fill(0), at: '' });
const put = (s: Stat, v: number, bin: number, at: () => string) => { s.n++; s.sum += v; s.hist[Math.min(s.hist.length - 1, Math.floor(v / bin))]++; if (v > s.worst) { s.worst = v; s.at = at(); } };
const pct = (s: Stat, p: number, bin: number): number => { if (!s.n) return 0; let k = s.n * p, i = 0; for (; i < s.hist.length; i++) { k -= s.hist[i]; if (k <= 0) break; } return Math.min(s.worst, (i + 1) * bin); };

// ------------------------------------------------------------------------------------------------ the hook (preloaded into a scripted player's process)
if (process.env.ATTACH_HOOK) {
  await import(`${ROOT}/tools/qa/headless.ts`);
  const GM: any = await import(`${ROOT}/src/game/game.ts`), CB: any = await import(`${ROOT}/src/game/combat.ts`), RP: any = await import(`${ROOT}/src/game/rigProps.ts`);
  const GD: any = await import(`${ROOT}/src/game/guards.ts`), HW: any = await import(`${ROOT}/src/game/handwork.ts`), BK: any = await import(`${ROOT}/src/game/bigkit.ts`);
  const KT: any = await import(`${ROOT}/src/game/kit.ts`), CA: any = await import(`${ROOT}/src/game/cast.ts`), CV: any = await import(`${ROOT}/src/game/civilians.ts`);
  // the cards: ATTACH_KIT='1:pistol:sup;2:pistol;3:shotgun;4:rifle:hammer' (member : weapon : words — sup / loud, hammer / shotgun in the big slot)
  for (const row of (process.env.ATTACH_KIT ?? '').split(';').filter(Boolean)) { const [i, w, ...ws] = row.split(':'); const m = KT.KIT.members[+i]; if (!m) continue;
    m.weapon = w; if (ws.includes('sup')) m.suppressed = true; if (ws.includes('loud')) m.suppressed = false; if (ws.includes('hammer')) m.big = 'hammer'; if (ws.includes('shotgun')) m.big = 'shotgun'; }
  const run = process.env.ATTACH_RUN ?? 'run', every = Math.max(1, Number(process.env.ATTACH_EVERY ?? 1));
  const classes = new Map<string, Cls>(), variants = new Map<string, Cls>();
  const cls = (m: Map<string, Cls>, k: string): Cls => { let c = m.get(k); if (!c) m.set(k, c = { n: 0, R: stat(DN), L: stat(DN), A: stat(AN), G: stat(DN) }); return c; };
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
  const unrot = (q: number[], v: V3): V3 => { const qx = -q[0], qy = -q[1], qz = -q[2], qw = q[3]; const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]); return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]; };
  /** distance from a point to a box (0 inside) */
  const boxDist = (b: any, p: V3): number => { const q = b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)], l = unrot(q, sub(p, b.c)); return Math.hypot(Math.max(0, Math.abs(l[0]) - b.h[0]), Math.max(0, Math.abs(l[1]) - b.h[1]), Math.max(0, Math.abs(l[2]) - b.h[2])); };
  const near = (a: V3, b: V3, e = 1e-4) => Math.abs(a[0] - b[0]) < e && Math.abs(a[1] - b[1]) < e && Math.abs(a[2] - b[2]) < e;
  const hollow = (w: V3, f: { fingers: V3; back: V3 }): V3 => [w[0] + f.fingers[0] * 0.09 - f.back[0] * 0.03, w[1] + f.fingers[1] * 0.09 - f.back[1] * 0.03, w[2] + f.fingers[2] * 0.09 - f.back[2] * 0.03];
  /** nearest of `boxes` to the hollow among those within 30 cm of the wrist: metres, 0.30 when none is */
  const reach = (boxes: any[], wrist: V3, hol: V3): number => { let d = 0.3; for (const b of boxes) { if (boxDist(b, wrist) > 0.3) continue; const x = boxDist(b, hol); if (x < d) d = x; } return d; };
  let frame = 0, t0 = -1; const bodies = new Set<number>(), bodyAt = new Map<number, number>();

  function man(g: any, c: any, who: string, holds: string, long: boolean, pistol: boolean, mine: any[], rec: any | null) {
    const a = c.anim, b = c.bones; if (!b?.handR || !b.handL) return;
    const at_ = (node: number): V3 => { const w = c.world, p = c.skel.nodePos(node); return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
    const wR = c.ragdoll ? b.handR : at_(a.nodes.handR), wL = c.ragdoll ? b.handL : at_(a.nodes.handL);   // (the wrists where the PICTURE has them: src/game/inhand.ts's look-only pass may have moved one off `bones`; a ragdoll's are its bones)
    const dead = holds === 'dead' || holds === 'down'; if (dead) holds = `${holds}, ${mine.length} boxes drawn on him`;   // (a body: nothing is asked of its hands — what is still drawn on it is said)
    // what he only wears: the thigh holster (both part sets), the goggles and whatever sits on the skull, the sheath, a rifle on its sling when the rule has something else in the hands
    const worn: V3[] = []; { const tmp: any[] = []; try { RP.holsterBoxes(c, tmp, { slide: RP.RIG.guardPistol.slide, grip: RP.RIG.guardPistol.grip }); RP.holsterBoxes(c, tmp, { slide: RP.RIG.pistol.slide, grip: RP.RIG.pistol.grip, suppressor: RP.RIG.pistol.suppressor }); } catch { /* no legs yet */ } for (const x of tmp) worn.push(x.c); }
    const head: V3 = b.head; const held = mine.filter(x => !worn.some(w => near(w, x.c)) && !(dead ? len(sub(x.c, head)) < 0.3 : len(sub(x.c, head)) < 0.26 && x.c[1] > head[1] + 0.02) && x.name !== RP.SHEATH_TAG && !(x.name === RP.SC20K_TAG && !long && !dead));
    if (dead && process.env.ATTACH_BODY && !bodies.has(c.id) && g.time - (bodyAt.get(c.id) ?? (bodyAt.set(c.id, g.time), g.time)) > 2) { bodies.add(c.id);   // (ATTACH_BODY=1: once per body, two seconds after it fell — every box still drawn on it)
      console.error(`@@BODY ${who} ${rec?.callsign ?? rec?.name ?? ''} (id ${c.id}) ${holds} · dropped: ${rec?.dropped?.kind ?? '-'} · ` + mine.map(x => `${x.name ?? 'box'} ${x.h.map((v: number) => (v * 200).toFixed(1)).join('x')} cm, ${(len(sub(x.c, head)) * 100).toFixed(0)} from the head, ${(len(sub(x.c, b.handR)) * 100).toFixed(0)} from the right wrist${held.includes(x) ? '' : ' (worn)'}`).join(' | ')); }
    const one: string[] = [];
    if (a.reloading) one.push('reload'); if (a.inThrow) one.push('throw'); if (a.mvs?.tsT >= 0) one.push('toss'); else if (a.mvs?.armL > 0.003 && !a.dazzle) one.push('armL');   // (MOVES: the support hand's own toss of a can · anything else that pass has the left arm for)
     if (a.sw?.t >= 0) one.push('swap'); if (a.kitBusy) one.push('kit'); if (a.nvBusy) one.push('nv');
    if (a.doorPush) one.push('door'); if (a.holdPose || rec?.held) one.push('hold'); if (a.haul) one.push('haul'); if (a.wound) one.push('wound'); if (a.sigT >= 0) one.push('signal');
    if (a.wk?.last || a.wk?.shown > 0.003) one.push('work'); if (a.rx?.w?.x > 0.003) one.push('radio'); if (a.lockpick) one.push('lock'); if (a.bigTool) { const B = a.bigTool; one.push(B.t < B.equip ? 'bigOut' : B.end >= 0 && B.t >= B.end ? 'bigBack' : 'big'); }   // (the big slot's tool: on its way off his back · in his fists · on its way back) if (a.shootT >= 0) one.push('shot');
    if (a.dazzle) one.push('dazzle'); if (a.clutch > 0.003) one.push('clutch'); if (a.strikeT >= 0) one.push('strike'); if (a.kickT >= 0) one.push('kick'); if (a.hitT >= 0) one.push('hit'); if (a.tellT >= 0) one.push('tell');
    if (pistol && a.upperW && a.upperW.aim > 0.003 && a.upperW.aim < 0.97) one.push('aimRise');
    if (c.ragdoll && !dead) one.push('ragdoll');
    const state = dead ? '-' : `${a.upper}/${a.stance}/${a.longShown ?? '-'} ${a.crouch > 0.5 ? 'crouched' : 'up'} ${a.speed > 0.25 ? 'moving' : 'still'}${one.length ? ' [' + one.join('+') + ']' : ''}`;
    const key = `${who} | ${holds} | ${state}`;
    const vr = CA.castVariantOf(g, c)?.name ?? 'mannequin';
    const C = cls(classes, key), V = cls(variants, `${who} | ${vr} | ${holds}${dead ? '' : a.crouch > 0.5 ? ' | crouched' : ' | up'}`); C.n++; V.n++;
    const at = () => `${run} t=${(g.time - t0).toFixed(2)}s ${rec?.callsign ?? rec?.name ?? who} (id ${c.id}, ${vr}) at (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)})`;
    const inR = holds !== 'nothing' && !holds.startsWith('nothing'), hfR = c.handFrameR(), hfL = c.handFrameL();
    if (inR && dead && held.length) { const hol = hollow(wR, hfR); let d = 0.3; for (const x of held) d = Math.min(d, boxDist(x, hol)); put(C.R, d, DBIN, at); put(V.R, d, DBIN, at); }   // (a body: how far the nearest thing still drawn on it and not worn is from the right hand — 30 = 30 cm or more)
    if (inR && !dead) { const hol = hollow(wR, hfR), d = reach(held, wR, hol); put(C.R, d, DBIN, at); put(V.R, d, DBIN, at);
      // G: where there is a gun, the hollow to the CENTRE of its pistol grip (the part told by its size: 2.6‥2.8 x 3.2‥3.4 x 9‥9.5 cm) — the hollow can lie inside a slide while the grip is beside the hand
      const grip = (long || pistol) ? held.find(x => x.h[0] > 0.0125 && x.h[0] < 0.0145 && x.h[1] > 0.0155 && x.h[1] < 0.0175 && x.h[2] > 0.044 && x.h[2] < 0.048) : null;
      if (grip) { const gd = Math.min(0.3, len(sub(grip.c, hol))); put(C.G, gd, DBIN, at); put(V.G, gd, DBIN, at); } }
    if (!dead && (long || pistol)) { const ang = Math.acos(Math.max(-1, Math.min(1, dot(c.gunDir, hfR.fingers)))) * 180 / Math.PI; put(C.A, ang, ABIN, at); put(V.A, ang, ABIN, at); }
    const twoHand = pistol && a.upper === 'aim';
    const leftAway = one.some(o => ['radio', 'signal', 'nv', 'clutch', 'dazzle', 'door', 'work', 'hold', 'haul', 'lock', 'throw', 'strike', 'kick', 'wound', 'ragdoll', 'tell', 'toss', 'armL'].includes(o));   // (the left hand has somewhere else to be: not asked)
    if (!dead && !leftAway && (long || twoHand || a.reloading || (holds.startsWith('big:') && one.includes('big')))) { const d = reach(held, wL, hollow(wL, hfL)); put(C.L, d, DBIN, at); put(V.L, d, DBIN, at); why(c, a, key, d, at); }
  }

  // ATTACH_WHY=<regexp over the class key>: the first frames a man's left hand leaves the thing (over 8 cm, after a frame on it), with what changed in his
  // animator's own plain fields between the two — the layer that took the hand names itself there. At most 16 lines, on stderr.
  const whyRe = process.env.ATTACH_WHY ? new RegExp(process.env.ATTACH_WHY) : null; const okSnap = new Map<number, Record<string, unknown>>(); let whys = 0;
  const word = (v: any): unknown => v === null ? 'null' : typeof v === 'number' ? Math.round(v * 20) / 20 : typeof v === 'boolean' || typeof v === 'string' ? v : typeof v === 'object' ? 'set' : typeof v;
  const snap = (a: any): Record<string, unknown> => { const o: Record<string, unknown> = {}; for (const k of Object.keys(a)) { const v = a[k]; o[k] = word(v);
    if (v && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v) && Object.getPrototypeOf(v) === Object.prototype) for (const k2 of Object.keys(v)) o[`${k}.${k2}`] = word(v[k2]); } return o; };   // (one level into his plain records: the layers keep their clocks there)
  function why(c: any, a: any, key: string, d: number, at: () => string) {
    if (!whyRe || !whyRe.test(key) || whys >= 16) return;
    if (d < 0.02) { okSnap.set(c.id, snap(a)); return; }
    const was = okSnap.get(c.id); if (d < 0.08 || !was) return; okSnap.delete(c.id);
    const now = snap(a), diff = Object.keys(now).filter(k => typeof now[k] === 'number' && typeof was[k] === 'number' ? Math.abs((now[k] as number) - (was[k] as number)) > 0.2 && k !== 'time' : now[k] !== was[k]).map(k => `${k}: ${was[k]} -> ${now[k]}`);
    whys++; console.error(`@@WHY ${key} · L ${(d * 100).toFixed(1)} cm · ${at()} · ${diff.join(', ') || 'nothing plain changed'}`);
  }

  function sample(g: any) {
    const pl = g.player; if (!pl?.char?.bones?.handR) return;
    if (t0 < 0) t0 = g.time; if (frame++ % every) return;
    const out: any[] = []; try { CB.handProps(g, out); CB.hiddenProps(g, out); } catch { return; }   // (the men the fog leaves out of the picture are measured too, classed apart: they are posed all the same)
    const by = new Map<number, any[]>(); for (const b of out) { const o = b.owner & 0xff; if (!o) continue; let l = by.get(o); if (!l) by.set(o, l = []); l.push(b); }
    const of = (c: any) => by.get(c.id & 0xff) ?? [];
    { const c = pl.char, a = c.anim, busy = a.hideHeldItem, mine = of(c);   // Sam: the drawer's own rules, said short (combat.ts handPropsRaw)
      const knife = mine.some(x => x.name === RP.KNIFE_TAG), rifle = pl.hasRifle && pl.rifleUp && !busy && !pl.down, pistol = pl.pistolUp && !pl.down && !busy;
      const can = !pl.down && !busy && pl.canisterSel && !pl.holstered && !pl.dragging && !pl.sprinting && (a.inThrow || g.throwCount(pl.canisterSel) > 0);
      const holds = pl.down ? 'down' : a.bigTool && busy ? (a.bigK > 0.02 ? `big:${a.bigTool.kind}` : 'nothing (his hand on its way to or from the tool on his back)') : knife ? 'knife' : rifle ? 'rifle' : pistol ? 'pistol' : can ? `can` : 'nothing';
      man(g, c, 'Sam', holds, holds === 'rifle', holds === 'pistol', mine, null); }
    for (const gd of g.guards) {
      const c = gd.char, a = c.anim, who = (gd.team === 'operative' ? 'teammate' : gd.team === 'civilian' ? 'civilian' : 'hostile') + (g.fogOfWar.hidden(gd) ? ' (in the fog)' : ''), mine = of(c);
      let holds: string, long = false, pistol = false;
      if (gd.state === 'dead') holds = 'dead';
      else { const rk = GD.rigOf(gd), held = HW.swapHeld(gd, GD.inHand(gd)), big = BK.bigCarried(g, c);
        if (big && a.bigTool && a.hideHeldItem && a.bigK > 0.02) holds = `big:${a.bigTool.kind}`;
        else if (big && a.bigTool && a.hideHeldItem) holds = 'nothing (his hand on its way to or from the tool on his back)';
        else if (big === 'shotgun' && gd.slung?.out) { holds = 'shotgun (big slot, out)'; long = true; }
        else if (!held) holds = `nothing (${rk})`;
        else if (held === 'torch') holds = 'torch';
        else if (rk !== 'pistol') { holds = gd.weapon.def.cls === 'shotgun' ? `shotgun (${rk} rig)` : rk === 'sc20k' ? 'rifle' : 'carbine'; long = true; }
        else { holds = KT.kitPistol(gd) && gd.weapon.def.rig === 'pistol' ? 'pistol' : 'guardPistol'; pistol = true; } }
      man(g, c, who, holds, long, pistol, mine, gd);
    }
    for (const cv of CV.civiliansShown(g)) { if (g.guards.includes(cv)) continue; const c = cv.char, a = c.anim;
      man(g, c, 'civilian', cv.civ?.state === 'dead' || cv.state === 'dead' ? 'dead' : a.bound === 1 ? 'tied wrists' : 'nothing', false, false, of(c), cv); }
  }
  const upd = GM.Game.prototype.update;
  GM.Game.prototype.update = function (this: any, ...args: any[]) { const r = upd.apply(this, args); try { sample(this); } catch (e) { if (!(globalThis as any).__attachErr) { (globalThis as any).__attachErr = 1; console.error('attach-play: sample failed', e); } } return r; };
  process.on('exit', () => { if (!process.env.ATTACH_OUT) return; writeFileSync(process.env.ATTACH_OUT, JSON.stringify({ run, frames: frame, classes: [...classes], variants: [...variants] })); });
}

// ------------------------------------------------------------------------------------------------ the driver
/** the runs: an existing scripted player each, one in-process run of it. {seed} = the seed. `kit` = ATTACH_KIT for that run. */
export const RUNS: { name: string; say: string; cmd: string[]; kit?: string; env?: Record<string, string> }[] = [
  { name: 'lights-pair-pistol', say: 'lights-out as two, the partner with the suppressed pistol (the plan built for the pair)', cmd: ['tools/qa/lights-out-run.ts', '--one', '--plan', 'pair', '--seed', '{seed}'], kit: '1:pistol:sup' },
  { name: 'lights-tail-pistol', say: 'lights-out as two, the partner with the suppressed pistol, never spoken to: he follows Sam all the way', cmd: ['tools/qa/lights-out-run.ts', '--one', '--plan', 'tail', '--seed', '{seed}'], kit: '1:pistol:sup' },
  { name: 'lights-tail-9mm', say: 'the same, the partner with the 9 mm (no can)', cmd: ['tools/qa/lights-out-run.ts', '--one', '--plan', 'tail', '--seed', '{seed}'], kit: '1:pistol:loud' },
  { name: 'lights-tail-rifle', say: 'the same, the partner with the rifle as issued', cmd: ['tools/qa/lights-out-run.ts', '--one', '--plan', 'tail', '--seed', '{seed}'] },
  { name: 'killhouse-b', say: 'the kill house, four teammates as issued (rifles), the B hand', cmd: ['tools/qa/command-tally.ts', '--trace', 'b:killhouse-four:{seed}', '--cap', '200'] },
  { name: 'killhouse-mixed', say: 'the kill house, the cards mixed: pistol + can, shotgun, rifle + hammer, 9 mm', cmd: ['tools/qa/command-tally.ts', '--trace', 'plan:killhouse-four:{seed}', '--cap', '200'], kit: '1:pistol:sup;2:shotgun;3:rifle:hammer;4:pistol:loud' },
  { name: 'compound-plan', say: 'the compound, four teammates, the plan hand; one man with the breaching shotgun in his big slot', cmd: ['tools/qa/command-tally.ts', '--trace', 'plan:compound-four:{seed}', '--cap', '240'], kit: '2:rifle:shotgun' },
  { name: 'compound-play', say: 'the compound played through on the floor with the order menu (playthrough.ts), a hammer on one man', cmd: ['tools/qa/playthrough.ts', '--trace', 'compound-four:{seed}', '--cap', '240'], kit: '1:rifle:hammer;3:pistol:sup' },
  { name: 'registry-rescue', say: 'the registry hostage rescue played through (hostages, a pair)', cmd: ['tools/qa/playthrough.ts', '--trace', 'rescue-registry:{seed}', '--cap', '240'] },
  { name: 'solo-walk', say: 'the solo night on the office, Sam walking upright: patrols with torches, then drawn', cmd: ['tools/qa/solo-night.ts', '--trace', '{seed}', '--plan', 'walk'] },
  { name: 'solo-sneak', say: 'the solo night, Sam sneaking', cmd: ['tools/qa/solo-night.ts', '--trace', '{seed}', '--plan', 'sneak'] },
  { name: 'soak', say: 'four minutes of the soak on the office: grabs, holds, takedowns, kicks, throws, the rifle, whistles, carbines on every guard', cmd: ['tools/qa/soak.ts', '--seeds', '{seed}', '--minutes', '4', '--quiet', '--carbines', 'reyes', '--rifle-per-min', '2'] },
];

if (import.meta.main && !process.env.ATTACH_HOOK) {
  const A = process.argv.slice(2), opt = (k: string, d = '') => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] ?? '' : d; };
  const outDir = resolve(opt('--merge') || opt('--out') || './attach-play-out'); mkdirSync(outDir, { recursive: true });
  if (opt('--runs') === 'list') { for (const r of RUNS) console.log(`${r.name.padEnd(20)} ${r.say}`); process.exit(0); }
  if (!A.includes('--merge')) {
    const names = (opt('--runs') || 'all') === 'all' ? RUNS.map(r => r.name) : opt('--runs').split(','), seeds = (opt('--seeds') || '1,2').split(',');
    const jobs = names.flatMap(n => seeds.map(s => ({ r: RUNS.find(x => x.name === n)!, s }))); if (jobs.some(j => !j.r)) { console.error('attach-play: no such run (--runs list)'); process.exit(2); }
    const worker = async () => { for (;;) { const j = jobs.shift(); if (!j) return; const tag = `${j.r.name}-s${j.s}`, t = Date.now();
      const pr = Bun.spawn(['bun', '--preload', import.meta.path, ...j.r.cmd.map(x => x.replace('{seed}', j.s))], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe',
        env: { ...process.env, TPS_PROFILE: process.env.TPS_PROFILE ?? 'shipped', ATTACH_HOOK: '1', ATTACH_RUN: tag, ATTACH_OUT: `${outDir}/run-${tag}.json`, ATTACH_KIT: j.r.kit ?? '', ATTACH_EVERY: opt('--every') || '1', ...(j.r.env ?? {}) } });
      const txt = await new Response(pr.stdout).text(), err = await new Response(pr.stderr).text(); const code = await pr.exited;
      writeFileSync(`${outDir}/run-${tag}.log`, txt + '\n---- stderr\n' + err);
      console.log(`${tag.padEnd(26)} exit ${code} · ${((Date.now() - t) / 1000).toFixed(0)} s wall · ${(txt.trim().split('\n').pop() ?? '').slice(0, 150)}`); } };
    await Promise.all(Array.from({ length: Math.max(1, Number(opt('--jobs') || 3)) }, worker));
  }
  // ---- merge
  const merged = new Map<string, Cls>(), mergedV = new Map<string, Cls>(); let frames = 0; const runsSeen: string[] = [];
  const add = (into: Stat, s: Stat) => { into.n += s.n; into.sum += s.sum; for (let i = 0; i < s.hist.length; i++) into.hist[i] += s.hist[i]; if (s.worst > into.worst) { into.worst = s.worst; into.at = s.at; } };
  for (const f of readdirSync(outDir).filter(f => /^run-.*\.json$/.test(f)).sort()) { const J = JSON.parse(readFileSync(`${outDir}/${f}`, 'utf8')); frames += J.frames; runsSeen.push(`${J.run} (${J.frames} frames)`);
    for (const [src, dst] of [[J.classes, merged], [J.variants, mergedV]] as [[string, Cls][], Map<string, Cls>][]) for (const [k, c] of src) { let m = dst.get(k); if (!m) dst.set(k, m = { n: 0, R: stat(DN), L: stat(DN), A: stat(AN), G: stat(DN) }); m.n += c.n; add(m.R, c.R); add(m.L, c.L); add(m.A, c.A); add(m.G, c.G); } }
  const cm = (x: number) => (x * 100).toFixed(1), row = (k: string, c: Cls) => { const d = (s: Stat) => s.n ? `${cm(s.sum / s.n)} / ${cm(pct(s, 0.95, DBIN))} / ${cm(s.worst)}` : '—';
    return `| ${k.replace(/\|/g, '·')} | ${c.n} | ${d(c.R)} | ${d(c.G)} | ${d(c.L)} | ${c.A.n ? `${(c.A.sum / c.A.n).toFixed(0)} / ${pct(c.A, 0.95, ABIN).toFixed(0)} / ${c.A.worst.toFixed(0)}` : '—'} |`; };
  const score = (c: Cls) => Math.max(c.R.n ? pct(c.R, 0.95, DBIN) : 0, c.G.n ? pct(c.G, 0.95, DBIN) : 0, c.L.n ? pct(c.L, 0.95, DBIN) : 0, c.A.n ? pct(c.A, 0.95, ABIN) / 12 * 0.025 : 0);
  const fine = (c: Cls) => (!c.R.n || pct(c.R, 0.95, DBIN) < 0.025) && (!c.G.n || pct(c.G, 0.95, DBIN) < 0.025) && (!c.L.n || pct(c.L, 0.95, DBIN) < 0.025) && (!c.A.n || pct(c.A, 0.95, ABIN) < 12);
  const all = [...merged].sort((a, b) => score(b[1]) - score(a[1])), bad = all.filter(([, c]) => !fine(c) && c.n >= 12), few = all.filter(([, c]) => !fine(c) && c.n < 12), ok = all.filter(([, c]) => fine(c));
  const head = '| class (who · holds · upper/stance/carriage, posture, [one-shots]) | frames | R hollow→thing cm: mean / p95 / worst | G hollow→grip centre cm | L cm: mean / p95 / worst | bore vs fingers deg: mean / p95 / worst |\n|---|---|---|---|---|---|';
  const L: string[] = [`${frames} frames sampled over ${runsSeen.length} runs: ${runsSeen.join(' · ')}`, '', '## Classes that are off (p95 of either hand 2.5 cm or more, or the bore 12 degrees or more off the fingers; 12 frames or more), worst first', '', head, ...bad.map(([k, c]) => row(k, c)),
    '', '## Where the worst frame of each is', '', ...bad.slice(0, 40).map(([k, c]) => `- **${k}** — R worst: ${c.R.at || '—'} · G worst: ${c.G.at || '—'} · L worst: ${c.L.at || '—'} · angle worst: ${c.A.at || '—'}`),
    '', '## Off, but seen for fewer than 12 frames', '', head, ...few.map(([k, c]) => row(k, c)),
    '', '## Fine (under 2.5 cm p95 and 12 degrees)', '', ok.map(([k, c]) => `${k.replace(/\|/g, '·')} (${c.n})`).join('; '),
    '', '## By cast variant (settled or not, all states together)', '', head.replace('class (who · holds · upper/stance/carriage, posture, [one-shots])', 'who · variant · holds · posture'), ...[...mergedV].sort((a, b) => a[0].localeCompare(b[0])).map(([k, c]) => row(k, c))];
  writeFileSync(`${outDir}/report-tables.md`, L.join('\n') + '\n'); writeFileSync(`${outDir}/attach-play.json`, JSON.stringify({ frames, runs: runsSeen, classes: [...merged], variants: [...mergedV] }));
  console.log(`\n${frames} frames · ${merged.size} classes · ${bad.length} off · ${ok.length} fine → ${outDir}/report-tables.md`);
  for (const [k, c] of bad.slice(0, 25)) console.log(row(k, c));
}
