// A DOOR SWUNG OR KICKED INTO A MAN THROWS HIM (src/game/doors.ts DOORTHROW, src/game/doorthrow.ts; the maintainer: 'opening a door into the enemy should
// majorly confuse them' · 'kicking down a door when an enemy on the side should stun or knock them out').
//   bun run tools/qa/doorthrow-check.ts        (or: bun run tools/qa/probes.ts doorthrow)        exit 0 = every line PASS, 1 = a FAIL line
// Headless, on the office, at one wooden door with open floor on the side it opens into; nothing here looks at a picture. The rule is set by the check itself
// on either stand (the frozen stand holds it off, and its doors swing both ways: the lines hold on both).
//   fault      the rule off: Sam walks at a shut door with a man stood behind it — the man holds it shut on him, and nothing happens to the man
//   walked     the rule on, the same walk: the man is carried clear, folded and blind for DOORTHROW.pushSecs, the door opens, and he is up again after it,
//              alert toward the doorway, unhurt
//   shoved     a leaf flung open (a door order's shove), and the player's own push at it (Doors.use): the same, by the push's seconds
//   booted     a boot (Doors.kickIn) with the man stood right at the door: folded and blind for DOORTHROW.kickSecs, on a knee for it, unhurt; a man stood
//              further round the swing: the boot's seconds, on his feet
//   sam        a defender's boot onto Sam: folded for the boot's seconds (SAMSTUN reads it: shown on the shipped stand), in a crouch, not down
//   teammate   a defender's boot onto one of Sam's men: the same as any man, and he comes back alert toward the door
//   calm       a defender who is not alert walking a door open onto one of Sam's men: nothing; the same man alert: thrown
//   own side   a man walking a door open onto one of his own side, or flinging it: nothing (the leaf stops against him); the same walk by a foe: thrown;
//              a BOOT throws a man of the kicker's own side like anyone
//   not        eased by a hand, leaned open slower than DOORTHROW.minSpeed, set open by a script in one frame, walked open at a crouch, pulled toward the men on its pull face (one-way doors), swinging shut, a man walking into a leaf
//              himself: nobody is thrown
//   again      a man just up from a fold is not thrown again inside DOORTHROW.again
//   checkpoint a man on a knee, saved and loaded into a fresh game, is still folded and on his knee to the same clock
//   journal    a recording from before the table replays with the rule off; one that carries it keeps its own word
// DOORTHROW_BREAK=1: the rule is left off where the lines want it on — red.
type Vec3 = [number, number, number];
const BREAK = process.env.DOORTHROW_BREAK === '1';

