// AN ALERTED MAN DOES NOT WAIT AT A SHUT DOOR — the check behind src/game/doorforce.ts (DOORFORCE.on: on in the page, ?doorforce=0; off on the frozen
// stand, TPS_DOORFORCE=1).
//   bun run tools/qa/doorforce-check.ts [--verbose]      (also `probes.ts doorforce`, family doors; run it on BOTH stands: plain, and TPS_PROFILE=shipped in front)
// Headless, on the office: one of its own staff stood a few metres off a shut door, alert; the player stood close behind the leaf, hidden by it. What the
// man hears is real: footfalls filed where the player stands at the level his own walk files them, through the hearing model and the shut leaf. His rounds
// are real rounds (combat.ts fireWeapon), his boot the door's own kickIn. The check sets the rule, rounds through thin things (wallpen.ts) and the door
// splinter rule (doorblast.ts DOORSHOT) itself on either stand, and puts them back.
//   1  heard, a post    a man holding a post who hears walked footfalls behind a shut wooden leaf becomes sure, fires through it, never leaves his post
//   2  calm             the same sounds to a man who is not alert: nothing kept, no round
//   3  nobody           alert with nothing heard or seen behind the door: no round, no boot
//   4  crouched         a crouched tread behind the leaf: he never becomes sure
//   5  a free man       free to move, on the face the leaf opens away from: rounds first, then — no sooner than the set wait — he walks up and boots it in;
//                       his own side (and he) do not hear that boot as an intruder's
//   6  the frame        on the face it opens toward: no boot is thrown (the frame would hold it); he is left to its handle with the place as his fix
//   7  steel            a steel door: no round at any time, no boot
//   8  seen             a man who SAW him go behind it is sure at once and fires: handed the record a sighting leaves · 8b the real thing, the open leaf shut
//                       on a man who had the player in his eyes · 8c a place beside the door with the wall in his eyes' line is not behind it
//   9  a friend         a colleague stood past the door in the line: the rounds are held
//  10  splinters        with the door splinter rule on (and the boot put off to count them), his rounds take the leaf apart on its own count; none after
//  11  off              the rule off: the same staging, no state kept, no round, no boot
//  12  the journal      a recording from before the table replays with the rule off; one that carries it keeps its own word
// DOORFORCE_BREAK=1 = the module answers as if the switch were off: lines 1, 5, 6, 7, 8, 8b, 9 and 10 must fail.   exit 0 = all hold · 1 = one does not
type Vec3 = [number, number, number];
const VERBOSE = process.argv.includes('--verbose');

