// The 'weapons' probe family (run through probes.ts: `bun run tools/qa/probes.ts weapons | weapons-identity [--print]`): lane R0 of docs/internal/sc20k-design.md —
// the two pistols become rows of a WeaponDef table (weapons.ts WEAPONS) and every number the code used to spell out for them (cadence, magazine, the staged
// reload, flash card, muzzle light gain, report voice, hearing event, the kick a round gives loose furniture, a guard's spread and reload beat, what a dying hand
// lets go of, the kit column's row) is read from the row instead. R0's contract is NO behaviour change, so this probe was written and its expectations FROZEN
// (EXPECT, at the bottom) on the tree before the refactor, by driving the code and writing down what it did — clicks through the real input path, the guard's
// rounds through the real alert branch, the HUD row through the real overlay code on a stand-in DOM. The refactored tree must reproduce every entry exactly:
// the guard section is seeded and records the frame of every round and the cadence he drew after it, so even the ORDER in which Math.random is consumed has to
// survive. PASS / FAIL per section; `--print` dumps the freshly measured card as a paste-ready literal.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { Overlay } = await import(`${ROOT}/src/ui/overlay.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const PRINT = process.argv.includes('--print');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the sight tests read them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held and pinned, facing east, deaf */
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; }
/** alert, licensed (a sighting this frame), planted where he is (pinned: fires from where he was put, at the chest), the gun coming round in `fireCd` */
function armAlert(gd: any, game: any, fireCd = 0.3) { gd.hold = false; gd.pinned = true; gd.dazzledUntil = -1; gd.heardUpTo = 1e12; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = fireCd; gd.reloadT = -1; gd.lastKnown = v3.copy(game.player.char.pos); gd.lastSeenT = game.time; resetChase(gd); }
const chest = (gd: any): Vec3 => gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0]);
const r4 = (x: number) => Number(x.toFixed(4)), r6 = (x: number) => Number(x.toFixed(6));
const vec4 = (p: number[]) => [r4(p[0]), r4(p[1]), r4(p[2])];
const kit = (game: any) => { const g = game.player.pistol; return `chamber ${g.chamber} mag ${g.mag} spare [${g.spare.join(',')}]${g.reloading ? ' RELOADING' : ''}`; };
const itemStr = (it: any) => `${it.kind}/fill${it.fill}/who${it.who}/life${r4(it.life)}`;

/** Everything one round leaves behind that a WeaponDef row now supplies, recorded off the live objects: the report (audio voice + gain, at the muzzle), the 1-frame
 *  flash card pushed into game.fx (metres ahead of the muzzle, half extents, emissive, albedo, ttl), the lights flashed (muzzle light + impact flash: intensity,
 *  range, ttl, colour, owner), the hearing event (kind, level, loud), and any kick handed to a prop (|J|, who). Install once per stand-up; `take()` drains. */
function recorder(W: any) {
  const { game, engine } = W;
  const cards: any[] = [], flashes: any[] = [], kicks: any[] = [];
  const fxArr = game.fx; fxArr.push = function (...items: any[]) { for (const f of items) cards.push({ c: v3.copy(f.box.c), h: vec4(f.box.h), emissive: vec4(f.box.emissive), albedo: vec4(f.box.albedo), ttl: r4(f.ttl) }); return Array.prototype.push.apply(this, items); };
  const lights = engine.lights; const origFlash = lights.flash.bind(lights);
  lights.flash = (pos: Vec3, color: Vec3, intensity: number, range: number, ttl: number, owner: number) => { flashes.push({ intensity: r4(intensity), range: r4(range), ttl: r4(ttl), color: vec4(color), owner }); return origFlash(pos, color, intensity, range, ttl, owner); };
  const props = game.props; const origImp = props.applyImpulse.bind(props);
  props.applyImpulse = (p: any, point: Vec3, J: Vec3, who: number, thud = false) => { kicks.push({ J: Math.round(Math.hypot(J[0], J[2]) * 2) / 2, who, thud }); return origImp(p, point, J, who, thud); };   // (to the nearest 0.5: the weapon's share is its propImpulse factor — 4 vs 6 — while the exact figure moves a percent or two with the millimetres of muzzle placement the arm's idle clocks and the draw leave, which is staging, not weapon identity)
  const seenEv = new Set<any>(); const events: any[] = [];
  const audio: any[] = []; W.audioLog = audio;
  const R = {
    audio, cards, flashes, kicks, events,
    /** call after every step: collects the gunfire hearing events raised since (by identity — game.events is re-filtered every frame) */
    pump() { for (const e of game.events) { if (seenEv.has(e)) continue; seenEv.add(e); if (e.kind === 'shot' || e.kind === 'guardShot') events.push({ kind: e.kind, level: e.level, loud: e.loud }); } },
    /** what the round(s) since the last take left: the FIRST report's voice + gain, the first card relative to the muzzle that report played at, every flash, event, kick, and a count of every sound by name */
    take() {
      R.pump();
      const a0 = audio.find(a => a.name === 'pistolSuppressed' || a.name === 'pistolLoud'); const c0 = cards[0];
      const counts: Record<string, number> = {}; for (const a of audio) if (a.name !== 'footstep') { const key = `${a.name}@${a.name === 'propThud' ? a.gain.toFixed(2) : r4(a.gain)}`; counts[key] = (counts[key] ?? 0) + 1; }   // (propThud's gain rides the impulse: 2 decimals, see kicks)
      const out = {
        voice: a0 ? `${a0.name}@${r4(a0.gain)}` : 'none',
        card: c0 ? { ahead: a0?.pos ? r4(v3.dist(c0.c, a0.pos)) : -1, h: c0.h, emissive: c0.emissive, albedo: c0.albedo, ttl: c0.ttl } : null,
        cards: cards.length, flashes: flashes.slice(), events: events.slice(), kicks: kicks.slice(), counts,
      };
      audio.length = 0; cards.length = 0; flashes.length = 0; kicks.length = 0; events.length = 0;
      return out;
    },
  };
  return R;
}

/** The kit column (ui/overlay.ts updateEquip — the private method, run on a stand-in `this` and a stand-in DOM: it only ever creates elements, sets class / text /
 *  a width or height / a title, and appends) serialised to one line: tag.class{text}(children)[w=…][h=…][t=…]. What the player reads off the bottom-left. */
