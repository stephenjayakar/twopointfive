// The 'spotted' family (game/spotted.ts — what Sam's SILENT partner does once a defender is suspicious, and once the pair is caught). Headless: the whole
// Game over the fake device, the records office played as the pair (Sam + one teammate, squad=1), every defender but ONE taken off the floor and that one
// staged: rooted where he stands, his state written each frame. Sam cannot be hurt (god mode) and neither can the partner here: the family asks what the
// partner DOES, the tallies (pair-sneak.ts, spotted-tally.ts) ask what comes of it.
//
//   spotted-suspicious  a suspicious man with a line to the partner, the partner in the dark: switch off he stands and (the man's awareness over a half)
//                       shoots; switch on he kneels, stands still, holds his fire, says so once over the net, the HUD's word reads 'SILENT · low'; the man
//                       settles: he says so, gets up and follows again; Sam walks on past the leash while the man is still suspicious: he follows, low
//   spotted-slip        the same with the partner LIT in the man's line: he takes a spot out of the line (or in the dark) and gets low there
//   spotted-caught      the man goes alert with his eyes on Sam: the partner says so, the HUD reads 'SILENT · contact', he fires — sooner than switch off —
//                       and from behind cover, covering the opening he was dealt, his gun comes round and he fires (switch off: he never does)
//   spotted-fire        the fire rule by itself: suspicious = held (whatever the awareness); a quiet gun, a hostage's last warning and a floor gone loud
//                       hold nothing; an alert man facing away, far off and with no eyes on them is held on, and not once he turns, sees or is close
//   spotted-off         the switch off: nothing here acts and nothing is counted; the switch ON with nobody ever suspicious digests the same as off every
//                       frame (the calm half is not this module's)
// The cross-commit identity (switch off = the base build) is pair-sneak.ts's rows and digests, run here and in a checkout of the base: the same lines.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const SLM: any = await import(`${ROOT}/src/game/silent.ts`);
const SPM: any = await import(`${ROOT}/src/game/spotted.ts`);
const NQM: any = await import(`${ROOT}/src/game/netquiet.ts`);
const SILENT: any = SLM.SILENT, SPOTTED: any = SPM.SPOTTED;

const DT = 1 / 60, SCN = 'records-pair';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DEFAULTS = { SILENT: JSON.parse(JSON.stringify(SILENT)), SPOTTED: { ...SPM.SPOTTED_DEFAULTS } };
/** the stand's own word for the quiet-net rule (netquiet.ts), read once the first game stands and put back after every probe */
let netStand: boolean | undefined;
const reset = () => { Object.assign(SILENT, JSON.parse(JSON.stringify(DEFAULTS.SILENT))); Object.assign(SPOTTED, DEFAULTS.SPOTTED); if (netStand !== undefined) NQM.NETQUIET.on = netStand; };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };

interface Stage { lit?: boolean; hidden?: boolean; shot?: boolean; /** nothing solid between them at the waist either (spotted.ts hands' own `open`): a desk a round clears still stops a pair of hands */ open?: boolean; dMin?: number; dMax?: number; skip?: number }
/** the records office as the pair, silent, the partner following; ONE defender left, rooted, his state the probe's to write */
export async function rig(seed: number, on: boolean, knobs: Record<string, unknown> = {}, foeIdx = -1, scn = SCN, keep = false) {
  reset(); Math.random = seeded(0x9137 + seed * 7919);
  const E = SCENARIOS.find((e: any) => e.id === scn);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) } : {}) }));
  const game = W.game; game.godMode = true; game.tune.chaos = 0; SILENT.on = true; Object.assign(SPOTTED, { on }, knobs);
  // THE ONE MAN LEFT IS NOT A MAN ON A NET GONE QUIET: the rig gets its one defender by dropping every other, and where the quiet-net rule is on (the page's
  // stand) that floor of bodies is exactly what puts dread in the last man (he whips to a noise and is alert where these rigs write him suspicious). His
  // state is the probe's to write, so that rule is held off here too.
  if (netStand === undefined) netStand = !!NQM.NETQUIET.on; NQM.NETQUIET.on = false;
  const q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`).replace(/&squad4\b/, '') + '&squad=1';
  const { why } = await quiet(() => startFromQuery(game, new URLSearchParams(q))); if (why) throw new Error(`start refused — ${why}`);
  const said: string[] = [];
  const seen = new Set<any>(); let pose: null | (() => void) = null, lastLine = '';
  const R = { W, game, said, mate: null as any, foe: null as any, /** (keep) a second defender left up, rooted and calm beside the first: a man to drop */ other: null as any, shots: [] as number[], crouched: 0, frames: 0, post: null as null | (() => void),
    step(n = 1) { for (let i = 0; i < n; i++) { SILENT.on = true; game.player.visibility = 0.05; pose?.(); { const o = R.other; if (o && o.state !== 'dead') { o.state = 'patrol'; o.awareness = 0; o.pinned = true; o.char.vel[0] = o.char.vel[2] = 0; o.fireCd = Math.max(o.fireCd ?? 0, 0.5); } } W.step(DT); R.frames++;
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'guardShot' && R.mate && e.who === R.mate.char.id) R.shots.push(game.time); }
      { const b = R.mate?.bubble, key = b ? `${b.t}|${b.text}` : ''; if (b && key !== lastLine) { lastLine = key; said.push(`${R.mate.callsign}${b.radio ? ' (radio)' : ''}: ${b.text}`); } }
      R.post?.(); } },
    label(): string { return game.orders.hud().status[0]?.label ?? ''; },
    lines(re: RegExp): string[] { return said.filter(t => re.test(t)); },
    of(): any { return SPM.spottedOf(R.mate); },
    mode(): string { return SPM.spottedMode(game, R.mate); },
    vis(p: number[]): number { return game.visibilityOf(GDM.lightEstimateAt(game, [p[0], 0.9, p[2]])); },
    /** the walls and furniture between a man's eyes and a body at p (leaves ignored), as spotted.ts asks it */
    line(h: any, p: number[], low = false): boolean { const col = game.col, dyn = col.dynamicBoxes, eye = h.char.bones.head ?? [h.char.pos[0], 1.6, h.char.pos[2]]; col.dynamicBoxes = [];
      try { return !col.segmentBlocked(eye, [p[0], low ? 0.75 : 1.25, p[2]]) || !col.segmentBlocked(eye, [p[0], low ? 1.05 : 1.6, p[2]]); } finally { col.dynamicBoxes = dyn; } },
    /** write the one defender's state every frame from here on (rooted where he stands, facing `face`) */
    /** the written state once more, now (after a step in which the game's own turn rule moved his facing on from what was written) */
    again() { pose?.(); },
    hold(state: string, aw: number, o: { face?: number[]; eyesOn?: 'sam' | null } = {}) { const h = R.foe, p0 = [...h.char.pos];
      pose = () => { if (h.state === 'dead') return; h.state = state; h.awareness = aw; h.pinned = true; h.char.pos[0] = p0[0]; h.char.pos[2] = p0[2]; h.char.vel[0] = h.char.vel[2] = 0;
        if (o.face) { const y = Math.atan2(o.face[0] - p0[0], o.face[2] - p0[2]); h.char.aimYaw = h.char.bodyYaw = y; if ('headYaw' in h.char) h.char.headYaw = y; }
        if (o.eyesOn === 'sam') { h.foe = 'player'; h.lastSeenT = game.time; h.lastKnown = [...game.player.char.pos]; } else if (o.eyesOn === null) { h.foe = null; h.lastSeenT = -100; }
        h.fireCd = Math.max(h.fireCd ?? 0, 0.5); }; },   // (he never gets a round off: the probe is about the partner)
    free() { pose = null; },
    /** put the partner at a spot `dMin‥dMax` from the defender with his line on it (lit or dark as asked; `hidden`: with NO line, a line a stride or two
     *  off) and Sam beside him on the far side */
    stage(o: Stage = {}): { at: number[]; sam: number[]; vis: number; d: number } | null { const h = R.foe, nav = game.col.nav, hp = h.char.pos; let skip = o.skip ?? 0;
      for (let r = o.dMin ?? 5; r <= (o.dMax ?? 8.5); r += 0.5) for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, p = [hp[0] + Math.sin(a) * r, 0, hp[2] + Math.cos(a) * r];
        if (nav.isBlocked(p[0], p[2]) || game.doors.list.some((d: any) => flat(p, d.frameCentre) < 1.5)) continue;
        const sam0 = [p[0] - Math.sin(a) * 1.0 + Math.cos(a) * 2.2, 0, p[2] - Math.cos(a) * 1.0 - Math.sin(a) * 2.2];
        const v = R.vis(p), ln = R.line(h, p) && (!o.shot || SPM.spottedShotLine(game, p, hp, 1.2));   // (`shot`: his line on the spot AND a shot from it — a pane or a partition between them is sight without a shot)
        if (o.hidden) { if (R.line(h, p) || R.line(h, p, true)) continue; let lone = true; for (let j = 0; j < 8 && lone; j++) { const b = j * Math.PI / 4; lone = !R.line(h, [p[0] + Math.sin(b) * 0.5, 0, p[2] + Math.cos(b) * 0.5]); } if (!lone) continue; let near = false; for (let j = 0; j < 36 && !near; j++) { const b = j * Math.PI / 6, rr = 1.6 + 0.5 * Math.floor(j / 12), s = [p[0] + Math.sin(b) * rr, 0, p[2] + Math.cos(b) * rr]; near = !nav.isBlocked(s[0], s[2]) && nav.walkable(p, s) && SPM.spottedShotLine(game, s, hp, 1.2) && flat(s, hp) > 3 && flat(s, sam0) > 1.2 && !game.doors.list.some((d: any) => flat(s, d.frameCentre) < 1.3); } if (!near) continue; }
        else { if (!ln) continue; if (o.lit !== undefined && (o.lit ? v < 0.5 : v > 0.2)) continue; if (o.open && game.col.solidBlocked([p[0], 1.0, p[2]], [hp[0], 1.0, hp[2]])) continue; }
        // Sam a stride ahead of him toward the man and two paces to the side (clear of the lane his gun needs): the partner follows with Sam, and what Sam is going at, in front of him
        const sam = [p[0] - Math.sin(a) * 1.0 + Math.cos(a) * 2.2, 0, p[2] - Math.cos(a) * 1.0 - Math.sin(a) * 2.2]; if (nav.isBlocked(sam[0], sam[2]) || !nav.walkable(p, sam)) continue;
        if (skip-- > 0) continue;
        game.teleportPlayer(sam); W.cursorAt([hp[0], 1.2, hp[2]]); const c = R.mate.char; c.pos[0] = p[0]; c.pos[2] = p[2]; c.vel[0] = c.vel[2] = 0; if (R.mate.script) R.mate.script.path = undefined;
        return { at: p, sam, vis: v, d: r }; }
      return null; },
  };
  await quiet(() => { R.step(20); });
  R.mate = game.orders.squad()[0]; if (!R.mate) throw new Error('no partner was stood up'); R.mate.god = true;
  const H = game.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'); { const lit = H.filter((h: any) => R.vis(h.char.pos) >= 0.5); R.foe = foeIdx < 0 ? lit[(-foeIdx - 1) % Math.max(1, lit.length)] ?? H[0] : H[foeIdx % H.length]; } R.hold('patrol', 0, { eyesOn: null });   // (foeIdx < 0: a defender standing in the light — one the partner can make out)
  if (keep) R.other = H.filter((h: any) => h !== R.foe).sort((a: any, b: any) => flat(a.char.pos, R.foe.char.pos) - flat(b.char.pos, R.foe.char.pos))[0] ?? null;
  await quiet(() => { for (const h of H) if (h !== R.foe && h !== R.other) killGuard(game, h, [0, 0, 1], true); SLM.setSilent(game, true, 'order'); game.orders.give('fallIn', game.orders.targetAt(game.player.char.pos), 'all'); R.step(60 * 3); });
  return R;
}
/** the first defender (the lit ones first) round whom the stage can be set */
export async function staged(on: boolean, o: Stage, scn = SCN) { for (const k of [-1, -2, -3, 0, 1, 2, 3, 4, 5, 6, 7]) { const R = await rig(11, on, {}, k, scn); const st = R.stage(o); if (st) return { R, st }; } throw new Error(`no spot could be staged round any defender of ${scn}`); }
const moved = (R: any, secs: number): number => { const p0 = [...R.mate.char.pos]; R.step(Math.round(secs * 60)); return flat(p0, R.mate.char.pos); };
const crouchOf = (gd: any): number => gd.char.anim.crouch ?? (gd.char.anim.crouchTarget ? 1 : 0);

// ---------------------------------------------------------------- suspicious: low, still, holding
export const spottedSuspicious = guarded(async () => {
  const { verdict, done } = family('spotted-suspicious: a suspicious man with a line to the partner — he gets low, stands still and holds his fire, and says so');
  const run = async (on: boolean) => { const R = await rig(11, on); const s0 = { ...SPM.SPOTTED_STATS }; const st = R.stage({ lit: false });
    if (!st) throw new Error('no dark spot in the man\'s line could be staged'); R.step(30);
    R.hold('suspicious', 0.6, { face: st.at, eyesOn: null }); R.step(60 * 2); const m = moved(R, 3);
    return { R, st, crouch: crouchOf(R.mate), moved: m, shots: R.shots.length, mode: R.mode(), of: R.of(), label: R.label(), cues: R.lines(/heard something|looking\. holding still|moving off it/), eyes: R.lines(/eyes on\. holding/).length, stats: Object.fromEntries(Object.keys(s0).map(k => [k, SPM.SPOTTED_STATS[k] - (s0 as any)[k]])) as any }; };
  const A = await run(false), B = await run(true);
  verdict(A.crouch < 0.3 && A.mode === 'calm' && /SILENT/.test(A.label) && !/low|contact/.test(A.label) && A.cues.length === 0 && Object.values(A.stats).every(v => v === 0),
    'switch off: he stands as he did, nothing said, nothing counted', `${f2(A.st.d)} m from the man, meter ${f2(A.st.vis)} · crouch ${f2(A.crouch)} · moved ${f2(A.moved)} m in 3 s · rounds ${A.shots} · ${A.label}`);
  verdict(B.mode === 'wary' && B.crouch > 0.6 && B.moved < 0.3, 'switch on: on a knee and still while the man is suspicious', `mode ${B.mode} (${B.of?.what}) · crouch ${f2(B.crouch)} · moved ${f2(B.moved)} m in 3 s (off: ${f2(A.moved)} m, crouch ${f2(A.crouch)})`);
  verdict(B.shots === 0 && B.stats.held > 0, 'not a round at a man who is only suspicious (awareness 0.6: past where the base hold ends)', `rounds on ${B.shots} · off ${A.shots} · frames a round was held ${B.stats.held} · "eyes on. holding." ×${B.eyes}`);
  verdict(B.cues.length === 1 && /radio/.test(B.cues[0]) && /SILENT · low/.test(B.label), 'he says it once, over the net, and the squad line\'s word shows it', `${B.cues.join(' / ') || '(nothing said)'} · ${B.label}`);
  // the man settles: he says so, gets up, follows
  { const R = B.R; R.hold('patrol', 0, { eyesOn: null }); R.step(60 * 4); 
    verdict(R.mode() === 'calm' && R.lines(/settled\. moving/).length === 1 && /SILENT/.test(R.label()) && !/low/.test(R.label()), 'the man settles: back to calm, said once, the word is plain SILENT again', `mode ${R.mode()} · ${R.lines(/settled/).join(' / ')} · ${R.label()}`);
    R.step(60 * 2); verdict(crouchOf(R.mate) < 0.3, '… and he is on his feet again', `crouch ${f2(crouchOf(R.mate))}`); }
  // the leash: Sam walks on while the man is still suspicious
  { const R = await rig(11, true); const st = R.stage({ lit: false })!; R.step(30); R.hold('suspicious', 0.4, { face: st.at, eyesOn: null }); R.step(60 * 2); const still = moved(R, 1.5);
    const g = R.game, c = R.mate.char, nav = g.col.nav; let q: number[] | null = null;
    for (let r = 9; r <= 13 && !q; r += 1) for (let k = 0; k < 24 && !q; k++) { const a = k * Math.PI / 12, s = [c.pos[0] + Math.sin(a) * r, 0, c.pos[2] + Math.cos(a) * r]; if (!nav.isBlocked(s[0], s[2]) && flat(s, R.foe.char.pos) > st.d && (nav.findPath(c.pos, s)?.length ?? 0) > 0) q = s; }
    if (!q) throw new Error('no spot past the leash'); g.teleportPlayer(q); const d0 = flat(c.pos, g.player.char.pos); const m = moved(R, 4);
    verdict(still < 0.3 && d0 > SPOTTED.leashM && m > 1 && crouchOf(R.mate) > 0.5, 'Sam goes on past the leash: the partner follows, still low', `still ${f2(still)} m · Sam ${f2(d0)} m off (leash ${SPOTTED.leashM}) · then moved ${f2(m)} m in 4 s, crouch ${f2(crouchOf(R.mate))}`); }
  return done();
});

// ---------------------------------------------------------------- suspicious, and lit in his line: off it
export const spottedSlip = guarded(async () => {
  const { verdict, done } = family('spotted-slip: lit, in a suspicious man\'s line — he takes a spot out of the line or in the dark');
  let got: any = null, tried = 0;
  for (let k = 0; k < 20 && !got; k++) { const R = await rig(11, true, {}, k % 5); const s0 = SPM.SPOTTED_STATS.slips; const st = R.stage({ lit: true, dMin: 4.5, dMax: 10, skip: Math.floor(k / 5) * 4 }); if (!st) continue; tried++;
    R.step(20); R.hold('suspicious', 0.4, { face: st.at, eyesOn: null }); R.step(60 * 6);
    if (SPM.SPOTTED_STATS.slips > s0) { const p = R.mate.char.pos; got = { R, st, at: [...p], line: R.line(R.foe, p, true), vis: R.vis(p), walked: flat(st.at, p), left: R.of()?.spot ? flat(p, R.of().spot) : 9, crouch: crouchOf(R.mate), said: R.lines(/moving off it/), shots: R.shots.length, dSam: flat(p, R.game.player.char.pos) }; } }
  verdict(!!got, 'a lit spot in the man\'s line with a way off it is found on the floor', got ? `staged ${f2(got.st.d)} m from him, meter ${f2(got.st.vis)} (${tried} tried)` : `${tried} lit spots tried, no slip taken`);
  if (got) {
    verdict((!got.line || got.vis < SPOTTED.litAt) && got.left < 0.3 && got.walked > 0.2 && got.walked <= SPOTTED.slipM + 1, 'six seconds on he is out of the man\'s line (or in the dark), on the spot he took, a few strides at most from where he stood', `walked ${f2(got.walked)} m, ${f2(got.left)} m from his spot · in his line ${got.line} · meter there ${f2(got.vis)} (was ${f2(got.st.vis)}) · ${f2(got.dSam)} m from Sam`);
    verdict(got.crouch > 0.6 && got.shots === 0 && got.said.length === 1, 'low there, no round, and he said he was moving', `crouch ${f2(got.crouch)} · rounds ${got.shots} · ${got.said.join(' / ')}`); }
  return done();
});

// ---------------------------------------------------------------- a man dropped: low before the noise
export const spottedBrace = guarded(async () => {
  const { verdict, done } = family('spotted-brace: a man dropped beside a mate who has not turned yet — the partner is low and off that mate\'s line before the weapon lands');
  const run = async (on: boolean, knobs: Record<string, unknown> = {}) => { let R: any = null, st: any = null;
    for (const k of [-1, -2, -3, 0, 1, 2, 3, 4]) { R = await rig(11, on, knobs, k, SCN, true); if (!R.other) continue; st = R.stage({ lit: true, dMin: 4.5, dMax: 9 }); if (st) break; }
    if (!st) throw new Error('no lit spot in a kept defender\'s line could be staged');
    const g = R.game, nav = g.col.nav, hp = R.foe.char.pos, o = R.other;
    // the man to drop: a few strides from the mate, on the far side from the partner (nearer than braceM whatever the level dealt)
    { let put = false; for (let r = 2; r <= 5 && !put; r += 0.5) for (let k = 0; k < 12 && !put; k++) { const a = k * Math.PI / 6, q = [hp[0] + Math.sin(a) * r, 0, hp[2] + Math.cos(a) * r]; if (nav.isBlocked(q[0], q[2]) || flat(q, st.at) < flat(hp, st.at) || flat(q, st.sam) < 2) continue; o.char.pos[0] = q[0]; o.char.pos[2] = q[2]; put = true; }
      if (!put) throw new Error('no floor for the man to drop beside the mate'); }
    R.hold('patrol', 0, { face: st.at, eyesOn: null }); R.step(40); const s0 = { ...SPM.SPOTTED_STATS }, said0 = R.said.length;
    killGuard(g, o, [0, 0, 1], true, 'struck', 'player'); const t0 = g.time; let lowAt = -1, modeAt = -1, outAt = -1;
    R.post = () => { const t = g.time - t0; if (modeAt < 0 && R.mode() === 'wary') modeAt = t; if (lowAt < 0 && crouchOf(R.mate) > 0.5) lowAt = t; if (outAt < 0 && (!R.line(R.foe, R.mate.char.pos, true) || R.vis(R.mate.char.pos) < SPOTTED.litAt)) outAt = t; };
    R.step(Math.round(60 * 2.5)); const label = R.label(), mid = { mode: R.mode(), crouch: crouchOf(R.mate), wary: modeAt >= 0, said: R.said.slice(said0).filter((l: string) => /holding still|going low|moving off it|heard it|settled|covering|contact!/.test(l)) };
    // the mate turns to the noise: said once now
    R.hold('suspicious', 0.45, { face: R.mate.char.pos, eyesOn: null }); R.step(60 * 2); R.post = null; const heard = R.lines(/heard it\. holding still|looking\. holding still|heard something|moving off it/).length;
    // … and nothing more comes of it: back to calm
    R.hold('patrol', 0, { eyesOn: null }); R.step(60 * 6);
    return { st, lowAt, modeAt, outAt, label, mid, heard, endMode: R.mode(), shots: R.shots.length, stats: Object.fromEntries(Object.keys(s0).map(k => [k, SPM.SPOTTED_STATS[k] - (s0 as any)[k]])) as any }; };
  const A = await run(false), B = await run(true, { brace: true }), C = await run(true);
  verdict(A.modeAt < 0 && A.lowAt < 0 && A.stats.braces === 0, 'switch off: a man dropped is nothing to him', `mode never wary · never low · ${A.label}`);
  verdict(B.stats.braces === 1 && B.modeAt >= 0 && B.modeAt < 0.1 && B.lowAt >= 0 && B.lowAt < 1.2, 'the switch and its knob on: wary the frame the man drops and on a knee inside about a second (the weapon lands at 0.6 s, the mate turns after that)', `wary at ${f2(B.modeAt)} s · low at ${f2(B.lowAt)} s · out of the mate's line or in the dark at ${B.outAt < 0 ? 'never' : f2(B.outAt) + ' s'} · staged ${f2(B.st.d)} m from the mate, meter ${f2(B.st.vis)}`);
  verdict(B.mid.said.length === 0 && /SILENT · low/.test(B.label), 'none of its lines is said for it (nobody has turned yet); the squad line shows him low', `said: ${B.mid.said.join(' / ') || '(nothing)'} · ${B.label}`);
  verdict(B.heard >= 1 && B.heard <= 2 && B.shots === 0, 'the mate turns to the noise: said then (holding still, and once more if he moves off the line), and no round', `lines ${B.heard} · rounds ${B.shots}`);
  verdict(B.endMode === 'calm', 'the mate settles and nothing more comes of it: calm again', `mode ${B.endMode}`);
  verdict(C.stats.braces === 0 && !C.mid.wary && C.modeAt >= 0, 'as shipped (its own knob off): he waits for the mate to turn', `braces ${C.stats.braces} · wary before the mate turned: ${C.mid.wary} · wary once he had: ${C.modeAt >= 0}`);
  return done();
});