export async function doorthrowCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { DOORTHROW, DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
  const { DOORTHROW_STATS } = await import(`${ROOT}/src/game/doorthrow.ts`);
  const { samStaggered } = await import(`${ROOT}/src/game/samstun.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { EASE_RATE, EASE_MAX } = await import(`${ROOT}/src/game/player.ts`);
  const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const DT = 1 / 60, SHIPPED = process.env.TPS_PROFILE === 'shipped', T = DOORTHROW; const f2 = (x: number) => x.toFixed(2);
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <R>(fn: () => Promise<R> | R): Promise<R> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = T.on;
  const park = (g: any) => g.guards.forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 25 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; });
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  /** the door's own frame gives every place: `along` m from the hinge along the shut leaf, `out` m to the side it opens into (negative: the face it is pushed from) */
  const frame = (d: any) => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], S = d.swing, n = [-u[1] * S, u[0] * S], h = d.def.hinge, W = d.def.width as number;
    return { W, S, n, pt: (along: number, out: number): Vec3 => [h[0] + u[0] * along + n[0] * out, 0, h[1] + u[1] * along + n[1] * out], out: (p: Vec3) => (p[0] - h[0]) * n[0] + (p[2] - h[1]) * n[1] }; };
  /** a shut wooden door with standing room before it and open floor all through the side it opens into */
  const pick = (g: any): string | null => {
    for (const d of g.doors.list) {
      if (d.def.steel || d.off || Math.abs(d.angle) > 0.02 || Math.abs(d.swing > 0 ? d.maxA : d.minA) < 1.4) continue;
      const F = frame(d); let ok = free(g, F.pt(F.W * 0.6, -1.4)) && free(g, F.pt(F.W * 0.6, -0.7));
      for (let a = -0.2; a <= F.W + 0.9 && ok; a += 0.3) for (let o = 0.75; o <= 2.1 && ok; o += 0.3) ok = free(g, F.pt(a, o));   // (nearer the wall than that the walk grid is shut: bodies stand there all the same)
      if (ok) return d.def.name;
    }
    return null;
  };
  /** a fresh office, the rule as asked, everybody parked far off, no AI */
  const world = async (on: boolean) => {
    const W: any = await quiet(() => standUp()); const g = W.game; T.on = on && !BREAK;   // AFTER standUp: the stand-up line would otherwise write it back
    g.aiEnabled = false; g.playerInvisible = true; park(g); for (const d of g.doors.list) d.locked = false;
    for (const k of Object.keys(DOORTHROW_STATS)) (DOORTHROW_STATS as any)[k] = 0;
    return W;
  };
  /** stand a parked man at `p`, awake and whole, of `team` */
  const stand = (g: any, i: number, p: Vec3, team?: string) => { const o = g.guards[i]; o.dazzledUntil = -1; o.staggerUntil = -1; o.awareness = 0; if (team) o.team = team; o.char.pos[0] = p[0]; o.char.pos[2] = p[2]; o.char.update(0); return o; };
  const sam = (g: any, p: Vec3) => { g.teleportPlayer([p[0], 0, p[2]]); return g.player; };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const folded = (g: any, o: any) => Math.min(o.staggerUntil, o.dazzledUntil) - g.time;
  /** walk `pos` at the door from its push face for `secs`, a stride a frame (the leaves read where a body is, whoever moved it) */
  const walk = (W: any, F: any, who: any, secs: number, speed: number, each?: () => void) => { for (let i = 0; i < secs * 60; i++) { const pos = who.char.pos; pos[0] += F.n[0] * speed * DT; pos[2] += F.n[1] * speed * DT; W.step(DT); each?.(); } };   // (his place is read afresh each frame: a walker's is a new array every step)

  try {
    const W0 = await world(true), name = pick(W0.game);
    line(!!name, `the office has a shut wooden door with standing room before it and open floor where it swings (${name ? `'${name}', ${f2(W0.game.doors.byName(name).def.width)} m, doors swing ${DOORWAY.oneWay ? 'one way' : 'both ways'} on this stand` : 'NONE'})`);
    if (!name) throw new Error('no door to stage at');
    const door = (g: any) => g.doors.byName(name);
    const BEHIND = 0.48;   // m off the shut leaf: a hand's breadth clear of it

    // ------------------------------------------------------------ the fault, and the walk with the rule on
    const walked = async (on: boolean) => {
      const W = await world(on), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), v = stand(g, 0, p0), pl = sam(g, F.pt(F.W * 0.6, -1.3));
      let wide = 0, fold = -1; walk(W, F, pl, 2.5, 1.6, () => { wide = Math.max(wide, Math.abs(d.angle)); if (fold < 0 && folded(g, v) > 0) fold = folded(g, v); });
      const moved = flat(v.char.pos, p0), through = F.out(pl.char.pos); for (let i = 0; i < (T.pushSecs + 0.3) * 60; i++) W.step(DT);
      return { g, v, wide, fold, moved, through, up: folded(g, v) <= 0, pushed: DOORTHROW_STATS.pushed, kicked: DOORTHROW_STATS.kicked };
    };
    { const r = await walked(false);
      line(r.fold < 0 && r.pushed === 0 && r.wide < 0.5 && r.moved < 0.15 && r.through < 0, `the rule off: Sam walks at the shut door for 2.5 s with a man stood ${BEHIND} m behind it — the man is not folded (${r.fold < 0}), is moved ${f2(r.moved)} m, the leaf never stands wider than ${f2(r.wide)} rad and Sam is still ${f2(-r.through)} m short of the frame: he holds it shut, as he did`); }
    { const r = await walked(true), v = r.v;
      line(r.fold > T.pushSecs - 0.1 && r.fold <= T.pushSecs + 1e-6 && r.pushed === 1 && r.kicked === 0 && r.moved > 0.2 && r.wide > 0.9 && r.through > 0,
        `the rule on, the same walk: the man is folded and blind ${f2(r.fold)} s (want ${T.pushSecs}: the push's seconds), carried ${f2(r.moved)} m, the leaf stands ${f2(r.wide)} rad wide and Sam is ${f2(r.through)} m through the frame · thrown ${r.pushed} time(s)`);
      line(r.up && v.state !== 'dead' && !v.wound && v.state === 'alert' && v.doorDownUntil < 0, `after it he is up again (${r.up}), alive and unwounded, alert (state ${v.state}) and never on a knee: a push does not floor a man`); }

    // ------------------------------------------------------------ a leaf flung open
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), v = stand(g, 0, p0); sam(g, F.pt(F.W * 0.6, -1.3));
      W.step(DT); d.latched = false; d.closing = false; d.vel = F.S * 5.5; d.quietT = -1; d.lastWho = PLAYER_ID;
      let fold = -1; for (let i = 0; i < 60; i++) { W.step(DT); if (fold < 0 && folded(g, v) > 0) fold = folded(g, v); }
      line(fold > T.pushSecs - 0.1 && fold <= T.pushSecs + 1e-6 && DOORTHROW_STATS.pushed === 1 && DOORTHROW_STATS.kicked === 0 && flat(v.char.pos, p0) > 0.2 && Math.abs(d.angle) > 1.0,
        `a leaf flung open at a door order's 5.5 rad/s: the man behind it is folded and blind ${f2(fold)} s (want ${T.pushSecs}), carried ${f2(flat(v.char.pos, p0))} m, and the leaf swings on to ${f2(Math.abs(d.angle))} rad`); }

    // ------------------------------------------------------------ the player's own push at the door (Doors.use)
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), v = stand(g, 0, p0), from = F.pt(F.W * 0.7, -0.7); sam(g, from);
      W.step(DT); g.doors.use(d, from, PLAYER_ID);
      let fold = -1; for (let i = 0; i < 60; i++) { W.step(DT); if (fold < 0 && folded(g, v) > 0) fold = folded(g, v); }
      line(fold > T.pushSecs - 0.1 && fold <= T.pushSecs + 1e-6 && DOORTHROW_STATS.pushed === 1 && DOORTHROW_STATS.kicked === 0, `the player's own push at the door from the face it opens away from (Doors.use): the man behind it is folded and blind ${f2(fold)} s (want ${T.pushSecs}), carried ${f2(flat(v.char.pos, p0))} m`); }

    // ------------------------------------------------------------ a boot
    let snapKnee: any = null, kneeUntil = 0;
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), v = stand(g, 0, p0), from = F.pt(F.W * 0.7, -0.76); sam(g, from);
      W.step(DT); const gave = g.doors.kickIn(d, from, PLAYER_ID);
      let fold = -1; for (let i = 0; i < 30; i++) { W.step(DT); if (fold < 0 && folded(g, v) > 0) fold = folded(g, v); }
      const knee = v.doorDownUntil - g.time, pose = v.char.anim.crouchTarget;
      line(gave && fold > T.kickSecs - 0.1 && fold <= T.kickSecs + 1e-6 && DOORTHROW_STATS.kicked === 1 && DOORTHROW_STATS.floored === 1 && knee > T.kickSecs - 0.7 && pose === 1 && flat(v.char.pos, p0) > 0.3 && Math.abs(d.angle) > 1.0 && v.state !== 'dead' && !v.wound,
        `a boot with a man stood right at the door: folded and blind ${f2(fold)} s (want ${T.kickSecs}: the boot's seconds), on a knee for it (${f2(knee)} s left, the animator's crouch at ${pose}), carried ${f2(flat(v.char.pos, p0))} m, the leaf in to ${f2(Math.abs(d.angle))} rad, alive and unwounded (${v.state})`);
      snapKnee = JSON.parse(JSON.stringify(saveState(g))); kneeUntil = v.doorDownUntil;
      for (let i = 0; i < (T.kickSecs + 0.2) * 60; i++) W.step(DT);
      line(folded(g, v) <= 0 && v.char.anim.crouchTarget === 0 && v.state !== 'dead', `…and ${f2(T.kickSecs)} s on he is off his knee (crouch ${v.char.anim.crouchTarget}) and no longer folded`); }
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.3, 0.85), v = stand(g, 0, p0), from = F.pt(F.W * 0.7, -0.76); sam(g, from);
      W.step(DT); g.doors.kickIn(d, from, PLAYER_ID);
      let fold = -1; for (let i = 0; i < 30; i++) { W.step(DT); if (fold < 0 && folded(g, v) > 0) fold = folded(g, v); }
      line(fold > T.kickSecs - 0.1 && DOORTHROW_STATS.kicked === 1 && DOORTHROW_STATS.floored === 0 && v.doorDownUntil < 0, `the same boot with the man stood further round the swing (0.85 m off the leaf, by the hinge): the boot's seconds (${f2(fold)} s) and on his feet (floored ${DOORTHROW_STATS.floored})`); }

    // ------------------------------------------------------------ a defender's boot: Sam, and one of his men
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), from = F.pt(F.W * 0.7, -0.76), k = stand(g, 1, from, 'hostile'), pl = sam(g, p0);
      W.step(DT); g.doors.kickIn(d, from, k.char.id);
      let fold = -1, shown = false; for (let i = 0; i < 30; i++) { W.step(DT); if (fold < 0 && pl.staggerUntil > g.time) { fold = pl.staggerUntil - g.time; shown = samStaggered(g); } }
      const moved = flat(pl.char.pos, p0);
      line(fold > T.kickSecs - 0.1 && !pl.down && DOORTHROW_STATS.kicked === 1 && (SHIPPED ? shown && pl.crouch === true && moved > 0.2 : !shown && !pl.crouch && pl.fireCd < 0.5),
        `a defender's boot with Sam right at the door: the fold's clock ${f2(fold)} s (want ${T.kickSecs}), not down (${!pl.down})${SHIPPED ? ` · rooted with his gun low for it (${shown}), put in a crouch (${pl.crouch}), carried ${f2(moved)} m` : ` · this stand holds the player's fold off (SAMSTUN): the clock is written and nothing else of his changes (folded ${shown}, crouch ${pl.crouch}, his gun free)`}`); }
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), from = F.pt(F.W * 0.7, -0.76), k = stand(g, 1, from, 'hostile'), m = stand(g, 0, p0, 'operative'); sam(g, F.pt(F.W * 0.6, -3));
      W.step(DT); g.doors.kickIn(d, from, k.char.id);
      let fold = -1, aw = 0; for (let i = 0; i < 30; i++) { W.step(DT); if (fold < 0 && folded(g, m) > 0) { fold = folded(g, m); aw = m.awareness; } }
      line(fold > T.kickSecs - 0.1 && m.doorDownUntil > g.time && aw >= T.aware - 0.05 && m.state !== 'dead', `a defender's boot with one of Sam's men right at the door: folded and blind ${f2(fold)} s, on a knee, his awareness raised by a foe's leaf (${f2(aw)} as it met him), alive`); }

    // ------------------------------------------------------------ his own side's walk is not a throw; a foe's is
    const mates = async (teamA: string, teamB: string, stateA?: string) => {
      const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), b = stand(g, 0, p0, teamB), a = stand(g, 1, F.pt(F.W * 0.6, -1.0), teamA); sam(g, F.pt(F.W * 0.6, -4));
      let fold = -1; walk(W, F, a, 2, 1.4, () => { if (stateA) a.state = stateA; if (fold < 0 && folded(g, b) > 0) fold = folded(g, b); });
      return { fold, thrown: DOORTHROW_STATS.pushed + DOORTHROW_STATS.kicked, moved: flat(b.char.pos, p0) };
    };
    { const calm = await mates('hostile', 'operative'), hot = await mates('hostile', 'operative', 'alert');
      line(calm.fold < 0 && calm.thrown === 0 && hot.fold > T.pushSecs - 0.1 && hot.thrown === 1, `a defender who is not alert walking the door open onto one of Sam's men: nobody thrown (${calm.thrown}: a calm man opens a door with his hand) · the same defender alert: thrown (${hot.thrown}), folded ${f2(hot.fold)} s`); }
    { const own = await mates('hostile', 'hostile', 'alert'), foe = await mates('operative', 'hostile');
      line(own.fold < 0 && own.thrown === 0 && foe.fold > T.pushSecs - 0.1 && foe.thrown === 1, `a man walking the door open onto one of his own side: nobody thrown (${own.thrown}), the man behind it moved ${f2(own.moved)} m · the same walk by a foe: thrown (${foe.thrown}), folded ${f2(foe.fold)} s`); }

    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), m = stand(g, 0, p0, 'operative'), from = F.pt(F.W * 0.7, -0.76); sam(g, from);
      W.step(DT); d.latched = false; d.closing = false; d.vel = F.S * 5.5; d.quietT = -1; d.lastWho = PLAYER_ID; for (let i = 0; i < 60; i++) W.step(DT);
      const flung = DOORTHROW_STATS.pushed + DOORTHROW_STATS.kicked, calm = m.staggerUntil < 0;
      d.angle = 0; d.vel = 0; d.latched = true; d.drive = null; d.place(); m.char.pos[0] = p0[0]; m.char.pos[2] = p0[2]; m.char.update(0); W.step(DT); g.doors.kickIn(d, from, PLAYER_ID); for (let i = 0; i < 30; i++) W.step(DT);
      line(flung === 0 && calm && DOORTHROW_STATS.kicked === 1 && folded(g, m) > 0, `Sam's own leaf and one of his men behind it: flung at 5.5 rad/s nobody is thrown (${flung}) · BOOTED he is (${DOORTHROW_STATS.kicked}): only a boot throws a man of the kicker's own side`); }

    // ------------------------------------------------------------ not a throw
    { const out: string[] = []; let bad = false; const note = (ok: boolean, s: string) => { if (!ok) bad = true; out.push(`${s}: ${ok ? 'nobody' : 'THROWN'}`); };
      const none = (g: any, v: any) => DOORTHROW_STATS.pushed + DOORTHROW_STATS.kicked === 0 && v.staggerUntil < 0;
      { const W = await world(true), g = W.game, d = door(g), F = frame(d), v = stand(g, 0, F.pt(F.W * 0.6, BEHIND)), pl = sam(g, F.pt(F.W * 0.7, -0.62));   // eased by a hand
        for (let i = 0; i < 180; i++) { g.doors.crack(d, pl.char.pos, PLAYER_ID, DT, undefined, EASE_RATE, EASE_MAX); W.step(DT); } note(none(g, v), 'a leaf eased by a hand into him'); }
      { const W = await world(true), g = W.game, d = door(g), F = frame(d), v = stand(g, 0, F.pt(F.W * 0.6, BEHIND)), pl = sam(g, F.pt(F.W * 0.6, -1.3)); pl.crouch = true;   // walked open at a crouch
        walk(W, F, pl, 2.5, 0.8, () => { pl.crouch = true; }); note(none(g, v), 'walked open at a crouch'); }
      if (DOORWAY.oneWay) { const W = await world(true), g = W.game, d = door(g), F = frame(d), v = stand(g, 0, F.pt(F.W + 0.45, 0.5)), u = stand(g, 1, F.pt(F.W * 0.5, 0.6)); sam(g, F.pt(F.W * 0.6, -4));   // pulled toward the men on its pull face
        W.step(DT); g.doors.pull(d, v.char.id); for (let i = 0; i < 90; i++) W.step(DT); note(none(g, v) && u.staggerUntil < 0 && Math.abs(d.angle) > 1.0, 'pulled open past the men on its pull face'); }
      { const W = await world(true), g = W.game, d = door(g), F = frame(d); sam(g, F.pt(F.W * 0.6, -4));   // swinging shut onto a man in the doorway
        d.latched = false; d.angle = F.S * 1.4; d.vel = 0; d.place(); const v = stand(g, 0, F.pt(F.W * 0.6, 0.2)); W.step(DT); g.doors.pullTo(d, PLAYER_ID); for (let i = 0; i < 120; i++) W.step(DT); note(none(g, v), 'swinging shut onto a man in the doorway'); }
      { const W = await world(true), g = W.game, d = door(g), F = frame(d); sam(g, F.pt(F.W * 0.6, -4));   // a man walking into a leaf standing ajar, himself
        d.latched = false; d.angle = F.S * 0.5; d.vel = 0; d.place(); const v = stand(g, 0, F.pt(F.W * 0.6, -1.2));
        walk(W, F, v, 1.5, 1.4); note(none(g, v), 'a man walking into a leaf himself'); }
      { const W = await world(true), g = W.game, d = door(g), F = frame(d), v = stand(g, 0, F.pt(F.W * 0.6, BEHIND)), w = stand(g, 1, F.pt(F.W * 0.6, -0.9), 'operative'); sam(g, F.pt(F.W * 0.6, -4));   // a foe's leaf barely moving
        walk(W, F, w, 4, 0.25); note(none(g, v), 'a foe leaning the leaf onto him at 0.25 m/s'); }
      { const W = await world(true), g = W.game, d = door(g), F = frame(d); sam(g, F.pt(F.W * 0.6, -4));   // a staging's write: the leaf put wide open in one frame, no hand on it
        const v = stand(g, 0, F.pt(F.W * 0.6, BEHIND)); W.step(DT); d.latched = false; d.angle = F.S * 1.2; for (let i = 0; i < 20; i++) W.step(DT); note(none(g, v), 'a leaf a script set wide open in one frame'); }
      line(!bad, `not a throw — ${out.join(' · ')}`); }

    // ------------------------------------------------------------ a man just up from a fold is not thrown again
    { const W = await world(true), g = W.game, d = door(g), F = frame(d), p0 = F.pt(F.W * 0.6, BEHIND), v = stand(g, 0, p0), from = F.pt(F.W * 0.7, -0.76); sam(g, from);
      v.staggerUntil = g.time + 0.02; v.dazzledUntil = -1; for (let i = 0; i < 6; i++) W.step(DT);   // (a fold that has just run out)
      g.doors.kickIn(d, from, PLAYER_ID); for (let i = 0; i < 30; i++) W.step(DT);
      line(DOORTHROW_STATS.kicked + DOORTHROW_STATS.pushed === 0 && v.staggerUntil < g.time, `a man just up from a fold (inside the ${T.again} s after it) takes a boot's leaf without a second throw (thrown ${DOORTHROW_STATS.kicked + DOORTHROW_STATS.pushed})`); }

    // ------------------------------------------------------------ the checkpoint
    { const W = await world(true), g = W.game; await quiet(() => loadState(g, snapKnee)); const v = g.guards[0];
      line(!!snapKnee && Math.abs(v.doorDownUntil - kneeUntil) < 1e-9 && v.staggerUntil > g.time && v.dazzledUntil > g.time, `a man on a knee, saved and loaded into a fresh game: on his knee to the same clock (${f2(v.doorDownUntil - g.time)} s left), still folded and blind`); }

    { const W = await world(true), g = W.game, d = door(g), F = frame(d), from = F.pt(F.W * 0.7, -0.76); stand(g, 0, F.pt(F.W * 0.3, 0.85)); sam(g, from);   // a boot in flight, saved before it meets him
      W.step(DT); g.doors.kickIn(d, from, PLAYER_ID); W.step(DT); const snap = JSON.parse(JSON.stringify(saveState(g)));
      const W2 = await world(true), g2 = W2.game; await quiet(() => loadState(g2, snap)); const v2 = g2.guards[0]; for (const k of Object.keys(DOORTHROW_STATS)) (DOORTHROW_STATS as any)[k] = 0;
      for (let i = 0; i < 30; i++) W2.step(DT);
      line(DOORTHROW_STATS.kicked === 1 && folded(g2, v2) > 0, `a booted leaf saved in flight and loaded into a fresh game still throws the man it meets (thrown ${DOORTHROW_STATS.kicked}): the checkpoint carries who drove it`); }

    // ------------------------------------------------------------ the journal
    { const g = W0.game, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      T.on = true; const old = snap(); delete old.tables.DOORTHROW; applyKnobs(g, old); const before = T.on;
      T.on = false; const own = snap(); own.tables.DOORTHROW.on = true; applyKnobs(g, own); const carried = T.on;
      line(before === false && carried === true, `a recording from before the table replays with the rule off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { T.on = was; }
  console.log(failed ? '=== doorthrow-check: FAIL ===' : '=== doorthrow-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await doorthrowCheck()) ? 0 : 1);