function hudText(game: any): string {
  type El = { tag: string; className: string; kids: El[]; text: string; style: Record<string, string>; title: string; appendChild(c: El): El; textContent: string };
  const mkEl = (tag: string): El => {
    const el: any = { tag, className: '', kids: [] as El[], text: '', style: {}, title: '', appendChild(c: El) { el.kids.push(c); return c; } };
    Object.defineProperty(el, 'textContent', { get() { return el.text + el.kids.map((k: El) => k.textContent).join(''); }, set(v: string) { el.text = v ?? ''; el.kids = []; } });
    return el as El;
  };
  const ser = (el: El): string => `${el.tag}${el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.text ? `{${el.text}}` : ''}${el.kids.length ? `(${el.kids.map(ser).join(' ')})` : ''}${el.style.width ? `[w=${el.style.width}]` : ''}${el.style.height ? `[h=${el.style.height}]` : ''}${el.title ? `[t=${el.title}]` : ''}`;
  const G = globalThis as any; const had = 'document' in G; const prev = G.document;
  G.document = { createElement: (t: string) => mkEl(t) };
  try {
    const ctx = { equip: mkEl('div'), equipKey: '' };
    (Overlay.prototype as any).updateEquip.call(ctx, game);
    return ctx.equip.kids.map(ser).join(' | ');
  } finally { if (had) G.document = prev; else delete G.document; }
}

/** Sam alone in the corridor with the Five-seveN drawn, everyone parked deaf on the lot; god mode (nothing here is about him being hit). */
async function stagePlayer(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  if ((game as any).civilians) { (game.tune as any).civilians = false; (game as any).civilians.length = 0; }   // (the civilians — later actors on the floor, src/game/civilians.ts — scream and run under gunfire and one of them sits on a cubicle chair: this family's frozen numbers predate them, so they are switched off here like in the needs / tactics identity probes)
  game.godMode = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer([21.5, 0, 11.5]); game.player.slot = 'pistol'; game.player.holstered = false; game.player.crouch = false; game.player.pistol.lightOn = false;
  W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT); W.step(DT);
  return W;
}
const WALL: Vec3 = [21.5, 1.2, 10.0];   // the corridor's north wall between the server-room and manager's doors: blank plaster 1.5 m in front of him