// ---------------------------------------------------------------- at arm's length: by hand
export const spottedClose = guarded(async () => {
  const { verdict, done } = family('spotted-close: a roused man turns to the partner at arm\'s length — he is taken by hand, quietly');
  const run = async (on: boolean, state: 'suspicious' | 'alert', o: Stage, knobs: Record<string, unknown> = {}) => { let R: any = null, st: any = null;
    for (const k of [-1, -2, -3, 0, 1, 2, 3, 4, 5, 6, 7]) { R = await rig(11, on, knobs, k); st = R.stage(o); if (st) break; }
    if (!st) throw new Error('no spot that near a defender could be staged');
    const g = R.game, s0 = { ...SPM.SPOTTED_STATS }; R.step(10); const t0 = g.time; let downAt = -1; const ev0 = g.events.length;
    R.hold(state, state === 'alert' ? 1 : 0.6, { face: st.at, eyesOn: state === 'alert' ? 'sam' : null }); if (state === 'suspicious') R.post = () => { R.foe.char.aimYaw = R.foe.char.bodyYaw = Math.atan2(R.mate.char.pos[0] - R.foe.char.pos[0], R.mate.char.pos[2] - R.foe.char.pos[2]); if (downAt < 0 && R.foe.state === 'dead') downAt = g.time - t0; };
    else R.post = () => { if (downAt < 0 && R.foe.state === 'dead') downAt = g.time - t0; };
    R.step(60 * 6); R.post = null;
    const loud = g.events.slice(ev0).filter((e: any) => (e.kind === 'guardShot' || e.kind === 'shot') && (e.loud || (e.level ?? 0) >= 1)).length;
    return { st, downAt, kind: R.foe.downKind ?? null, shots: R.shots.length, loud, lines: R.lines(/taking him|tango down/), stats: Object.fromEntries(Object.keys(s0).map(k => [k, SPM.SPOTTED_STATS[k] - (s0 as any)[k]])) as any }; };
  const near: Stage = { dMin: 1.5, dMax: 2.0, shot: true, open: true };   // (a furnished room can put a desk between them that a line and a round both clear: the rule rightly keeps his hands off across it)
  const A = await run(false, 'suspicious', near), B = await run(true, 'suspicious', near);
  verdict(A.stats.takes === 0 && (A.shots > 0 || A.downAt < 0), 'switch off: no hands — the base partner answers a man that near with his (loud) rifle, or with nothing', `the man ${A.downAt < 0 ? 'still up after 6 s' : `down at ${f2(A.downAt)} s (${A.kind})`} · the partner's rounds ${A.shots} · loud shots ${A.loud}`);
  verdict(B.downAt > 0 && B.downAt < 3 && B.kind === 'struck' && B.shots === 0 && B.loud === 0 && B.stats.taken === 1, 'switch on: the man is out cold inside three seconds, by hand, not a round fired', `staged ${f2(B.st.d)} m from him · down at ${f2(B.downAt)} s (${B.kind}) · rounds ${B.shots} · loud ${B.loud} · takes ${B.stats.takes}, taken ${B.stats.taken}`);
  verdict(B.lines.length === 2, 'said as it happens: "he\'s on me. taking him." then the room fight\'s own "tango down."', B.lines.join(' / ') || '(nothing said)');
  const C = await run(true, 'suspicious', near, { close: false });
  verdict(C.stats.takes === 0 && C.shots === 0, 'its own knob off: no hands (and, the man only suspicious, no round)', `takes ${C.stats.takes} · rounds ${C.shots} · the man ${C.downAt < 0 ? 'still up' : 'down'}`);
  const D = await run(true, 'alert', { dMin: 4.5, dMax: 8, shot: true });
  verdict(D.stats.takes === 0 && D.shots > 0, 'a man already alert, strides away: never the hands — the gun, as before', `staged ${f2(D.st.d)} m · takes ${D.stats.takes} · rounds ${D.shots} · the man ${D.downAt < 0 ? 'still up' : `down at ${f2(D.downAt)} s (${D.kind})`}`);
  // ASKED FOR (the hook an order layer calls when its stalk is blown): the man suspicious with his BACK to the partner — nothing by itself, the hands when asked
  { let R: any = null, st: any = null; for (const k of [-1, -2, -3, 0, 1, 2, 3, 4, 5, 6, 7]) { R = await rig(11, true, {}, k); st = R.stage(near); if (st) break; }
    if (!st) throw new Error('no spot that near a defender could be staged');
    const g = R.game, s0 = SPM.SPOTTED_STATS.takes; R.step(10); const t0 = g.time; let downAt = -1;
    { const f = R.foe.char.pos, m = R.mate.char.pos; R.hold('suspicious', 0.6, { face: [2 * f[0] - m[0], 0, 2 * f[2] - m[2]], eyesOn: null }); } R.post = () => { if (downAt < 0 && R.foe.state === 'dead') downAt = g.time - t0; };
    R.step(90); const before = SPM.SPOTTED_STATS.takes - s0, up = R.foe.state !== 'dead', ok = SPM.spottedTake(g, R.mate, R.foe), t1 = g.time; R.step(60 * 4); R.post = null;
    verdict(before === 0 && up && ok && R.foe.state === 'dead' && R.foe.downKind === 'struck' && R.shots.length === 0, 'asked for (a blown stalk\'s hook): a suspicious man with his back to him is left alone until asked, then taken by hand',
      `by itself in 1.5 s: takes ${before}, the man ${up ? 'up' : 'down'} · asked: ${ok} · ${R.foe.state === 'dead' ? `down ${f2(downAt - (t1 - t0))} s later (${R.foe.downKind})` : 'still up'} · rounds ${R.shots.length}`); }
  return done();
});