export async function doorforceCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
  const { DOORFORCE, DOORFORCE_STATS, DOORFORCE_LOG, doorForceBelief, doorForceOn, doorForceSaw } = await import(`${ROOT}/src/game/doorforce.ts`);
  const { DOORSHOT } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
  const { COVERFIRE_STATS } = await import(`${ROOT}/src/game/coverfire.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLPEN, WALLPEN_STATS } = await import(`${ROOT}/src/game/wallpen.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const DT = 1 / 60; const f2 = (x: number) => x.toFixed(2);
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = { on: DOORFORCE.on, pen: WALLPEN.on, men: WALLPEN.men, shot: DOORSHOT.on, destr: DESTRUCTION.on, oneWay: DOORWAY.oneWay, frame: DOORWAY.frameHolds, kickSecs: DOORFORCE.kickSecs };
  const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const zero = () => { for (const k of Object.keys(DOORFORCE_STATS)) (DOORFORCE_STATS as any)[k] = 0; DOORFORCE_LOG.length = 0; COVERFIRE_STATS.thruShots = 0; };

  /** a fresh office: the rule as asked, rounds through thin things on, the splinter rule as asked, every man but the one staged parked blind and deaf */
  const world = async (on: boolean, splinter = false) => {
    const W: any = await quiet(() => standUp()); const g = W.game;
    DOORFORCE.on = on; WALLPEN.on = true; WALLPEN.men = true; DOORSHOT.on = splinter; if (splinter) DESTRUCTION.on = true;   // AFTER standUp: the stand-up lines would otherwise write them back
    g.godMode = true; g.aiEnabled = true; g.playerInvisible = false; g.tune.tactics = false; zero();
    return W;
  };
  const park = (g: any, but: any[]) => g.guards.forEach((o: any, i: number) => { if (but.includes(o)) return; o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 25 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; o.char.update(0); });
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  /** the doors with floor `near` m out from one face for the player and `far` m out from the other for the man, a clear line each side to the leaf */
  const rigs = (g: any, steel: boolean, near: number, far: number) => {
    const out: { d: any; name: string; push: Vec3; pull: Vec3; pushFar: Vec3; pullFar: Vec3; mid: Vec3 }[] = [];
    for (const d of g.doors.list) {
      if (d.off || Math.abs(d.angle) > 0.02 || !!d.def.steel !== steel) continue;
      const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), W = d.def.width, mx = d.def.hinge[0] + ux * W * 0.5, mz = d.def.hinge[1] + uz * W * 0.5;
      const at = (s: number, off: number): Vec3 => [mx - uz * s * off, 0, mz + ux * s * off];
      const sPull = g.doors.pullFace(d, at(1, 1)) ? 1 : -1;   // the side the leaf opens toward
      const pull = at(sPull, near), push = at(-sPull, near), pullFar = at(sPull, far), pushFar = at(-sPull, far);
      if (![pull, push, pullFar, pushFar].every(p => free(g, p))) continue;
      const clear = (a: Vec3, b: Vec3) => { const dd = v3.sub([b[0], 1.2, b[2]], [a[0], 1.2, a[2]]), L = v3.len(dd); const h = g.col.raycast([a[0], 1.2, a[2]], v3.scale(dd, 1 / L), L - 0.25); return !!h && h.index >= 1e6 && g.col.dynamicBoxes[h.index - 1e6] === d.box && !g.props.raycast([a[0], 1.2, a[2]], v3.scale(dd, 1 / L), L); };
      if (!clear(pullFar, push) || !clear(pushFar, pull)) continue;
      out.push({ d, name: d.def.name, push, pull, pushFar, pullFar, mid: [mx, 0, mz] });
    }
    return out;
  };
  /** stand the man at `at`, alert, his gun toward `look`; `post` = holding a post */
  const man = (g: any, G: any, at: Vec3, look: Vec3, post: boolean, state = 'alert') => {
    const c = G.char; c.pos = v3.copy(at); c.vel = [0, 0, 0]; const yaw = Math.atan2(look[0] - at[0], look[2] - at[2]); c.bodyYaw = c.aimYaw = yaw;
    G.hold = post; G.pinned = post; G.state = state; G.awareness = state === 'alert' ? 1 : 0.1; G.foe = 'player'; G.reactT = 0; G.fireCd = 0.3; G.reloadT = -1; G.lastSeenT = -100; G.sightT = -100;
    G.lastKnown = state === 'alert' ? [look[0], 0, look[2]] : null; G.path = []; G.pathGoal = null; G.heardUpTo = g.eventSeq; G.dazzledUntil = -1; G.script = null; G.task = null; G.bodyDuty = null; G.flashlight.enabled = false; c.update(0);
  };
  /** run `secs`, the player treading at `at` (a footfall every `every` s at `level`: 0.26 is his walk, 0.125 his crouch — player.ts) while `steps` says so */
  const run = (W: any, secs: number, at: Vec3 | null, level: number, each?: () => void, every = 0.3) => {
    const g = W.game; let next = 0; const t0 = g.time;
    while (g.time - t0 < secs) {
      if (at && g.time - t0 >= next) { next += every; g.events.push({ kind: 'step', pos: v3.copy(at), time: g.time, loud: false, level }); }
      W.step(DT); each?.();
    }
  };

  try {
    const W0 = await world(true); const g0 = W0.game;
    const wood = rigs(g0, false, 0.9, 3.0), steel = rigs(g0, true, 0.9, 3.0);
    line(wood.length > 0, `the office has a shut wooden door with floor both sides and a clear line to its leaf (${wood.length} found${wood.length ? `: '${wood[0].name}'` : ''}; steel ${steel.length ? `'${steel[0].name}'` : 'none with floor both sides'})`);
    if (!wood.length) throw new Error('no door to stand at');
    const R = wood[0];
    const stage = async (on: boolean, o: { face: 'push' | 'pull'; post: boolean; state?: string; splinter?: boolean; rig?: typeof R } = { face: 'push', post: true }) => {
      const W = await world(on, !!o.splinter), g = W.game, rig = o.rig ?? R, d = g.doors.byName(rig.name), G = g.guards[0];
      // `face`: the face the MAN stands on — 'push' = the leaf opens away from him (a boot opens it), 'pull' = toward him (the frame holds a boot)
      const gAt = o.face === 'push' ? rig.pushFar : rig.pullFar, pAt = o.face === 'push' ? rig.pull : rig.push;
      park(g, [G]); g.teleportPlayer(v3.copy(pAt)); man(g, G, gAt, pAt, o.post, o.state ?? 'alert'); W.step(DT); man(g, G, gAt, pAt, o.post, o.state ?? 'alert');
      return { W, g, d, G, gAt, pAt };
    };
    const tell = () => VERBOSE && DOORFORCE_LOG.length ? `\n      ${DOORFORCE_LOG.join('\n      ')}` : '';

    // ------------------------------------------------------------ 1 heard, a post
    { const { W, g, d, G, gAt, pAt } = await stage(true, { face: 'push', post: true }); const l0 = WALLPEN_STATS.leaves; let sureAt = -1, fireAt = -1; const t0 = g.time;
      run(W, 8, pAt, 0.26, () => { const B = doorForceBelief(g, G, d); if (sureAt < 0 && B && B.sure >= DOORFORCE.sure) sureAt = g.time - t0; if (fireAt < 0 && DOORFORCE_STATS.shots > 0) fireAt = g.time - t0; });
      const moved = flat(G.char.pos, gAt), through = WALLPEN_STATS.leaves - l0;
      line(sureAt > 0 && DOORFORCE_STATS.shots >= DOORFORCE.rounds && through > 0 && moved < 0.3 && DOORFORCE_STATS.kicks === 0 && !d.off && d.isClosed(),
        `a man on a post, alert, 3 m off '${R.name}', the player walking close behind it: sure after ${f2(sureAt)} s (${Math.max(0, Math.ceil(sureAt / 0.3))} footfalls), his first round at ${f2(fireAt)} s, ${DOORFORCE_STATS.shots} rounds in 8 s of which ${through} crossed the leaf · he moved ${f2(moved)} m off his post · boots ${DOORFORCE_STATS.kicks} (want 0)${tell()}`); }

    // ------------------------------------------------------------ 2 calm
    { const { W, g, d, G, pAt } = await stage(true, { face: 'push', post: true, state: 'patrol' }); let kept = false;
      run(W, 6, pAt, 0.26, () => { if (doorForceBelief(g, G, d)) kept = true; if (G.state === 'alert') G.state = 'suspicious'; });
      line(!kept && DOORFORCE_STATS.shots === 0 && DOORFORCE_STATS.stands === 0, `the same footfalls to a man who is not alert: nothing kept of the door (${!kept}), rounds ${DOORFORCE_STATS.shots}, stands ${DOORFORCE_STATS.stands} (he ended '${G.state}')`); }

    // ------------------------------------------------------------ 3 nobody
    { const { W, g, d } = await stage(true, { face: 'push', post: false }); g.guards[0].lastKnown = null; g.guards[0].hold = true;
      run(W, 8, null, 0);
      line(DOORFORCE_STATS.shots === 0 && DOORFORCE_STATS.kicks === 0 && DOORFORCE_STATS.stands === 0 && d.isClosed() && !d.lockBroken, `alert with nothing heard or seen behind the door, 8 s: rounds ${DOORFORCE_STATS.shots}, boots ${DOORFORCE_STATS.kicks}, the door shut and whole`); }

    // ------------------------------------------------------------ 4 crouched
    { const { W, g, d, G, pAt } = await stage(true, { face: 'push', post: true }); let top = 0;
      run(W, 10, pAt, 0.125, () => { top = Math.max(top, doorForceBelief(g, G, d)?.sure ?? 0); }, 0.4);
      line(top < DOORFORCE.sure && DOORFORCE_STATS.shots === 0, `a crouched tread behind the leaf for 10 s: the surest he got was ${f2(top)} (under ${DOORFORCE.sure}), rounds ${DOORFORCE_STATS.shots}`); }

    // ------------------------------------------------------------ 5 a free man boots it in
    // (until he is sure he is kept where he was stood: left to himself a free man walks to his last fix, which is the door's handle — the build as it was.
    //  A colleague stands a few metres behind him with his ears open: the boot is his own side's, not an intruder at a door)
    { const { W, g, d, G, pAt, gAt } = await stage(true, { face: 'push', post: false }); let standAt = -1, kickAt = -1, shotsAtKick = 0, walked = 0, stoodFor = 0, fix: Vec3 | null = null; const t0 = g.time; let last = v3.copy(gAt);
      const M = g.guards[1], back = v3.normalize(v3.sub(gAt, pAt)); let mAt: Vec3 | null = null; for (const r of [4, 3, 5, 2.5]) { const q: Vec3 = [gAt[0] + back[0] * r, 0, gAt[2] + back[2] * r]; if (free(g, q)) { mAt = q; break; } }
      if (mAt) { M.char.pos = v3.copy(mAt); M.char.update(0); M.dazzledUntil = -1; M.heardUpTo = g.eventSeq; M.state = 'patrol'; M.awareness = 0; M.hold = true; M.pinned = true; M.witness.heard.kick = 0; }
      run(W, 16, pAt, 0.26, () => {
        if (mAt) { M.char.pos = v3.copy(mAt); M.char.vel = [0, 0, 0]; }
        if (DOORFORCE_STATS.stands === 0) { G.char.pos = v3.copy(gAt); G.char.vel = [0, 0, 0]; G.path = []; G.pathGoal = null; return; }
        if (standAt < 0) standAt = g.time - t0;
        const O = doorForceOn(g, G); if (O && !O.kick) stoodFor = Math.max(stoodFor, flat(G.char.pos, gAt)); if (O?.kick === 'walk') walked += flat(G.char.pos, last); last = v3.copy(G.char.pos);
        if (kickAt < 0 && DOORFORCE_STATS.kicks > 0) { kickAt = g.time - t0; shotsAtKick = DOORFORCE_STATS.shots; }
        if (kickAt > 0 && !fix && g.time - t0 - kickAt > 0.1) fix = G.lastKnown ? v3.copy(G.lastKnown) : null; });
      const wait = kickAt - standAt, theirs = mAt ? M.witness.heard.kick : 0;
      line(standAt > 0 && shotsAtKick > 0 && stoodFor < 0.3 && walked > 1 && DOORFORCE_STATS.kicks === 1 && DOORFORCE_STATS.gave === 1 && d.lockBroken && !d.isClosed() && wait >= DOORFORCE.kickSecs - 0.05 && !!fix && flat(fix!, pAt) < 1 && theirs === 0 && G.witness.heard.kick === 0,
        `a free man on the face '${R.name}' opens away from: on it at ${f2(standAt)} s, stood (${f2(stoodFor)} m) and put ${shotsAtKick} rounds through it, then walked ${f2(walked)} m up to it and booted it ${f2(wait)} s after he began (no sooner than ${DOORFORCE.kickSecs}): boots ${DOORFORCE_STATS.kicks}, gave ${DOORFORCE_STATS.gave}, the keep broken ${d.lockBroken}, the leaf at ${f2(d.angle)} rad · his fix after it ${fix ? f2(flat(fix, pAt)) : '—'} m from the player · the boot heard as an intruder's by him ${G.witness.heard.kick}, by a colleague ${mAt ? `${f2(flat(mAt, gAt))} m behind him ${theirs}` : '(no floor for one)'} (want 0)${tell()}`); }

    // ------------------------------------------------------------ 6 the frame would hold a boot
    // (the frame rule is the one-way doors' — doors.ts DOORWAY — which the frozen stand holds off: raised here on either stand, AFTER the stand-up)
    { const { W, g, d, G, pAt } = await stage(true, { face: 'pull', post: false }); DOORWAY.oneWay = true; DOORWAY.frameHolds = true; let left = -1, fix: Vec3 | null = null; const t0 = g.time;
      run(W, 9, pAt, 0.26, () => { if (left < 0 && DOORFORCE_STATS.noKick > 0) { left = g.time - t0; fix = G.lastKnown ? v3.copy(G.lastKnown) : null; } });
      line(left > 0 && DOORFORCE_STATS.kicks === 0 && !d.lockBroken && !!fix && flat(fix!, pAt) < 1,
        `the same man on the face it opens toward: no boot thrown (${DOORFORCE_STATS.kicks}; the keep whole ${!d.lockBroken}) — at ${f2(left)} s he is left to its handle, his fix ${fix ? f2(flat(fix, pAt)) : '—'} m from where the player stands (rounds first: ${DOORFORCE_STATS.shots})${tell()}`);
      DOORWAY.oneWay = was.oneWay; DOORWAY.frameHolds = was.frame; }

    // ------------------------------------------------------------ 7 steel
    // (a level's own steel door where one has floor both sides; else the same wooden door with its leaf made steel — DoorDef.steel, read live by every rule that asks)
    { const own = steel[0]; const { W, g, d, G, pAt, gAt } = await stage(true, { face: 'push', post: false, rig: own ?? R }); const wasSteel = d.def.steel; d.def.steel = true; let sure = 0;
      run(W, 10, pAt, 0.26, () => { if (DOORFORCE_STATS.stands === 0) { G.char.pos = v3.copy(gAt); G.char.vel = [0, 0, 0]; G.path = []; G.pathGoal = null; } sure = Math.max(sure, doorForceBelief(g, G, d)?.sure ?? 0); });
      line(sure >= DOORFORCE.sure && DOORFORCE_STATS.shots === 0 && DOORFORCE_STATS.kicks === 0 && DOORFORCE_STATS.noKick === 1 && !d.lockBroken, `a steel door (${own ? `'${own.name}'` : `'${R.name}' with its leaf made steel`}), a free man as sure as before (${f2(sure)}): rounds ${DOORFORCE_STATS.shots}, boots ${DOORFORCE_STATS.kicks} (want 0 and 0) — left to its handle ${DOORFORCE_STATS.noKick} time(s)${tell()}`);
      d.def.steel = wasSteel; }

    // ------------------------------------------------------------ 8 seen
    { const { W, g, d, G, pAt } = await stage(true, { face: 'push', post: true }); const l0 = WALLPEN_STATS.leaves; doorForceSaw(g, G, pAt, 0.2); W.step(DT); W.step(DT);
      const B = doorForceBelief(g, G, d); run(W, 4, null, 0); const fired = DOORFORCE_STATS.shots + COVERFIRE_STATS.thruShots;
      line(!!B && B.seen && B.sure >= DOORFORCE.sure && DOORFORCE_STATS.stands === 1 && fired > 0 && WALLPEN_STATS.leaves > l0, `a man handed the record a sighting leaves, of the player where he stands behind the leaf: sure ${B ? f2(B.sure) : '—'} at once, on the door ${DOORFORCE_STATS.stands === 1}, rounds through it ${fired} (this rule's ${DOORFORCE_STATS.shots}, coverfire.ts's ${COVERFIRE_STATS.thruShots})${tell()}`); }
    // 8b the tick's own hand-off: his eyes' stamp held on the player for a quarter of a second (Guard.lastSeenT, what the eye test writes — the light meter
    //    that decides a real sighting is not this harness's to drive), then let go with the shut leaf between them
    { const { W, g, d, G, pAt } = await stage(true, { face: 'push', post: true }); const l0 = WALLPEN_STATS.leaves;
      for (let i = 0; i < 15; i++) { G.lastSeenT = g.time + DT; W.step(DT); }
      zero(); run(W, 6, null, 0); const fired = DOORFORCE_STATS.shots + COVERFIRE_STATS.thruShots, B = doorForceBelief(g, G, d);
      line(DOORFORCE_STATS.seen === 1 && DOORFORCE_STATS.stands === 1 && fired > 0 && WALLPEN_STATS.leaves > l0, `the game's own hand-off — his eyes' stamp on the player for 15 frames, then lost with the shut leaf in his line to him: sightings put behind it ${DOORFORCE_STATS.seen}, on the door ${DOORFORCE_STATS.stands === 1}, rounds through it ${fired} (this rule's ${DOORFORCE_STATS.shots}, coverfire.ts's ${COVERFIRE_STATS.thruShots})${B ? '' : ' · the belief spent'}${tell()}`); }
    // 8c not behind it: the WALL and not the leaf in his eyes' line to the place he last saw the man — the far side of the same wall is not "behind the door"
    { const { W, g, d, G, pAt, gAt } = await stage(true, { face: 'push', post: true }); const u = d.dir(); let did = false;
      const wallFirst = (from: Vec3, at: Vec3) => { const a: Vec3 = [from[0], 1.5, from[2]], dd = v3.sub([at[0], DOORFORCE.chestY, at[2]], a), L = v3.len(dd), h = g.col.raycast(a, v3.scale(dd, 1 / L), L); return !!h && h.index < 1e6; };
      // (a place beside the door behind its wall, the man where he was; else the place behind the leaf and the man moved along his own side until the wall is in the way)
      const tries: { at: Vec3; from: Vec3 }[] = [];
      for (const k of [1.3, -1.3, 1.8, -1.8, 1.0, -1.0]) { const q = k + Math.sign(k) * d.def.width * 0.5; tries.push({ at: [pAt[0] + u[0] * q, 0, pAt[2] + u[1] * q], from: gAt }); }
      for (const k of [2, -2, 3, -3, 4, -4]) tries.push({ at: pAt, from: [gAt[0] + u[0] * k, 0, gAt[2] + u[1] * k] });
      for (const T of tries) { if (!free(g, T.at) || !free(g, T.from) || !wallFirst(T.from, T.at) || g.doors.side(d, T.at) === g.doors.side(d, T.from) || flat(T.at, R.mid) > DOORFORCE.behindM) continue; did = true;
        G.char.pos = v3.copy(T.from); G.char.update(0); doorForceSaw(g, G, T.at, 0.2); for (let i = 0; i < 4; i++) { W.step(DT); G.char.pos = v3.copy(T.from); } const B = doorForceBelief(g, G, d);
        line(!B && DOORFORCE_STATS.seen === 0 && DOORFORCE_STATS.stands === 0, `a sighting ${f2(flat(T.at, R.mid))} m from the door's middle on its far side with the wall, not the leaf, in his eyes' line to it (he ${f2(flat(T.from, gAt))} m from where line 8 stood him): nothing kept of the door (${!B}), on it ${DOORFORCE_STATS.stands > 0}`); break; }
      if (!did) console.log('- note — no place here with the wall in his line to a spot behind the door: line 8c not run'); }

    // ------------------------------------------------------------ 9 a friend past the door
    { const { W, g, G, pAt, gAt } = await stage(true, { face: 'push', post: true }); const M = g.guards[1];
      const dir = v3.normalize(v3.sub(pAt, gAt)); const mAt: Vec3 = [pAt[0] + dir[0] * 0.9, 0, pAt[2] + dir[2] * 0.9];
      const ok = free(g, mAt); if (ok) { M.char.pos = v3.copy(mAt); M.char.update(0); }
      run(W, 6, pAt, 0.26, () => { if (ok) { M.char.pos = v3.copy(mAt); M.char.vel = [0, 0, 0]; } });
      if (ok) line(DOORFORCE_STATS.stands > 0 && DOORFORCE_STATS.shots === 0 && DOORFORCE_STATS.heldFriend > 0, `a colleague stood ${f2(flat(mAt, pAt))} m past the player in the line: on the door ${DOORFORCE_STATS.stands > 0}, rounds ${DOORFORCE_STATS.shots} (want 0), frames held for him ${DOORFORCE_STATS.heldFriend}`);
      else console.log('- note — no floor a stride past the player in the line: line 9 (a friend) not run here');
      void G; }

    // ------------------------------------------------------------ 10 the leaf splinters under his rounds
    // (the office's staff carry pistols: two dozen of those take a leaf apart, more than he fires before the boot — so the boot is put off here to count them)
    { DOORFORCE.kickSecs = 60; const { W, g, d, G, pAt, gAt } = await stage(true, { face: 'push', post: false, splinter: true }); g.tune.chaos = 0.5; let offAt = -1, at = 0; const t0 = g.time;
      run(W, 45, pAt, 0.26, () => { if (DOORFORCE_STATS.stands === 0) { G.char.pos = v3.copy(gAt); G.char.vel = [0, 0, 0]; G.path = []; G.pathGoal = null; } if (offAt < 0 && d.off) { offAt = g.time - t0; at = DOORFORCE_STATS.shots; } });
      DOORFORCE.kickSecs = was.kickSecs;
      line(d.off && offAt > 0 && DOORFORCE_STATS.kicks === 0 && DOORFORCE_STATS.shots <= at + 1, `with the door splinter rule on (doorblast.ts) and the boot put off: his rounds take the leaf apart at ${f2(offAt)} s, his ${at}th through it, and with the frame open he lays no more through it (${DOORFORCE_STATS.shots - at} after), boots ${DOORFORCE_STATS.kicks}${tell()}`); }

    // ------------------------------------------------------------ 11 off
    { const { W, g, d, G, pAt } = await stage(false, { face: 'push', post: true }); let kept = false;
      run(W, 8, pAt, 0.26, () => { if (doorForceBelief(g, G, d) || doorForceOn(g, G)) kept = true; });
      line(!kept && DOORFORCE_STATS.shots === 0 && DOORFORCE_STATS.kicks === 0 && DOORFORCE_STATS.heard === 0 && d.isClosed(), `the rule off, the staging of line 1: nothing kept (${!kept}), sounds counted ${DOORFORCE_STATS.heard}, rounds ${DOORFORCE_STATS.shots}, boots ${DOORFORCE_STATS.kicks}`); }

    // ------------------------------------------------------------ 12 the journal
    { const g = g0, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      DOORFORCE.on = true; const old = snap(); delete old.tables.DOORFORCE; applyKnobs(g, old); const before = DOORFORCE.on;
      DOORFORCE.on = false; const own = snap(); own.tables.DOORFORCE.on = true; applyKnobs(g, own); const carried = DOORFORCE.on;
      line(before === false && carried === true, `a recording from before the table replays with the rule off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { DOORFORCE.on = was.on; DOORFORCE.kickSecs = was.kickSecs; WALLPEN.on = was.pen; WALLPEN.men = was.men; DOORSHOT.on = was.shot; DESTRUCTION.on = was.destr; DOORWAY.oneWay = was.oneWay; DOORWAY.frameHolds = was.frame; }
  console.log(failed ? '=== doorforce-check: FAIL ===' : '=== doorforce-check: ALL PASS ===');
  return !failed;
}

if (import.meta.main) { const ok = await doorforceCheck(); process.exit(ok ? 0 : 1); }
