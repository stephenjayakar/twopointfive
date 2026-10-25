// The motions the loud squad demo shows, each as a pose-strip scenario (tools/qa/pose-strip.ts draws them). Every scenario drives the animator the way the game's
// controllers do (guards.ts / squad.ts / doortools.ts write speed / upper / stance / crouchTarget and call the one-shots) — nothing here poses a bone itself.
type Vec3 = [number, number, number];
export function register(SC: Record<string, any>, CH: any) {
  const walkTo = (c: any, speed: number) => { c.anim.speed = speed; c.vel = [Math.sin(c.bodyYaw) * speed, 0, Math.cos(c.bodyYaw) * speed]; };

  SC['carry-walk'] = { title: 'an operator moving between doors: rifle at the low ready, 1.3 m/s (the team never sprints)', run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.stance = 'lowReady'; c.anim.upper = 'none'; walkTo(c, 1.3);
    S.run(2.0); const T = 0.92; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); }
  } };
  // the player's sprint, three ways (4.7 m/s; the trunk and the legs are the sprint clip's in all three)
  const sprinter = (S: any, set: (c: any) => void, o?: any) => { const c = S.man(o); c.anim.trained = 1; c.anim.upper = 'none'; set(c); walkTo(c, 4.7);
    S.run(1.5); const T = 0.66; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); } };
  SC['sprint-pistol-old'] = { title: "Sam's sprint with the pistol as it was: the gun in a pumping fist", run(S: any) { sprinter(S, c => { c.__pistol = true; }); } };
  SC['sprint-pistol'] = { title: "Sam's sprint with the pistol: both hands on it, low", run(S: any) { sprinter(S, c => { c.__pistol = true; c.anim.runReady = true; }); } };
  SC['sprint-pistol-turns'] = { title: "into the sprint with the pistol and out of it again: the carry, the low ready, the carry", run(S: any) {
    const c = S.man(); c.__pistol = true; c.anim.trained = 1; c.anim.upper = 'relaxed'; walkTo(c, 1.55); S.run(1.2); S.shot('walking, the carry');
    c.anim.upper = 'none'; c.anim.runReady = true; walkTo(c, 4.7); for (const [t, d] of [[0.05, 0.05], [0.15, 0.1], [0.3, 0.15], [0.6, 0.3]]) { S.run(d); S.shot(`${t} s into the sprint`); }
    c.anim.upper = 'relaxed'; c.anim.runReady = false; walkTo(c, 1.55); for (const [t, d] of [[0.05, 0.05], [0.15, 0.1], [0.3, 0.15], [0.6, 0.3]]) { S.run(d); S.shot(`${t} s out of it`); }
  } };
  SC['sprint-rifle'] = { title: "Sam's sprint with the rifle: the long gun's low ready (what the pistol's is set beside)", run(S: any) { sprinter(S, c => { c.anim.longStance = 'lowLong'; }, { rifle: true, steady: 1 }); } };
  SC['carry-up'] = { title: 'an operator crossing a room: rifle shouldered, 1.3 m/s', run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; walkTo(c, 1.3);
    S.run(2.0); const T = 0.92; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); }
  } };
  SC['defender-walk'] = { title: 'a defender hurrying to a post: carbine in the hands, 1.6 m/s', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'relaxed'; walkTo(c, 1.6);
    S.run(2.0); const T = 0.8; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); }
  } };
  SC['defender-aim'] = { title: 'a defender who has seen the team: carbine up, standing, then two rounds', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'relaxed'; S.run(0.6); S.shot('carry');
    c.anim.upper = 'aim'; S.run(0.15); S.shot('+0.15 s'); S.run(0.25); S.shot('up'); c.anim.fire(); S.run(0.05); S.shot('round +0.05'); S.run(0.1); S.shot('+0.15'); S.run(0.25); S.shot('+0.40');
  } };
  SC['stack'] = { title: 'two operators stacked on a door (the wall on their right): the "set" from number two — a squeeze on the shoulder ahead', opts: { follow: false }, run(S: any) {
    const a = S.man({ rifle: true, steady: 1, pos: [0, 0, 0] }), b = S.man({ rifle: true, steady: 1, pos: [0.05, 0, -0.62], tone: 1 });
    S.mark([-0.42, 0, -1.6], [-0.42, 0, 0.5], '#555');
    for (const c of [a, b]) { c.anim.trained = 1; c.anim.upper = 'none'; c.anim.stackSide = 1; }
    a.anim.stance = 'stack'; b.anim.stance = 'highReady';
    S.run(0.8); S.shot('set'); b.anim.signal(CH.MOVES ? 'squeeze' : 'hold'); S.run(0.25); S.shot('squeeze +0.25'); S.run(0.25); S.shot('+0.5'); S.run(0.35); S.shot('+0.85'); S.run(0.5); S.shot('+1.35');
  } };
  SC['kick'] = { title: 'the breach: the point man boots the door (impact at 0.38 s)', opts: { follow: false }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.stance = 'stack'; c.anim.upper = 'none'; S.mark([-0.6, 0, 0.78], [0.6, 0, 0.78], '#555');
    S.run(0.6); c.anim.stance = 'none'; c.anim.kickDoor({ leg: 'left' });
    for (const t of [0, 0.15, 0.3, 0.38, 0.5, 0.7, 1.0]) { S.run(Math.max(0, t - (c.anim.kickTime < 0 ? 1.0 : c.anim.kickTime))); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['bang-throw'] = { title: 'the bang: number two tosses the charge round the frame', opts: { follow: false }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.stance = 'highReady'; c.anim.upper = 'none'; S.mark([-0.42, 0, -0.8], [-0.42, 0, 0.9], '#555');
    S.run(0.6); S.shot('ready'); if (c.anim.tossItem) c.anim.tossItem(); else c.anim.throwItem();
    for (const t of [0.1, 0.2, 0.3, 0.45, 0.6, 0.9]) { S.run(t - (S.t - 0.6)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['fire-auto'] = { title: 'an operator firing: rifle shouldered, standing, four rounds 0.1 s apart', opts: { scale: 170 }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; S.run(0.8); S.shot('on target');
    let next = 0, n = 0; const t0 = S.t; const marks = [0.02, 0.05, 0.1, 0.13, 0.25, 0.36, 0.6]; let mi = 0;
    S.run(0.7, () => { const t = S.t - t0; if (n < 4 && t >= next - 1e-9) { c.anim.fire(); n++; next += 0.1; } if (mi < marks.length && t >= marks[mi] - 1e-9) { S.shot(`${marks[mi].toFixed(2)} s`); mi++; } });
  } };
  SC['fire-defender'] = { title: 'a defender firing the short carbine: four rounds 0.1 s apart', opts: { scale: 170 }, run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'aim'; S.run(0.8); S.shot('on target');
    let next = 0, n = 0; const t0 = S.t; const marks = [0.02, 0.05, 0.1, 0.13, 0.25, 0.36, 0.6]; let mi = 0;
    S.run(0.7, () => { const t = S.t - t0; if (n < 4 && t >= next - 1e-9) { c.anim.fire(); n++; next += 0.1; } if (mi < marks.length && t >= marks[mi] - 1e-9) { S.shot(`${marks[mi].toFixed(2)} s`); mi++; } });
  } };
  SC['flinch'] = { title: 'rounds pass close: a defender flinches (from his front-left)', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'aim'; S.run(0.8); S.shot('before');
    if (c.anim.flinchFrom) c.anim.flinchFrom([0.6, 0, 1]); else c.anim.flinch();
    for (const t of [0.05, 0.12, 0.25, 0.45, 0.8]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['startle'] = { title: 'a calm man sees you (startle.ts): the start of a man with empty hands, from his front-left', run(S: any) {
    const c = S.man({ tone: 1 }); c.anim.trained = 0; c.anim.upper = 'none'; S.run(0.8); S.shot('before');
    c.anim.startleFrom([0.6, 0, 1]);
    for (const t of [0.05, 0.1, 0.25, 0.45, 0.8]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['startle-rifle'] = { title: 'a calm defender sees you: both hands stay on the gun, at the low ready, and the trunk takes all of it (from dead ahead)', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'none'; c.anim.stance = 'lowReady'; S.run(0.8); S.shot('before');
    c.anim.startleFrom([0, 0, 1]);
    for (const t of [0.05, 0.1, 0.25, 0.45, 0.8]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['startle-behind'] = { title: 'the start of a man taken from behind his right shoulder (a door opened into him)', run(S: any) {
    const c = S.man({ tone: 1 }); c.anim.trained = 0; c.anim.upper = 'none'; S.run(0.8); S.shot('before');
    c.anim.startleFrom([-0.7, 0, -1]);
    for (const t of [0.05, 0.1, 0.25, 0.45, 0.8]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['flinch-operator'] = { title: 'rounds pass close: an operator takes it and stays on the gun', run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; S.run(0.8); S.shot('before');
    if (c.anim.flinchFrom) c.anim.flinchFrom([0.6, 0, 1]); else c.anim.flinch();
    for (const t of [0.05, 0.12, 0.25, 0.45, 0.8]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['hit'] = { title: 'a round goes home but he stays up (armour, a graze): hit from the front', run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; S.run(0.8); S.shot('before');
    if (c.anim.hitFrom) c.anim.hitFrom([0, 0, -1]); else c.anim.hit();
    for (const t of [0.04, 0.1, 0.2, 0.35, 0.6]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['dazzle'] = { title: 'a stun charge goes off in the room: a defender for the next two seconds', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'aim'; S.run(0.8); S.shot('before');
    c.anim.hit(); if ('dazzle' in c.anim) c.anim.dazzle = { from: [0.3, 0, 1] as Vec3, k: 1 };
    c.anim.upper = 'none'; c.anim.stance = 'lowReady';
    for (const t of [0.1, 0.3, 0.6, 1.0, 1.5, 2.0]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
    if ('dazzle' in c.anim) c.anim.dazzle = null; c.anim.upper = 'aim'; c.anim.stance = 'none'; S.run(0.5); S.shot('+0.5 after');
  } };
  SC['dazzle-firing'] = { title: 'a stun charge goes off while his carbine is up: blind, he keeps the gun on the door and fires', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'aim'; S.run(0.8); S.shot('before');
    if ('dazzle' in c.anim) c.anim.dazzle = { from: [0.3, 0, 1] as Vec3, k: 1 }; const t0 = S.t; let next = 0.3, n = 0; const marks = [0.1, 0.3, 0.45, 0.6, 1.0, 1.5]; let mi = 0;
    S.run(1.6, () => { const t = S.t - t0; if (n < 8 && t >= next - 1e-9) { c.anim.fire(); n++; next += 0.1; } if (mi < marks.length && t >= marks[mi] - 1e-9) { S.shot(`${marks[mi].toFixed(2)} s`); mi++; } });
  } };
  SC['down-front'] = { title: 'going down: a defender shot from the front while standing with the carbine up', opts: { follow: false }, run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'aim'; S.run(0.8); S.shot('before');
    c.ragdollize(null, [0, 0, -1], false);
    for (const t of [0.1, 0.25, 0.45, 0.7, 1.1, 2.0]) { S.run(t - (S.t - 0.8)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['down-moving'] = { title: 'going down: a defender shot from the side at a jog (2.6 m/s)', opts: { follow: false }, run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'relaxed'; walkTo(c, 2.6); S.run(1.2); S.shot('before');
    c.ragdollize(null, [1, 0, 0.2], false); const t0 = S.t;
    for (const t of [0.1, 0.25, 0.45, 0.7, 1.1, 2.0]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['room-entry'] = { title: 'through the door: the operator comes off the stack, in, and turns into his corner', opts: { follow: true, scale: 120 }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1, pos: [0, 0, -1.2] }); c.anim.trained = 1; c.anim.stance = 'stack'; c.anim.upper = 'none'; S.mark([-0.5, 0, 0], [-1.6, 0, 0], '#555'); S.mark([0.5, 0, 0], [1.6, 0, 0], '#555');
    S.run(0.6); S.shot('stacked'); c.anim.stance = 'none'; c.anim.upper = 'aim';
    const t0 = S.t; c.drive = (t: number) => { const u = t - t0; const sp = Math.min(1.9, 0.4 + u * 6); c.anim.speed = sp; const yaw = u < 0.75 ? 0 : Math.min(1.0, (u - 0.75) * 3.2); c.bodyYaw = yaw; c.aimYaw = u < 0.5 ? 0 : Math.min(1.35, (u - 0.5) * 4); c.vel = [Math.sin(yaw) * sp, 0, Math.cos(yaw) * sp]; };
    for (const t of [0.2, 0.5, 0.8, 1.1, 1.5]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); }
  } };

  // ---- the second pass (rebuild/cast-faces-and-moves/moves): the reload, the entry, hostages, a man hit and still up
  const reloader = (S: any, trained: number, dur: number, walk: number, beat: any) => { const c = S.man({ rifle: true, steady: trained > 0.5 ? 1 : 0, tone: trained > 0.5 ? 0 : 1 }); c.anim.trained = trained; c.anim.upper = 'aim'; if (walk) walkTo(c, walk); S.run(0.8); S.shot('firing'); c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.reloadBack = trained > 0.5; c.anim.reload(dur, beat); return c; };
  SC['reload-operator'] = { title: 'an operator reloads the FN2000 (a bullpup: the magazine is behind the grip), 2.4 s', opts: { side: 'left', scale: 170 }, run(S: any) {
    const c = reloader(S, 1, 2.4, 0, { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 }); const t0 = S.t; void c;
    for (const t of [0.3, 0.5, 0.65, 1.05, 1.5, 2.0, 2.1, 2.5]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); }
  } };
  SC['reload-defender'] = { title: 'a defender reloads the short carbine: the clip 1.6 s as his AI plays it, the beat 2.6 s', opts: { side: 'left', scale: 170 }, run(S: any) {
    const c = reloader(S, 0.12, 1.6, 0, { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 }); const t0 = S.t; void c;
    for (const t of [0.4, 0.7, 0.85, 1.25, 1.46, 1.6, 1.7, 1.87, 2.2, 2.3, 2.7]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); }
  } };
  const keptDown = (S: any, kind: 1 | 2) => { const c = S.man({ tone: kind === 1 ? 2 : 3 }); c.anim.trained = 0.5; c.anim.upper = 'none'; c.anim.stance = 'none'; S.run(0.5); S.shot('on her feet');
    c.anim.crouchTarget = 1; S.run(0.8); S.shot('down (the game as it was)'); c.anim.bound = kind;
    { const t0 = S.t; for (const t of [0.15, 0.4, 1.0]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); } }
    c.anim.lookYawExtra = 0.6; S.run(0.6); S.shot('looks round'); c.anim.lookYawExtra = 0; c.anim.bound = 0; c.anim.crouchTarget = 0; S.run(0.7); S.shot('freed, up +0.7 s'); };
  SC['hostage'] = { title: 'a hostage kept down: wrists tied behind her back for as long as she is one', run(S: any) { keptDown(S, 1); } };
  SC['stay-down'] = { title: 'told to stay down (the quiet game\'s "stay down, stay quiet"): hands on the head until the promise runs out', run(S: any) { keptDown(S, 2); } };
  SC['clutch'] = { title: 'knocked about and still up: a defender folded by a blast he did not see, the support hand to his ribs for as long as the game roots him', opts: { side: 'left' }, run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0.12; c.anim.upper = 'aim'; S.run(0.8); S.shot('carbine up');
    const keep = CH.MOVES.fold; if ('fold' in CH.MOVES) CH.MOVES.fold = 1;   // drawn WITH the fold (in the game it comes up with ?wounds or ?fold; without it the arm alone)
    try {
      c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.hitFrom?.([0, 0, 1]); c.anim.clutch = 1;
      { const t0 = S.t; for (const t of [0.12, 0.3, 0.7, 0.95, 1.4]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); } }
      c.anim.clutch = 0; c.anim.upper = 'aim'; c.anim.stance = 'none'; S.run(0.25); S.shot('let go +0.25 s'); S.run(0.5); S.shot('+0.75 s');
    } finally { if ('fold' in CH.MOVES) CH.MOVES.fold = keep; }
  } };
  // WOUNDS (src/game/wounds.ts, off unless ?wounds): the two ways a man goes down wounded and out of the fight — the gun leaves his hands at the hit, as the game's own drop does
  const wounded = (S: any, pose: 'knee' | 'back', at: 'ribs' | 'thigh', marks: number[]) => { const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0.12; c.anim.upper = 'aim'; S.run(0.8); S.shot('carbine up');
    c.__rifle = false; c.anim.longGun = false; c.anim.upper = 'none'; c.anim.hit?.(); c.anim.wound = { pose, at };
    const t0 = S.t; for (const t of marks) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); } };
  SC['wounded-knee'] = { title: 'a round through the flank (wounds on): he drops the carbine and sinks to a knee, doubled over it, the hand to his ribs — out of the fight, breathing', opts: { side: 'left', follow: false }, run(S: any) { wounded(S, 'knee', 'ribs', [0.12, 0.3, 0.5, 0.8, 1.2, 2.2, 3.2]); } };
  SC['wounded-leg'] = { title: 'a round through the leg with no room to fall (wounds on): down on the knee where he stood, the hand to his thigh', opts: { side: 'left', follow: false }, run(S: any) { wounded(S, 'knee', 'thigh', [0.3, 0.8, 1.2, 2.2]); } };
  SC['wounded-back'] = { title: 'a round through the leg from in front (wounds on): the leg goes, he lands on his back with a knee drawn up, head off the floor, the hand to his thigh', opts: { side: 'left', follow: false, scale: 105 }, run(S: any) { wounded(S, 'back', 'thigh', [0.15, 0.4, 0.7, 1.0, 1.45, 2.4, 3.4]); } };
  SC['entry-dip'] = { title: 'through the door behind the lead: number two\'s muzzle goes down past his back and comes up as they part (MOVES.entry, off unless ?entry)', opts: { scale: 105 }, run(S: any) {
    const keep = CH.MOVES.entry; if (CH.MOVES.on > 0.5) CH.MOVES.entry = 1;
    try {
    S.mark([-0.55, 0, 1.2], [-0.55, 2.0, 1.2], '#888'); S.mark([0.55, 0, 1.2], [0.55, 2.0, 1.2], '#888');
    const two = S.man({ rifle: true, steady: 1, pos: [0, 0, -0.85], tone: 0 }), lead = S.man({ rifle: true, steady: 1, pos: [0, 0, 0.2], tone: 0 });   // (number two first: each cell is centred on him)
    for (const c of [lead, two]) { c.anim.trained = 1; c.anim.upper = 'aim'; }
    const inLane = () => CH.inDipLane(lead.pos[0] - two.pos[0], lead.pos[2] - two.pos[2], two.aimYaw);
    two.drive = () => { two.anim.dip = inLane() ? 1 : 0; };
    S.run(0.6); S.shot('stacked: two behind the lead');
    walkTo(lead, 1.3); walkTo(two, 1.3); S.run(0.9); S.shot('in the frame');
    // the lead hooks left, number two goes right: the lanes part
    lead.vel = [1.1, 0, 0.6]; lead.aimYaw = lead.bodyYaw = 1.0; two.vel = [0, 0, 1.3];
    for (const lb of ['+0.2 s', '+0.4 s', '+0.6 s', '+0.9 s']) { S.run(lb === '+0.9 s' ? 0.3 : 0.2); S.shot(lb); }
    } finally { CH.MOVES.entry = keep; }
  } };
  // ---- turning with the weapon's weight (character.ts TURN): the muzzle and the body driven the way the AI drives them (an easing at guards.ts PACE.turn, 8 rad/s)
  const ease = (a: number, b: number, step: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) <= step ? b : a + Math.sign(d) * step; };
  const turner = (S: any, trained: number, h: number) => { const c = S.man({ rifle: true, steady: trained > 0.5 ? 1 : 0, tone: trained > 0.5 ? 0 : 1 }); c.anim.trained = trained; c.anim.upper = 'aim'; if (c.turn) { c.turn.on = true; c.turn.h = h; c.turn.k = trained; } S.run(0.6); return c; };
  SC['turn-quarter'] = { title: 'an operator brings his rifle a quarter turn to his left (a man seen off his shoulder): one frame every 67 ms', opts: { follow: false }, run(S: any) {
    const c = turner(S, 1, 0.8); S.shot('before'); const t0 = S.t, to = Math.PI / 2;
    c.drive = () => { c.turnBegin?.(); c.aimYaw = ease(c.aimYaw, to, 8 / 60); };
    for (const t of [0.067, 0.133, 0.2, 0.267, 0.333, 0.4]) { S.run(t - (S.t - t0)); S.shot(`${Math.round(t * 1000)} ms`); }
  } };
  SC['turn-about'] = { title: 'an operator turns right round, rifle up (a shot from behind him): one frame every 133 ms', opts: { follow: false }, run(S: any) {
    const c = turner(S, 1, 0.8); S.shot('before'); const t0 = S.t, to = Math.PI * 0.97;
    c.drive = () => { c.turnBegin?.(); c.bodyYaw = ease(c.bodyYaw, to, 8 / 60); c.aimYaw = ease(c.aimYaw, to, 8 / 60); let off = c.aimYaw - c.bodyYaw; while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI; if (Math.abs(off) > 1.5) c.aimYaw = c.bodyYaw + Math.sign(off) * 1.5; };
    for (const t of [0.133, 0.267, 0.4, 0.533, 0.667, 0.8]) { S.run(t - (S.t - t0)); S.shot(`${Math.round(t * 1000)} ms`); }
  } };
  // A MAN'S CONDITION (src/game/condition.ts: conditionPose deals `hurt`, `shaken` and `foldToo` to every figure — here they are set as it sets them)
  SC['hurt-stand'] = { title: 'hurt and still up: an operator at the low ready, sound, then as a blast has left him — and with the rifle brought up into his shoulder', opts: { side: 'left' }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.stance = 'lowReady'; c.anim.upper = 'none'; S.run(0.8); S.shot('sound');
    c.anim.hurt = 1; S.run(0.4); S.shot('hurt +0.4 s'); S.run(0.8); S.shot('+1.2 s'); S.run(1.1); S.shot('+2.3 s');
    c.anim.stance = 'none'; c.anim.upper = 'aim'; S.run(0.6); S.shot('rifle up'); S.run(0.6); S.shot('+0.6 s');
  } };
  SC['hurt-walk'] = { title: 'a hurt operator moving between doors: rifle at the low ready, 1.3 m/s — the short heavy step onto the side he favours (carry-walk is the sound man)', opts: { side: 'left' }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.stance = 'lowReady'; c.anim.upper = 'none'; c.anim.hurt = 1; walkTo(c, 1.3);
    S.run(2.0); const T = 0.92; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); }
  } };
  SC['hurt-walk-up'] = { title: 'a hurt operator crossing a room: rifle shouldered, 1.3 m/s — he braces, the step stays (carry-up is the sound man)', opts: { side: 'left' }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; c.anim.hurt = 1; walkTo(c, 1.3);
    S.run(2.0); const T = 0.92; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); }
  } };
  SC['hurt-defender'] = { title: 'a hurt defender falling back at his walk: carbine in the hands, 1.5 m/s', run(S: any) {
    const c = S.man({ rifle: true, tone: 1 }); c.anim.trained = 0; c.anim.upper = 'relaxed'; c.anim.hurt = 1; c.anim.hurtSide = -1; walkTo(c, 1.5);
    S.run(2.0); const T = 0.85; for (let i = 0; i < 6; i++) { S.shot(`${(i / 6).toFixed(2)} of a cycle`); S.run(T / 6); }
  } };
  SC['shaken'] = { title: 'fire on him: an operator with his rifle up as rounds start passing, and a second and a half after they stop', run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; S.run(0.8); S.shot('rifle up');
    c.anim.shaken = 1; S.run(0.1); S.shot('fire on him +0.1 s'); S.run(0.3); S.shot('+0.4 s'); S.run(0.8); S.shot('+1.2 s');
    c.anim.shaken = 0; S.run(0.5); S.shot('it stops +0.5 s'); S.run(1.0); S.shot('+1.5 s');
  } };
  SC['fold-operator'] = { title: 'knocked about and still up, one of your own: folded over the hurt for as long as the game roots him, then hurt', opts: { side: 'left' }, run(S: any) {
    const c = S.man({ rifle: true, steady: 1 }); c.anim.trained = 1; c.anim.upper = 'aim'; S.run(0.8); S.shot('rifle up');
    c.anim.foldToo = true; c.anim.upper = 'none'; c.anim.stance = 'lowReady'; c.anim.hitFrom?.([0, 0, 1]); c.anim.clutch = 1; c.anim.hurt = 1;
    { const t0 = S.t; for (const t of [0.12, 0.4, 0.9, 1.4]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); } }
    c.anim.clutch = 0; S.run(0.5); S.shot('up again +0.5 s'); S.run(1.0); S.shot('+1.5 s');
  } };
  SC['turn-defender'] = { title: 'a defender swings his carbine a quarter turn to a door going in (eased at 6 rad/s, as his AI does): one frame every 100 ms', opts: { follow: false }, run(S: any) {
    const c = turner(S, 0.12, 0.82); S.shot('before'); const t0 = S.t, to = -Math.PI / 2;
    c.drive = () => { c.turnBegin?.(); c.aimYaw = ease(c.aimYaw, to, 6 / 60); };
    for (const t of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) { S.run(t - (S.t - t0)); S.shot(`${Math.round(t * 1000)} ms`); }
  } };

  // A THROW READS ITS DISTANCE (character.ts THROW_BY, its switch put on for the strip): the right arm's one-shot told how far the can goes
  const THROWS: [string, number | undefined, boolean | 'armed', string][] = [
    ['throw-toss', 2, false, 'a can thrown 2 m: the underhand toss'], ['throw-toss-crouch', 2.5, true, 'a can thrown 2.5 m from the crouch: the underhand toss'], ['throw-toss-armed', 2, 'armed', 'a can thrown 2 m with a gun in his hands: the toss, the support hand let down'],
    ['throw-short', 6, false, 'a can thrown 6 m: the overhand, short-armed'], ['throw-least', 3, false, 'a can thrown 3 m, or thrown hard at a wall two steps off: the shortest overhand'], ['throw-full', 12, false, 'a can thrown 12 m: the whole wind-up'],
    ['throw-full-crouch', 12, true, 'a can thrown 12 m from the crouch'], ['throw-untold', undefined, false, 'a throw told no distance: the one overhand, as before'],
  ];
  for (const [id, dist, crouch, title] of THROWS) SC[id] = { title, opts: { follow: false }, run(S: any) {
    const c = S.man({}); c.anim.upper = crouch === 'armed' ? 'relaxed' : 'none'; if (crouch === true) c.anim.crouchTarget = 1; S.run(0.8); S.shot('ready'); const t0 = S.t, was = CH.THROW_BY.on; CH.THROW_BY.on = true; c.anim.throwItem(dist); CH.THROW_BY.on = was;
    for (const t of [0.08, 0.165, 0.225, 0.28, 0.35, 0.46, 0.62, 0.75]) { S.run(t - (S.t - t0)); S.shot(t === CH.THROW_RELEASE ? `${t.toFixed(2)} s: it leaves the hand` : `${t.toFixed(2)} s`); }
  } };
  // … and a blast mid-swing takes the swing (the switch and MOVES held on for the whole strip): hit four frames into the whole wind-up
  for (const [id, blind, title] of [['throw-blinded', true, 'blinded 0.07 s into a 12 m throw: the swing gives way to the hunch'], ['throw-folded', false, 'folded by a blast 0.07 s into a 12 m throw: the swing gives way to the fold']] as const) SC[id] = { title, opts: { follow: false }, run(S: any) {
    const was = CH.THROW_BY.on, keep = { ...CH.MOVES }; CH.THROW_BY.on = true; CH.MOVES.on = 1; CH.MOVES.dazzle = 1; CH.MOVES.clutch = 1;
    try { const c = S.man({}); c.anim.upper = 'none'; S.run(0.8); S.shot('ready'); const t0 = S.t; c.anim.throwItem(12); S.run(4 / 60);
      if (blind) c.anim.dazzle = { from: [0.3, 0, 1] as Vec3, k: 1 }; else { c.anim.clutch = 1; c.anim.foldToo = true; } S.shot('0.07 s: the blast');
      for (const t of [0.165, 0.225, 0.28, 0.35, 0.46, 0.62, 0.75]) { S.run(t - (S.t - t0)); S.shot(`${t.toFixed(2)} s`); }
    } finally { CH.THROW_BY.on = was; Object.assign(CH.MOVES, keep); }
  } };
}