// ---------------------------------------------------------------- caught: the cue, the gun, the step to a line
export const spottedCaught = guarded(async () => {
  const { verdict, done } = family('spotted-caught: an alert man with his eyes on Sam — the partner says so, fights, and steps to a line');
  const run = async (on: boolean, o: Stage, scn = SCN, prep?: (R: any, st: any) => void) => { const { R, st } = await staged(on, o, scn); prep?.(R, st); R.step(30); const t0 = R.game.time, p0 = [...R.mate.char.pos];
    R.hold('alert', 1, { face: R.game.player.char.pos, eyesOn: 'sam' }); let downAt = -1, modeAt = -1;
    R.post = () => { if (downAt < 0 && R.foe.state === 'dead') downAt = R.game.time - t0; if (modeAt < 0 && R.mode() === 'caught') modeAt = R.game.time - t0; };
    R.step(60 * 10); R.post = null;
    return { R, st, first: R.shots.length ? R.shots[0] - t0 : -1, shots: R.shots.length, downAt, modeAt, label: R.label(), cues: R.lines(/made you|made me|contact! covering/), walked: flat(p0, R.mate.char.pos), steps: SPM.SPOTTED_STATS.steps }; };
  const A = await run(false, { shot: true }), B = await run(true, { shot: true });
  verdict(B.modeAt >= 0 && B.modeAt < 0.1 && B.cues.length === 1 && /radio/.test(B.cues[0]), 'caught is known the frame the man is alert with eyes on them, and said once', `caught after ${f2(B.modeAt)} s · ${B.cues.join(' / ') || '(nothing said)'}`);
  verdict(B.first >= 0 && B.downAt >= 0 && (A.first < 0 || B.first <= A.first + 1e-6), 'he fires and the man goes down — no later than with the switch off', `on: first round ${f2(B.first)} s, man down ${f2(B.downAt)} s, rounds ${B.shots} · off: first round ${f2(A.first)} s, man down ${f2(A.downAt)} s, rounds ${A.shots}`);
  { const { R, st } = await staged(true, { shot: true }); R.step(30); R.hold('alert', 1, { face: R.game.player.char.pos, eyesOn: 'sam' }); R.foe.god = true; R.step(45); const lab = R.label();
    verdict(/SILENT · (contact|compromised)/.test(lab), 'the squad line\'s word shows it while it lasts', `${lab} (${f2(st.d)} m)`); }
  const s0 = SPM.SPOTTED_STATS.steps; const C = await run(false, { hidden: true }, 'warehouse-four'), D = await run(true, { hidden: true }, 'warehouse-four');   // (the warehouse: crates on an open floor — the records office's lines all run through doorways, where nobody is stood)
  verdict(D.first >= 0 && D.downAt >= 0 && (C.first < 0 || D.first <= C.first + 1e-6), 'behind cover with his gun on the opening he was dealt: his gun comes round onto the man who has them (a step to a shot if he needs one) and he fires',
    `on: first round ${f2(D.first)} s, man down ${f2(D.downAt)} s, walked ${f2(D.walked)} m, steps taken ${D.steps - s0} · off: first round ${f2(C.first)} s, man down ${f2(C.downAt)} s (−1 = never in 10 s), walked ${f2(C.walked)} m`);
  // Sam squarely between the partner and the man (the file as it walks: the partner a stride behind him) — the room fight keeps a gun down while Sam is in its lane
  const between = (R: any, st: any) => { const hp = R.foe.char.pos, p = st.at, L = flat(p, hp); R.game.teleportPlayer([p[0] + (hp[0] - p[0]) * 1.6 / L, 0, p[2] + (hp[2] - p[2]) * 1.6 / L]); };
  const s1 = SPM.SPOTTED_STATS.steps; const E = await run(false, { shot: true }, SCN, between), F = await run(true, { shot: true }, SCN, between);
  verdict(F.first >= 0 && F.downAt >= 0 && F.steps - s1 > 0 && (E.first < 0 || F.first <= E.first + 1e-6), 'Sam standing in his line to the man: he steps to a line that is not through Sam, and fires',
    `on: first round ${f2(F.first)} s, man down ${f2(F.downAt)} s, walked ${f2(F.walked)} m, steps taken ${F.steps - s1} · off: first round ${f2(E.first)} s, man down ${f2(E.downAt)} s (−1 = never in 10 s)`);
  return done();
});