// ================================================================ the probe
export async function weaponsIdentity() {
  console.log('\n=== weapons-identity: the pistols\' every number, driven and recorded — cadence, magazine, staged reload, report, flash, hearing event, prop kick, guard spread / reload beat, one-shot, drops, muzzle, the kit row (frozen before the WeaponDef refactor; nothing may move) ===');
  const card: Record<string, any> = {};

  // ---------------------------------------------------------------- (1) the player's Five-seveN through the real input path: a click every frame at a wall until it is dry
  //      and then some (cadence = frames between rounds; 10+1 rounds; the dry click's own cadence and its log lines), then the reloads: from empty (the staged beat —
  //      mag out / in / rack frames off the R press, the empty dropped as a 'mag' item, done at 1.6 s), a partial (the part-magazine back to storage, the fullest
  //      in, no rack), a refused one (nothing to gain), one broken off by a sprint, none left, and the sandbox's bottomless magazine
  {
    const W = await stagePlayer(501); const { game, input } = W; const pl = game.player, gun = pl.pistol; const R = recorder(W);
    const msgs: string[] = []; const origMsg = game.msg.bind(game); game.msg = (t: string) => { msgs.push(t); return origMsg(t); };
    const P: Record<string, any> = {};
    P.name = gun.name; P.kit0 = kit(game); P.canFire0 = gun.canFire(); P.roundsReady0 = gun.roundsReady;
    const shotFrames: number[] = [], dryFrames: number[] = []; let firstShot: any = null; let noiseAfter = -1; let idx = 0;
    for (let f = 0; f < 240; f++) {
      W.cursorAt(WALL); input.clicked |= 1; W.step(DT); R.pump();
      for (; idx < R.audio.length; idx++) { const a = R.audio[idx]; if (a.name === 'pistolSuppressed' || a.name === 'pistolLoud') shotFrames.push(f); else if (a.name === 'dryFire') dryFrames.push(f); }
      if (shotFrames.length === 1 && !firstShot) { noiseAfter = r4(pl.noise); firstShot = R.take(); idx = 0; }
    }
    const rest = R.take();
    P.firstShot = firstShot; P.noiseAfterShot = noiseAfter;
    P.shotFrames = shotFrames; P.shotGaps = shotFrames.slice(1).map((x, i) => x - shotFrames[i]);
    P.dryFrames = dryFrames.slice(0, 6); P.dryGaps = dryFrames.slice(1, 6).map((x, i) => x - dryFrames[i]);
    P.restCounts = rest.counts; P.restEvents = rest.events.length; P.restCards = rest.cards; P.restFlashes = rest.flashes.length;
    P.kitDry = kit(game); P.canFireDry = gun.canFire();
    P.msgs = [...new Set(msgs)];
    // --- reload from empty: R, then watch the beat
    msgs.length = 0;
    input.pressed.add('KeyR'); const items0 = new Set(game.items.items);
    const beat: string[] = []; let doneAt = -1; let animReload = false;
    for (let f = 0; f < 130; f++) {
      W.step(DT); if (f === 0) animReload = pl.char.anim.reloading;
      for (const a of R.audio) if (['magOut', 'magIn', 'rack'].includes(a.name)) beat.push(`${a.name}@${r4(a.gain)}:f${f}`);
      R.audio.length = 0;
      if (doneAt < 0 && f > 0 && !gun.reloading) doneAt = f;
    }
    P.reloadEmpty = { beat, doneAt, animReload, kitAfter: kit(game), msgs: [...new Set(msgs)], items: game.items.items.filter((it: any) => !items0.has(it)).map(itemStr) };
    // --- three rounds, then a partial reload
    msgs.length = 0;
    for (let f = 0; f < 60; f++) { W.cursorAt(WALL); if (f % 20 === 0) input.clicked |= 1; W.step(DT); }
    R.take(); const kitBeforePartial = kit(game); const itemsP = new Set(game.items.items);
    input.pressed.add('KeyR'); const beat2: string[] = []; let done2 = -1;
    for (let f = 0; f < 130; f++) { W.step(DT); for (const a of R.audio) if (['magOut', 'magIn', 'rack'].includes(a.name)) beat2.push(`${a.name}@${r4(a.gain)}:f${f}`); R.audio.length = 0; if (done2 < 0 && f > 0 && !gun.reloading) done2 = f; }
    P.reloadPartial = { kitBefore: kitBeforePartial, beat: beat2, doneAt: done2, kitAfter: kit(game), spareSorted: gun.spareSorted().join(','), msgs: [...new Set(msgs)], items: game.items.items.filter((it: any) => !itemsP.has(it)).length };
    // --- refused: full magazine, one up the pipe — R does nothing
    msgs.length = 0; input.pressed.add('KeyR'); W.step(DT); P.reloadRefused = { reloading: gun.reloading, msgs: [...msgs], kit: kit(game) };
    // --- broken off by a sprint: fire one, R, ten frames, then Shift+W
    for (let f = 0; f < 20; f++) { W.cursorAt(WALL); if (f === 0) input.clicked |= 1; W.step(DT); } R.take();
    input.pressed.add('KeyR'); for (let f = 0; f < 10; f++) W.step(DT); const midReload = gun.reloading, midAnim = pl.char.anim.reloading;
    input.keys.add('ShiftLeft'); input.keys.add('KeyW'); for (let f = 0; f < 5; f++) W.step(DT); input.keys.delete('ShiftLeft'); input.keys.delete('KeyW');
    for (let f = 0; f < 30; f++) W.step(DT);
    P.reloadSprint = { midReload, midAnim, after: gun.reloading, afterAnim: pl.char.anim.reloading, kit: kit(game) }; R.take();
    // --- no spare left at all: R says so
    gun.spare = []; gun.mag = 2; msgs.length = 0; input.pressed.add('KeyR'); W.step(DT); P.reloadNoSpares = { reloading: gun.reloading, msgs: [...msgs] };
    // --- the bottomless magazine (sandbox): a dry gun + the toggle → it fires again, and the count never falls
    gun.mag = 0; gun.chamber = 0; game.infiniteAmmo = true; W.step(DT); const canInf = gun.canFire();
    for (let f = 0; f < 45; f++) { W.cursorAt(WALL); input.clicked |= 1; W.step(DT); }
    const inf = R.take(); P.infinite = { canFire: canInf, shotsIn45f: (inf.counts['pistolSuppressed@1'] ?? 0) + (inf.counts['pistolLoud@1'] ?? 0), kit: kit(game) }; game.infiniteAmmo = false; W.step(DT);
    P.muzzleAhead = r4(v3.dist(pl.char.muzzle, pl.char.bones.handR));
    card.player = P;
  }

  // ---------------------------------------------------------------- (2) the kit column's rows off the real overlay code: fresh, light on, holstered, a canister up, mid-reload, dry
  {
    const W = await stagePlayer(511); const { game, input } = W; const pl = game.player, gun = pl.pistol; const H: Record<string, any> = {};
    pl.paceShownT = -10; pl.pace = 1;
    H.fresh = hudText(game);
    gun.lightOn = true; W.step(DT); H.lightOn = hudText(game); gun.lightOn = false;
    pl.holstered = true; W.step(DT); H.holstered = hudText(game); pl.holstered = false;
    pl.slot = 'smoke'; W.step(DT); H.smokeUp = hudText(game); pl.slot = 'pistol'; W.step(DT);
    for (let f = 0; f < 50; f++) { W.cursorAt(WALL); if (f % 16 === 0) input.clicked |= 1; W.step(DT); }
    input.pressed.add('KeyR'); for (let f = 0; f < 30; f++) W.step(DT); H.midReload = hudText(game);
    for (let f = 0; f < 100; f++) W.step(DT); H.reloaded = hudText(game);
    gun.spare = []; gun.mag = 0; gun.chamber = 0; W.step(DT); H.dry = hudText(game);
    card.hud = H;
  }

  // ---------------------------------------------------------------- (3) a guard's sidearm through the real alert branch: pinned 6.5 m up the corridor from a lit, god-mode Sam standing
  //      in the open — 45 s of it. The frame of every round (cadence 0.55–1.05 s: the jitter is seeded, so the list itself is the expectation), the fireCd he drew
  //      after each, twelve to a magazine then 'reloading!' + magOut and 1.7 s of nothing, how many found Sam (his spread), the first round's report / card /
  //      flash / event; then Sam puts one in him: what leaves the hand
  {
    Math.random = seeded(502);
    const W = await standUp(); const { game } = W; const pl = game.player;
    if ((game as any).civilians) { (game.tune as any).civilians = false; (game as any).civilians.length = 0; }   // (the civilians — later actors on the floor, src/game/civilians.ts — scream and run under gunfire and one of them sits on a cubicle chair: this family's frozen numbers predate them, so they are switched off here like in the needs / tactics identity probes)
    game.godMode = true; game.aiEnabled = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1); park(C, 2);
    game.teleportPlayer([24.0, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
    place(A, [17.5, 0, 11.3], Math.PI / 2); W.step(DT); pl.visibility = 0.9;
    armAlert(A, game, 0.3);
    const R = recorder(W);
    let frame = 0;
    const lines: string[] = []; const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { if (gd === A) lines.push(`${text}:f${frame}`); return origSay(gd, text, radio); };
    const shotFrames: number[] = [], cds: number[] = [], magOuts: string[] = []; let hits = 0; let firstShot: any = null; let idx = 0;
    const reloadTs: number[] = [], reloadSpans: number[] = []; let wasReloading = false, reloadStart = -1; let stateTrace = '';
    for (frame = 0; frame < 60 * 45; frame++) {
      pl.visibility = 0.9; W.step(DT); R.pump();
      if (pl.hitFlash > 0.9) hits++; pl.hitFlash = 0;
      for (; idx < R.audio.length; idx++) { const a = R.audio[idx]; if (a.name === 'pistolLoud' || a.name === 'pistolSuppressed') { shotFrames.push(frame); cds.push(r6(A.fireCd)); } else if (a.name === 'magOut') magOuts.push(`magOut@${r4(a.gain)}:f${frame}`); }
      if (shotFrames.length === 1 && !firstShot) { firstShot = R.take(); idx = 0; }
      const rel = A.reloadT >= 0; if (rel && !wasReloading) { reloadStart = frame; reloadTs.push(r6(A.reloadT)); } if (!rel && wasReloading) reloadSpans.push(frame - reloadStart); wasReloading = rel;
      if (frame % 300 === 0) stateTrace += A.state[0];
    }
    const rest = R.take();
    const G: Record<string, any> = {};
    G.firstShot = firstShot; G.rounds = shotFrames.length; G.shotFrames = shotFrames; G.gaps = shotFrames.slice(1).map((x, i) => x - shotFrames[i]);
    G.fireCdAfterEach = cds; G.magOuts = magOuts; G.reloadLines = lines.filter(l => l.startsWith('reloading!')); G.otherLines = lines.filter(l => !l.startsWith('reloading!')).slice(0, 6);
    G.reloadTAtStart = reloadTs; G.reloadSpansFrames = reloadSpans; G.hits = hits;
    G.restEvents = rest.events.length; G.eventKinds = [...new Set([...(firstShot?.events ?? []), ...rest.events].map((e: any) => `${e.kind}:${e.level}:${e.loud}`))];
    G.restCards = rest.cards; G.restFlashes = rest.flashes.length; G.bodyHits = Object.entries(rest.counts).filter(([k]) => k.startsWith('bodyHit')).map(([k, n]) => `${k}×${n}`);
    G.stateTrace = stateTrace; G.muzzleAhead = r4(v3.dist(A.char.muzzle, A.char.bones.handR));
    // --- Sam puts one in him (alert, pistol drawn): what leaves the hand
    const itemsBefore = new Set(game.items.items);
    fireWeapon(game, pl.char, chest(A), true);
    for (let f = 0; f < 3; f++) W.step(DT);
    const t = R.take();
    G.kill = { state: A.state, downKind: A.downKind, downBy: A.downBy, dropped: game.items.items.filter((it: any) => !itemsBefore.has(it)).map(itemStr), gdDropped: A.dropped ? `${A.dropped.kind}/fill${A.dropped.fill}` : 'none', voice: t.voice, events: t.events, bodyHit: Object.keys(t.counts).filter(k => k.startsWith('bodyHit')) };
    card.guard = G;
  }

  // ---------------------------------------------------------------- (4) one-shot, both ways round: a fresh guard's rounds at a Sam who CAN be hit — down on the first that finds him, his
  //      own Five-seveN leaving his hand (drawn); a calm patrol man (torch in hand) taking one — the torch drops, not the gun, and dies on the floor; a heightened
  //      patrol (pistol at the low ready) — the pistol drops; a holstered Sam shot down drops nothing
  {
    Math.random = seeded(503);
    const W = await standUp(); const { game } = W; let pl = game.player;
    game.godMode = false; game.aiEnabled = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1); park(C, 2);
    game.teleportPlayer([24.0, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false;
    place(A, [17.5, 0, 11.3], Math.PI / 2); W.step(DT); pl.visibility = 0.9; armAlert(A, game, 0.3);
    const R = recorder(W);
    let downAt = -1, rounds = 0, hits = 0; const items0 = new Set(game.items.items);
    for (let f = 0; f < 60 * 12 && downAt < 0; f++) {
      pl.visibility = 0.9; W.step(DT); R.pump();
      if (pl.hitFlash > 0.9) hits++;
      if (pl.down) downAt = f;
    }
    const t0 = R.take(); rounds = (t0.counts['pistolLoud@1'] ?? 0) + (t0.counts['pistolSuppressed@1'] ?? 0);
    const O: Record<string, any> = { downAtFrame: downAt, roundsFiredUntilDown: rounds, hitsTaken: hits, hitsLeft: pl.hitsLeft, maxHits: pl.constructor.MAX_HITS, samDropped: game.items.items.filter((it: any) => !items0.has(it)).map(itemStr), bodyHit: Object.keys(t0.counts).filter(k => k.startsWith('bodyHit')) };
    // the calm man with the torch: one round from a (restarted, standing) Sam 4 m in front of him in the dark
    game.restartEncounter(); for (let i = 0; i < 3; i++) W.step(DT); pl = game.player;
    const [A2, B2, C2] = game.guards; park(A2, 0); park(C2, 2);
    place(B2, [30.0, 0, 11.3], -Math.PI / 2); B2.hold = true; B2.pinned = false; B2.state = 'patrol'; B2.awareness = 0; B2.heardUpTo = 1e12;
    game.teleportPlayer([26.0, 0, 11.3]); pl.slot = 'pistol'; pl.holstered = false; pl.visibility = 0; W.step(DT); W.step(DT);
    const torchBefore = B2.drawn === false && B2.flashlight.enabled;
    const itemsB = new Set(game.items.items);
    fireWeapon(game, pl.char, chest(B2), true); for (let f = 0; f < 3; f++) W.step(DT);
    O.torchMan = { torchBefore, state: B2.state, dropped: game.items.items.filter((it: any) => !itemsB.has(it)).map(itemStr), gdDropped: B2.dropped?.kind ?? 'none', lightJustAfter: B2.flashlight.enabled, lightAfter1s: false };
    for (let f = 0; f < 70; f++) W.step(DT); O.torchMan.lightAfter1s = B2.flashlight.enabled;
    // a heightened floor's patrol (drawn) taking one: the pistol drops
    park(B2, 1); game.escalate(); A2.hold = true; A2.pinned = false; place(A2, [30.0, 0, 11.3], -Math.PI / 2); A2.state = 'patrol'; A2.awareness = 0; A2.heardUpTo = 1e12; W.step(DT); W.step(DT);
    const drawnBefore = A2.drawn; const itemsA = new Set(game.items.items);
    fireWeapon(game, pl.char, chest(A2), true); for (let f = 0; f < 3; f++) W.step(DT);
    O.drawnPatrolMan = { drawnBefore, state: A2.state, dropped: game.items.items.filter((it: any) => !itemsA.has(it)).map(itemStr), gdDropped: A2.dropped?.kind ?? 'none' };
    // a holstered Sam shot down: nothing leaves the hand (the gun is on the thigh)
    pl.holstered = true; W.step(DT); const itemsH = new Set(game.items.items);
    hitPlayer(game, [1, 0, 0]); W.step(DT);
    O.holsteredSam = { down: pl.down, hitsLeft: pl.hitsLeft, dropped: game.items.items.filter((it: any) => !itemsH.has(it)).length };
    R.take();
    card.oneShot = O;
  }

  // ---------------------------------------------------------------- (5) the kick a round gives loose furniture: Sam's round vs a guard's, at the same prop from the same spot
  {
    Math.random = seeded(504);
    const W = await standUp(); const { game } = W; const pl = game.player;
    game.godMode = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1); park(C, 2);
    // hunt a prop with a clean line from a standing shooter at one of a few open spots (statics further than the prop along the line), 1.5–6 m off
    const spots: Vec3[] = [[19.9, 0, 15.6], [20.0, 0, 11.3], [31.0, 0, 18.0], [23.0, 0, 17.5], [12.0, 0, 11.2]];
    let pick: { spot: Vec3; prop: any; target: Vec3 } | null = null;
    search: for (const s of spots) for (const p of game.props.props) {
      const target: Vec3 = [p.x, Math.min(0.45, p.height * 0.5), p.z]; const from: Vec3 = v3.add(s, [0, 1.45, 0]);
      const d = v3.dist(from, target); if (d < 1.5 || d > 6) continue;
      const dir = v3.normalize(v3.sub(target, from));
      const ph = game.props.raycast(from, dir, d + 0.6); if (!ph || ph.prop !== p) continue;
      const st = game.col.raycast(from, dir, d + 0.6); if (st && st.t < ph.t) continue;
      pick = { spot: s, prop: p, target }; break search;
    }
    const K: Record<string, any> = {};
    if (!pick) K.staging = 'no prop with a clean line from the trial spots';
    else {
      const R = recorder(W);
      game.teleportPlayer(v3.copy(pick.spot)); pl.slot = 'pistol'; pl.holstered = false; for (let i = 0; i < 45; i++) W.step(DT); R.take();   // (a fresh player starts holstered now: let the draw settle so the muzzle is where a drawn man's is)
      const home = [pick.prop.x, pick.prop.z, pick.prop.yaw];
      fireWeapon(game, pl.char, v3.copy(pick.target), true); const t1 = R.take();
      pick.prop.x = home[0]; pick.prop.z = home[1]; pick.prop.yaw = home[2]; pick.prop.vx = pick.prop.vz = pick.prop.w = 0; pick.prop.place();
      // the guard fires from the same spot; Sam stands 4 m off to the side of the line, still (a guard's spread reads Sam's range and pace)
      const dir = v3.normalize(v3.sub(pick.target, v3.add(pick.spot, [0, 1.45, 0])));
      game.teleportPlayer([pick.spot[0] - dir[2] * 4, 0, pick.spot[2] + dir[0] * 4]); W.step(DT);
      A.hold = true; A.pinned = false; A.heardUpTo = 1e12; place(A, pick.spot, Math.atan2(pick.target[0] - pick.spot[0], pick.target[2] - pick.spot[2])); A.state = 'alert'; A.awareness = 1; A.lastSeenT = -100; A.lastKnown = null; W.step(DT); R.take();
      fireWeapon(game, A.char, v3.copy(pick.target), false); const t2 = R.take();
      K.prop = `${pick.prop.def.name ?? pick.prop.def.kind}#${pick.prop.id}`; K.spot = pick.spot;
      const roundStr = (t: any) => ({ voice: t.voice, kicks: t.kicks, card: t.card ? { ahead: t.card.ahead, h: t.card.h, emissive: t.card.emissive, albedo: t.card.albedo, ttl: t.card.ttl } : null, flashes: t.flashes.map((f: any) => `${f.intensity}/${f.range}/${f.ttl}/[${f.color}]/o${f.owner}`), events: t.events, counts: t.counts });
      K.playerRound = roundStr(t1); K.guardRound = roundStr(t2);
    }
    card.props = K;
  }

  // ---------------------------------------------------------------- verdicts
  if (PRINT) console.log('\n--- measured card (paste over EXPECT) ---\nconst EXPECT: Record<string, any> = ' + JSON.stringify(card, null, 1).replace(/\n\s*/g, ' ') + ';\n');
  let allPass = true;
  for (const sec of Object.keys(card)) {
    const want = EXPECT[sec], got = card[sec];
    const diffs: string[] = [];
    if (want === undefined) diffs.push('no expectation recorded for this section');
    else for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) { const a = JSON.stringify(got[k]), b = JSON.stringify(want[k]); if (a !== b) diffs.push(`${k}: got  ${a}\n        want ${b}`); }
    const ok = diffs.length === 0; allPass &&= ok;
    const summary = sec === 'player' ? `${got.name}: ${got.kit0} → ${got.shotFrames.length} rounds, gaps ${JSON.stringify(got.shotGaps)} f, then dry, gaps ${JSON.stringify(got.dryGaps)} f; report ${got.firstShot?.voice}, card ${JSON.stringify(got.firstShot?.card)}, flashes ${JSON.stringify(got.firstShot?.flashes)}, event ${JSON.stringify(got.firstShot?.events)}, noise meter ${got.noiseAfterShot}; log ${JSON.stringify(got.msgs)}\n    reload from empty: ${JSON.stringify(got.reloadEmpty.beat)} done f${got.reloadEmpty.doneAt} → ${got.reloadEmpty.kitAfter}, floor item ${JSON.stringify(got.reloadEmpty.items)}; partial: ${got.reloadPartial.kitBefore} → ${JSON.stringify(got.reloadPartial.beat)} → ${got.reloadPartial.kitAfter}; refused ${JSON.stringify(got.reloadRefused)}; sprint ${JSON.stringify(got.reloadSprint)}; no spares ${JSON.stringify(got.reloadNoSpares)}; bottomless ${JSON.stringify(got.infinite)}; muzzle ${got.muzzleAhead} m ahead of the wrist`
      : sec === 'hud' ? `fresh kit row: ${got.fresh}\n    mid-reload: ${got.midReload}`
      : sec === 'guard' ? `${got.rounds} rounds in 45 s at frames ${JSON.stringify(got.shotFrames.slice(0, 14))}…, gaps ${got.gaps.length ? Math.min(...got.gaps) : '-'}–${got.gaps.length ? Math.max(...got.gaps.filter((g: number) => g < 90)) : '-'} f between rounds, reload beat ${JSON.stringify(got.reloadTAtStart)} s = ${JSON.stringify(got.reloadSpansFrames)} f, ${got.magOuts.length}× ${got.magOuts[0]?.split(':')[0]}, ${got.reloadLines.length}× 'reloading!', ${got.hits} of them found Sam; report ${got.firstShot?.voice}, card ${JSON.stringify(got.firstShot?.card)}, flashes ${JSON.stringify(got.firstShot?.flashes)}, events ${JSON.stringify(got.eventKinds)}; state ${got.stateTrace}; killed → ${JSON.stringify(got.kill)}; muzzle ${got.muzzleAhead} m`
      : sec === 'oneShot' ? `Sam down at f${got.downAtFrame} after ${got.roundsFiredUntilDown} round(s) fired, ${got.hitsTaken} hit taken (MAX_HITS ${got.maxHits}, left ${got.hitsLeft}), his gun on the floor: ${JSON.stringify(got.samDropped)}; torch man ${JSON.stringify(got.torchMan)}; drawn patrol man ${JSON.stringify(got.drawnPatrolMan)}; holstered Sam ${JSON.stringify(got.holsteredSam)}`
      : `${got.prop ?? got.staging} from ${JSON.stringify(got.spot)}: Sam's round ${JSON.stringify(got.playerRound)}\n    guard's round ${JSON.stringify(got.guardRound)}`;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${sec}: ${summary}${diffs.length ? '\n    ✗ ' + diffs.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== weapons-identity: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ firearm-topup: the staged reload honours the row's topUp rule (review finding #22)
/** The staged reload (Firearm.startReload → update to done) must end where rearm() would put the gun: a topped-up row (Sam's Five-seveN) at capacity + the
 *  chambered round, a non-topUp row (the guards' 9 mm, the AKS-74U: the chambered round is racked OUT of the magazine) at capacity all told — never a full
 *  box on top of a chambered round (capacity + 1, `spent` −1), which the mag-in stage used to seat. Pure API over the real rows, no floor: nobody calls
 *  startReload on a non-topUp row today (guards count a beat down and rearm()), so this pins the rule for the lane that does. PASS / FAIL per case. */
export async function firearmTopUp() {
  console.log('\n=== firearm-topup: a staged reload ends where rearm() would — topUp rows at capacity+1, non-topUp rows at capacity all told, with or without a round chambered ===');
  const { Firearm, WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
  const run = (gun: any) => { const ok = gun.startReload(); for (let i = 0; i < 400 && gun.reloading; i++) gun.update(1 / 60); return ok; };   // 6.7 s of sixtieths: past every row's reload
  const st = (gun: any) => `chamber ${gun.chamber} mag ${gun.mag} ready ${gun.roundsReady} spent ${gun.spent}${gun.spare.length ? ` spare [${gun.spare.join(',')}]` : ''}`;
  type Case = { note: string; row: string; setup: (g: any) => void; want: { started: boolean; ready: number; spent: number; chamber: number; spare?: string } };
  const cases: Case[] = [
    // non-topUp, bottomless (the guards' sidearm: 12 all told)
    { note: 'guard 9 mm, a round chambered + a part box (5): reload → 11 in the box under the chambered round = 12, spent 0 (was 13 / −1)', row: 'guard9mm', setup: g => { g.chamber = 1; g.mag = 5; }, want: { started: true, ready: 12, spent: 0, chamber: 1 } },
    { note: 'guard 9 mm, fresh (chambered, 11 in the box = full by its rule): reload refused — nothing to gain (was accepted, → 13)', row: 'guard9mm', setup: () => {}, want: { started: false, ready: 12, spent: 0, chamber: 1 } },
    { note: 'guard 9 mm, shot dry (chamber 0, box 0): reload → 12 seated, one racked → 11 + 1 = 12', row: 'guard9mm', setup: g => { g.chamber = 0; g.mag = 0; }, want: { started: true, ready: 12, spent: 0, chamber: 1 } },
    { note: 'AKS-74U (non-topUp, staged 0.7 / 1.7 / 2.2), a round chambered + 9 in the box: reload → 29 + 1 = 30, spent 0 (was 31 / −1)', row: 'aks74u', setup: g => { g.chamber = 1; g.mag = 9; }, want: { started: true, ready: 30, spent: 0, chamber: 1 } },
    // topUp, finite spares (Sam's Five-seveN: 10 + 1) — must be exactly what it was
    { note: 'Five-seveN, chambered + 6 in the mag: reload → 10 + 1 = 11, the six back to storage', row: 'fiveseven', setup: g => { g.chamber = 1; g.mag = 6; }, want: { started: true, ready: 11, spent: 0, chamber: 1, spare: '10,10,6' } },
    { note: 'Five-seveN, dry (0 / 0): reload → 10 seated, one racked → 9 + 1 = 10, spent 1, the empty dropped', row: 'fiveseven', setup: g => { g.chamber = 0; g.mag = 0; }, want: { started: true, ready: 10, spent: 1, chamber: 1, spare: '10,10' } },
    { note: 'Five-seveN, fresh (10 + 1): reload refused', row: 'fiveseven', setup: () => {}, want: { started: false, ready: 11, spent: 0, chamber: 1, spare: '10,10,10' } },
  ];
  let allPass = true;
  for (const c of cases) {
    const gun = new Firearm(WEAPONS[c.row]); c.setup(gun); const before = st(gun);
    const started = run(gun);
    const fails: string[] = [];
    if (started !== c.want.started) fails.push(`startReload ${started}, want ${c.want.started}`);
    if (gun.reloading) fails.push('still reloading after 6.7 s');
    if (gun.roundsReady !== c.want.ready) fails.push(`ready ${gun.roundsReady}, want ${c.want.ready}`);
    if (gun.spent !== c.want.spent) fails.push(`spent ${gun.spent}, want ${c.want.spent}`);
    if (gun.chamber !== c.want.chamber) fails.push(`chamber ${gun.chamber}, want ${c.want.chamber}`);
    if (gun.roundsReady > gun.def.magCapacity + (gun.def.topUp ? 1 : 0)) fails.push(`more rounds ready (${gun.roundsReady}) than the row can ever carry (${gun.def.magCapacity}${gun.def.topUp ? '+1' : ''})`);
    if (c.want.spare !== undefined && gun.spareSorted().join(',') !== c.want.spare) fails.push(`spares [${gun.spareSorted().join(',')}], want [${c.want.spare}]`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${c.note}\n    ${before} → ${st(gun)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== firearm-topup: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ frozen on the tree before the refactor (`weapons-identity --print` regenerates the literal)
// PROVENANCE / PROFILE of EXPECT (the card is exact numbers off driven code, so what it inherits matters as much as what it pins):
//   PINNED by the stages: civilians OFF (tune.civilians false + the roster emptied — Marta / Owen scream and run under gunfire and one sits where a staged guard stands;
//   the card predates them), godMode, everyone parked deaf on the lot, Sam's visibility 0.02, the pistol drawn with its light off, chaos 0 (headless.ts default =
//   no destruction), Math.random seeded per stage (the seeds are in the stage calls);
//   INHERITED defaults, all as shipped when each section was (re-)frozen: tune.tracers (the carbine's tracer rule — a `guardShots` row would move if it changed),
//   tune.aimModel + AIM (the guard's spread / settle rows), SUPPRESSION (Sam's spread under fire is not exercised here: nobody fires at him), the weapons.ts rows
//   themselves (the point of the card), tune.tactics / needs / devices (nobody is alert long enough or calm long enough for any of them to act inside these seconds).
//   A section that moves: bisect to the commit, re-freeze THAT section with --print, and add a line below saying which and why (as the R5 / 08-08 notes do).
// (the gear lane: the `hud` section's seven rows each gained the SAME two things and nothing else — the frag grenades' row 5 closing the column, and the
//  rifle row's `40MM ×3` tag after RING — diffed string against string before the re-freeze.)
// (lane R5: the `hud` section's seven rows each gained the SAME appended fourth slot — the rifle's row, slung, thirty pips, SEMI, RING ×5 — because the default
//  loadout now has the rifle in the kit; everything else was byte for byte what was frozen. 08-08, the kit re-slotted (rifle-kit lane) — the `hud` section, and
//  ONLY it, re-frozen knowingly: the strip lost 'RMB OCP' + its bar (div.gadgets is now L LIGHT · N NIGHT VISION), row 1 gained the OCP as a tagged meter at
//  its end (span.tag.ocp.on{OCP}(span.ocpbar(b[w=…])) with its title), the rifle's row moved from key 4 at the foot to key 2 under the pistol (its RING tag's
//  title reworded for the right button), smoke / stun became keys 3 / 4, and the 'a canister up' snapshot is keyed `smokeUp` (was `slot2`). The pistol's own
//  pips / counts / mags inside row 1 and both canister rows' bodies are unchanged text. No other section moved.
//  The frag part: the `hud` section, and ONLY it, re-frozen knowingly — every row gained the SAME appended fifth slot, the frag grenades' row (key 5, two pips,
//  ×2); the --print card moved nowhere else.)
const EXPECT: Record<string, any> = {
  player: {
    name: "FN Five-seveN (suppressed)",
    kit0: "chamber 1 mag 10 spare [10,10,10]",
    canFire0: true,
    roundsReady0: 11,
    firstShot: {"voice":"pistolSuppressed@1","card":{"ahead":0.05,"h":[0.018,0.018,0.045],"emissive":[40,22,8],"albedo":[1,0.8,0.5],"ttl":0.035},"cards":1,"flashes":[{"intensity":40.5,"range":8,"ttl":0.09,"color":[1,0.62,0.26],"owner":1},{"intensity":1.5,"range":2.5,"ttl":0.05,"color":[1,0.8,0.5],"owner":0}],"events":[{"kind":"shot","level":0.6,"loud":false}],"kicks":[],"counts":{"pistolSuppressed@1":1,"bulletImpact@0.8":1}},
    noiseAfterShot: 0.6,
    shotFrames: [0,14,28,42,56,70,84,98,112,126,140],
    shotGaps: [14,14,14,14,14,14,14,14,14,14],
    dryFrames: [154,170,186,202,218,234],
    dryGaps: [16,16,16,16,16],
    restCounts: {"pistolSuppressed@1":10,"bulletImpact@0.8":10,"dryFire@0.7":6},
    restEvents: 10,
    restCards: 10,
    restFlashes: 20,
    kitDry: "chamber 0 mag 0 spare [10,10,10]",
    canFireDry: false,
    msgs: ["you're empty. press R to reload","click — empty (R to reload)"],
    reloadEmpty: {"beat":["magOut@0.7:f23","magIn@0.8:f62","rack@0.8:f83"],"doneAt":97,"animReload":true,"kitAfter":"chamber 1 mag 9 spare [10,10]","msgs":["reloading"],"items":["mag/fill0/who1/life38.2167"]},
    reloadPartial: {"kitBefore":"chamber 1 mag 6 spare [10,10]","beat":["magOut@0.7:f23","magIn@0.8:f62"],"doneAt":97,"kitAfter":"chamber 1 mag 10 spare [10,6]","spareSorted":"10,6","msgs":["reloading"],"items":0},
    reloadRefused: {"reloading":false,"msgs":[],"kit":"chamber 1 mag 10 spare [10,6]"},
    reloadSprint: {"midReload":true,"midAnim":true,"after":false,"afterAnim":false,"kit":"chamber 1 mag 9 spare [10,6]"},
    reloadNoSpares: {"reloading":false,"msgs":["no spare magazines"]},
    infinite: {"canFire":true,"shotsIn45f":4,"kit":"chamber 1 mag 0 spare []"},
    muzzleAhead: 0.26,
  },
  hud: {
    fresh: "div.gadgets(span.g{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot.sel(span.key{1} span.name{Five-seveN} span.rounds(i i i i i i i i i i i.chamber) span{10+1} span.mags(span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds]) span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
    lightOn: "div.gadgets(span.g.on{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot.sel(span.key{1} span.name{Five-seveN} span.rounds(i i i i i i i i i i i.chamber) span{10+1} span.mags(span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds]) span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
    holstered: "div.gadgets(span.g{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot.sel.holstered(span.key{1} span.name{Five-seveN} span.rounds(i i i i i i i i i i i.chamber) span{10+1} span.mags(span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds]) span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
    smokeUp: "div.gadgets(span.g{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot(span.key{1} span.name{Five-seveN} span.rounds(i i i i i i i i i i i.chamber) span{10+1} span.mags(span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds]) span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot.sel(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
    midReload: "div.gadgets(span.g{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot.sel(span.key{1} span.name{Five-seveN · reloading} span.rounds(i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.chamber) span{0+1} span.mags(span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=60%])[t=6 rounds]) span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
    reloaded: "div.gadgets(span.g{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot.sel(span.key{1} span.name{Five-seveN} span.rounds(i i i i i i i i i i i.chamber) span{10+1} span.mags(span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=100%])[t=10 rounds] span.mag(b[h=60%])[t=6 rounds]) span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
    dry: "div.gadgets(span.g{L LIGHT} span.g{N NIGHT VISION}) | div.cond.god(span.g.on{GOD MODE}) | div.slot.sel(span.key{1} span.name{Five-seveN} span.rounds(i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.spent i.spent) span{0+0} span.mags span.tag.ocp.on{OCP}(span.ocpbar(b[w=100%]))[t=the OCP on the pistol. With the pistol out, right-click to knock out the light under the reticle for a few seconds, or the flashlight of the guard under it. Then it recharges]) | div.slot.slung(span.key{2} span.name{FN2000} span.tag.on{SEMI} span.rounds(i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i i.chamber) span{30+1} span.mags(span.mag(b[h=100%])[t=30 rounds] span.mag(b[h=100%])[t=30 rounds]) span.tag.rings.on{RING ×5}[t=ring airfoils. When the tag is lit, they're loaded on right-click (press 2 again with the rifle up to switch to the 40 mm and back). Right-click to fire one, or hold it to see the arc first. A hit to the head knocks an enemy out and a hit to the body staggers him. You can't pick them back up] span.tag.rings.shells{40MM ×3}[t=40 mm high-explosive grenades. Press 2 again with the rifle up to put them on right-click (lit) in place of the RING. Right-click to fire one, or hold it to see the arc first. It goes off on what it hits with a frag grenade's blast, but only past its arming distance. Any closer and it's a dud. You can't pick them back up]) | div.slot(span.key{3} span.name{smoke} span.cans(i i i i) span{×4  G quick-throw}) | div.slot(span.key{4} span.name{stun} span.cans.bangs(i i) span{×2}) | div.slot(span.key{5} span.name{frag} span.cans.frags(i i) span{×2})",
  },
  guard: {
    firstShot: {"voice":"pistolLoud@1","card":{"ahead":0.09,"h":[0.03,0.03,0.08],"emissive":[90,50,16],"albedo":[1,0.8,0.5],"ttl":0.035},"cards":1,"flashes":[{"intensity":90,"range":8,"ttl":0.09,"color":[1,0.62,0.26],"owner":10},{"intensity":1.5,"range":2.5,"ttl":0.05,"color":[1,0.8,0.5],"owner":0}],"events":[{"kind":"guardShot","level":1,"loud":true}],"kicks":[],"counts":{"pistolLoud@1":1,"bodyHit@0.9":1}},
    rounds: 51,
    shotFrames: [18,79,116,154,212,246,309,362,407,463,501,563,667,724,785,827,878,926,969,1032,1082,1122,1178,1227,1331,1382,1424,1471,1511,1561,1599,1657,1708,1748,1783,1828,1932,1989,2049,2083,2124,2181,2228,2271,2316,2353,2398,2461,2565,2615,2671],
    gaps: [61,37,38,58,34,63,53,45,56,38,62,104,57,61,42,51,48,43,63,50,40,56,49,104,51,42,47,40,50,38,58,51,40,35,45,104,57,60,34,41,57,47,43,45,37,45,63,104,50,56],
    fireCdAfterEach: [1.010922,0.610503,0.631471,0.963998,0.559138,1.048398,0.880256,0.74888,0.922744,0.620524,1.031396,0.670439,0.944499,1.012875,0.688373,0.847818,0.787538,0.703867,1.04608,0.832387,0.657766,0.921083,0.816397,0.808636,0.846406,0.697012,0.771924,0.657523,0.825768,0.630132,0.959903,0.834706,0.655846,0.574084,0.736955,0.777352,0.939551,0.989791,0.561538,0.68182,0.933993,0.778074,0.711907,0.749261,0.602597,0.740444,1.03719,0.594132,0.823837,0.925545,1.046601],
    magOuts: ["magOut@0.5:f563","magOut@0.5:f1227","magOut@0.5:f1828","magOut@0.5:f2461"],
    reloadLines: ["reloading!:f563","reloading!:f1227","reloading!:f1828","reloading!:f2461"],
    otherLines: [],
    reloadTAtStart: [1.7,1.7,1.7,1.7],
    reloadSpansFrames: [103,103,103,103],
    hits: 51,
    restEvents: 50,
    eventKinds: ["guardShot:1:true"],
    restCards: 50,
    restFlashes: 100,
    bodyHits: ["bodyHit@0.9×50"],
    stateTrace: "aaaaaaaaa",
    muzzleAhead: 0.26,
    kill: {"state":"dead","downKind":"shot","downBy":"player","dropped":["pistol/fill0/who10/life239.95"],"gdDropped":"pistol/fill0","voice":"pistolSuppressed@1","events":[{"kind":"shot","level":0.6,"loud":false}],"bodyHit":["bodyHit@0.8"]},
  },
  oneShot: {
    downAtFrame: 18,
    roundsFiredUntilDown: 1,
    hitsTaken: 1,
    hitsLeft: 0,
    maxHits: 1,
    samDropped: ["pistol/fill1/who1/life239.9833"],
    bodyHit: ["bodyHit@0.9"],
    torchMan: {"torchBefore":true,"state":"dead","dropped":["torch/fill0/who11/life89.95"],"gdDropped":"torch","lightJustAfter":true,"lightAfter1s":false},
    drawnPatrolMan: {"drawnBefore":true,"state":"dead","dropped":["pistol/fill0/who10/life239.95"],"gdDropped":"pistol"},
    holsteredSam: {"down":true,"hitsLeft":0,"dropped":0},
  },
  props: {
    prop: "chair12#12",
    spot: [19.9,0,15.6],
    playerRound: {"voice":"pistolSuppressed@1","kicks":[{"J":4,"who":1,"thud":true}],"card":{"ahead":0.05,"h":[0.018,0.018,0.045],"emissive":[40,22,8],"albedo":[1,0.8,0.5],"ttl":0.035},"flashes":["40.5/8/0.09/[1,0.62,0.26]/o1","1.5/2.5/0.05/[1,0.8,0.5]/o0"],"events":[{"kind":"shot","level":0.6,"loud":false}],"counts":{"pistolSuppressed@1":1,"propThud@0.55":1,"bulletImpact@0.8":1}},
    guardRound: {"voice":"pistolLoud@1","kicks":[{"J":6,"who":10,"thud":true}],"card":{"ahead":0.09,"h":[0.03,0.03,0.08],"emissive":[90,50,16],"albedo":[1,0.8,0.5],"ttl":0.035},"flashes":["90/8/0.09/[1,0.62,0.26]/o10","1.5/2.5/0.05/[1,0.8,0.5]/o0"],"events":[{"kind":"guardShot","level":1,"loud":true}],"counts":{"pistolLoud@1":1,"bulletImpact@0.8":1}},
  },
};