// ---------------------------------------------------------------- the fire rule
export const spottedFire = guarded(async () => {
  const { verdict, done } = family('spotted-fire: which rounds are held');
  const R = await rig(11, true); const { game } = R; const st = R.stage({ lit: false, dMin: 8, dMax: 11 }) ?? R.stage({ dMin: 7, dMax: 12 }); if (!st) throw new Error('no spot could be staged');
  const man = R.mate, h = R.foe, holds = () => ({ base: SLM.silentHolds(game, man, h) as boolean, mine: SPM.spottedHolds(game, man, h) as boolean });
  const set = (state: string, aw: number, o: any = {}) => { R.hold(state, aw, o); R.step(2); R.again(); R.free(); };   // (which rounds are held for a man FACING so: how fast he turns there is another rule's)
  set('suspicious', 0.4, { eyesOn: null }); const s1 = holds(); set('suspicious', 0.7, { eyesOn: null }); const s2 = holds();
  verdict(s1.base && s2.mine && !s2.base, 'suspicious: held at any awareness (the base hold ends at a half)', `awareness 0.4: base ${s1.base}, this ${s1.mine} · awareness 0.7: base ${s2.base}, this ${s2.mine}`);
  SPOTTED.on = false; const off = holds().mine; SPOTTED.on = true; SPOTTED.hold = false; const knob = holds().mine; SPOTTED.hold = true;
  verdict(!off && !knob, 'the switch off, or its own knob off: nothing held here', `switch off ${off} · hold off ${knob}`);
  { const rep = man.weapon.def.report, was = { ...rep }; Object.assign(rep, { level: 0.6, loud: false }); const q = holds().mine; Object.assign(rep, was);
    const lw = game.rescue.lastWarning; game.rescue.lastWarning = () => true; const u = holds().mine; game.rescue.lastWarning = lw;
    verdict(!q && !u && holds().mine, 'a quiet gun (the kit\'s Quiet set) is not held; a hostage\'s last warning holds nothing', `quiet gun ${q} · last warning ${u} · the rifle, no warning ${holds().mine}`); }
  // alert, but not on them
  const away = [h.char.pos[0] * 2 - man.char.pos[0], 0, h.char.pos[2] * 2 - man.char.pos[2]];
  set('search', 1, { face: away, eyesOn: null }); const u1 = holds(); set('alert', 1, { face: away, eyesOn: null }); const u2 = holds();
  set('alert', 1, { face: man.char.pos, eyesOn: null }); const u3 = holds(); set('alert', 1, { face: away, eyesOn: 'sam' }); const u4 = holds();
  set('alert', 1, { face: away, eyesOn: null }); SPOTTED.holdUnaware = false; const u5 = holds(); SPOTTED.holdUnaware = true; const cm = SPOTTED.closeM; SPOTTED.closeM = 30; const u6 = holds(); SPOTTED.closeM = cm;
  verdict(u1.mine && u2.mine && !u3.mine && !u4.mine && !u5.mine && !u6.mine, 'an alert or searching man turned away, far off, no eyes on them: held on — and not once he faces them, has eyes on one of them, is close, or with the knob off',
    `${f2(flat(man.char.pos, h.char.pos))} m · searching, turned away ${u1.mine} · alert, turned away ${u2.mine} · facing the partner ${u3.mine} · eyes on Sam ${u4.mine} · knob off ${u5.mine} · inside 'close' ${u6.mine}`);
  set('alert', 1, { face: away, eyesOn: null }); game.fight.hotT = game.time; R.step(2); const hot = { mine: holds().mine, mode: R.mode() };
  verdict(!hot.mine && hot.mode === 'caught', 'a floor gone loud since the order: nothing is held, and he is in the fight', `held ${hot.mine} · mode ${hot.mode}`);
  return done();
});

// ---------------------------------------------------------------- off, and calm
export const spottedOff = guarded(async () => {
  const { verdict, done } = family('spotted-off: the switch off acts on nothing; on, with nobody ever suspicious, it changes nothing');
  { const R = await rig(11, false); const s0 = JSON.stringify(SPM.SPOTTED_STATS); const st = R.stage({ lit: false })!; R.step(20); R.hold('suspicious', 0.4, { face: st.at, eyesOn: null }); R.step(60 * 3);
    const feet = SPM.spottedFeet(R.game, R.mate, true, false), keen = SPM.spottedKeen(R.game, R.mate);
    verdict(JSON.stringify(SPM.SPOTTED_STATS) === s0 && feet === null && !keen && R.mode() === 'calm' && !SPM.spottedHolds(R.game, R.mate, R.foe) && SPM.spottedOf(R.mate) === null && /SILENT/.test(R.label()) && !/low|contact/.test(R.label()),
      'off, beside a suspicious man: no state kept, no feet, no word, nothing counted', `feet ${feet} · keen ${keen} · mode ${R.mode()} · ${R.label()} · ${SPM.spottedSummary(R.game)}`); }
  const calm = async (on: boolean) => { const R = await rig(11, on); const hs: string[] = []; const g = R.game; const way = R.foe.char.pos;
    R.post = () => { if (R.frames % 20 === 0) hs.push(hashDigest(digestGame(g, true))); };
    const path = g.col.nav.findPath(g.player.char.pos, way) ?? []; let i = 0;
    for (let f = 0; f < 60 * 20; f++) { const wp = path[Math.min(i, path.length - 1)]; if (wp && flat(wp, g.player.char.pos) < 0.5 && i < path.length - 4) i++;
      const p = g.player.char.pos; if (wp) { const d = flat(wp, p) || 1; g.teleportPlayer([p[0] + (wp[0] - p[0]) / d * 1.3 * DT, 0, p[2] + (wp[2] - p[2]) / d * 1.3 * DT]); } R.step(); }
    return { hs, mode: R.mode(), wary: SPM.SPOTTED_STATS.wary }; };
  const w0 = SPM.SPOTTED_STATS.wary; const A = await calm(false), B = await calm(true); const same = A.hs.length === B.hs.length && A.hs.every((h, i) => h === B.hs[i]);
  verdict(same && B.wary === w0, 'on, the one defender calm for twenty seconds of following Sam: every digest the same as off', `${A.hs.length} digests · ${same ? 'identical' : `first difference at #${A.hs.findIndex((h, i) => h !== B.hs[i])}`} · last ${A.hs[A.hs.length - 1]} / ${B.hs[B.hs.length - 1]}`);
  return done();
});

if (import.meta.main) {
  const want = process.argv.slice(2), all: [string, () => Promise<boolean>][] = [['suspicious', spottedSuspicious], ['slip', spottedSlip], ['brace', spottedBrace], ['close', spottedClose], ['caught', spottedCaught], ['fire', spottedFire], ['off', spottedOff]];
  let ok = true; for (const [n, f] of all) if (!want.length || want.includes(n)) ok = (await f()) && ok;
  console.log(`\n=== spotted-probes.ts: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); process.exit(ok ? 0 : 1);
}
