// The mission pictures' in-page director (tools/menu-shots/shots.cjs injects this text into the REAL page: window.__ms).
// It PLAYS a mission the way a person does — Sam on his own feet through the walk keys, the squad through the order menu's own
// orders (orders.ts give), the fight the game's own — with nothing drawn, stops on a moment, and only then draws: the picture is a
// frame of that run, from a camera pinned for the still. Nothing here writes a man's position, state or aim.
//
//   sim(secs, until?)   play with the renderer stubbed (a second of play costs what the simulation costs). An undrawn step still
//                       packs the world as a draw does (the cursor's ray, a laser's reach and the order menu's target read that
//                       list), keeps the lens's aspect, and lets go of particle bursts a frame old — nothing steps the pool while
//                       nothing is drawn, so only the moment's own burst is born into the still. The meters read the CPU stand-in
//                       while no frame has ever been drawn (guards.ts meterOf); after a lead / draw they hold that frame's answers,
//                       so a recipe plays first and draws last
//   lead(n, until?)     play n frames DRAWN BLIND: the frame is encoded without its lit passes, so the smoke solver and the particle
//                       pool — which step per drawn frame — run on with the game, at a fraction of a frame's price
//   draw(frames)        the still: the game crawls (DRAW_DT a frame: a flash and a tracer stay where they are) while the resolve converges
//   go(p) aim(p) hold(k) tap(k) fire()   Sam's keys; order(id, at, who)   the squad's
(() => {
  const DT = 1 / 60, DRAW_DT = 1e-4;
  const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]), r1 = p => [+p[0].toFixed(1), +p[2].toFixed(1)];
  const S = { real: null, path: null, aim: null, held: new Set(), log: [], seen: new WeakSet(), state: new Map(), shots: 0, shotT: -1, by: [], qlen: 0 };
  const G = () => window.__game, E = () => window.__engine, V = () => document.getElementById('view');

  function undrawn() {
    const e = E(), q = e.particles?.queue; e.world.upload(); if (e.height > 0) window.__cam.aspect = e.width / e.height;
    if (q) { q.splice(0, Math.min(S.qlen, q.length)); S.qlen = q.length; }
  }
  function quiet(on) { const e = E(); if (on && !S.real) { S.real = e.render; e.render = undrawn; } else if (!on && S.real) { e.render = S.real; S.real = null; S.qlen = 0; } }
  function keys() {
    const g = G(), p = g.player.char.pos, out = [...S.held]; let dir = null;
    if (S.path) { while (S.path.length > 1 && flat(p, S.path[0]) < 0.5) S.path.shift(); if (S.path.length === 1 && flat(p, S.path[0]) < 0.25) S.path = null; }
    if (S.path) {
      const w = S.path[0], d = flat(p, w) || 1; dir = [(w[0] - p[0]) / d, (w[2] - p[2]) / d];
      const { fwd, right } = window.__cam.planarBasis(), a = dir[0] * fwd[0] + dir[1] * fwd[2], b = dir[0] * right[0] + dir[1] * right[2], T = 0.3827;
      if (a > T) out.push('KeyW'); if (a < -T) out.push('KeyS'); if (b > T) out.push('KeyD'); if (b < -T) out.push('KeyA');
    }
    const at = S.aim ?? (dir ? [p[0] + dir[0] * 4, 1.1, p[2] + dir[1] * 4] : null);
    if (at) { const v = V(), [x, y] = window.__cam.project(at, v.clientWidth, v.clientHeight); window.__mouse(x, y); }
    return out;
  }
  // what happened this frame, for picking the moment: rounds, blasts, boots, men going down
  function watch() {
    const g = G(); S.by.length = 0;
    for (const e of g.events) { if (S.seen.has(e)) continue; S.seen.add(e);
      if (e.kind === 'shot' || e.kind === 'guardShot') { S.shots++; S.shotT = g.time; S.by.push(e.who ?? 0); }
      else if (e.kind === 'bang' || e.kind === 'kick' || e.kind === 'glass') S.log.push(`${g.time.toFixed(2)} ${e.kind} @${r1(e.pos)}`); }
    for (const gd of [...g.guards, ...(g.civilians ?? [])]) { const was = S.state.get(gd); if (was !== gd.state) { if (was !== undefined && (gd.state === 'dead' || gd.state === 'alert' || was === 'dead')) S.log.push(`${g.time.toFixed(2)} ${gd.callsign} ${was}>${gd.state} @${r1(gd.char.pos)}`); S.state.set(gd, gd.state); } }
    if (S.log.length > 400) S.log.splice(0, S.log.length - 400);
  }
  function frame() { window.__runFrames(1, DT, keys()); watch(); }
  function sim(secs, until) { quiet(true); let n = 0; const N = Math.round(secs * 60); for (; n < N; n++) { frame(); if (until && until()) break; } return { t: +G().time.toFixed(2), frames: n, hit: !until || n < N }; }
  async function flush() { await E().device.queue.onSubmittedWorkDone(); await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); }
  async function lead(n, until) {
    quiet(false); const P = E().passes, enc = P.encode; P.encode = () => {}; let i = 0;
    try { for (; i < n; i++) { frame(); await flush(); if (until && until()) break; } } finally { P.encode = enc; }
    return { t: +G().time.toFixed(2), frames: i, hit: !until || i < n };   // (no test = nothing to miss)
  }
  async function draw(frames = 24, type = 'image/png') {
    quiet(false); const t0 = performance.now();
    for (let i = 0; i < frames; i++) { window.__runFrames(1, DRAW_DT, []); await flush(); }
    E().render(window.__cam, G().time, DRAW_DT, false); const fr = await E().readbackFrame(); if (!fr) return { err: 'no frame' };
    const c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h; const cx = c.getContext('2d'), im = cx.createImageData(fr.w, fr.h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = fr.data[i + (fr.bgra ? 2 : 0)]; d[i + 1] = fr.data[i + 1]; d[i + 2] = fr.data[i + (fr.bgra ? 0 : 2)]; d[i + 3] = 255; }
    cx.putImageData(im, 0, 0);
    return { w: fr.w, h: fr.h, secs: +((performance.now() - t0) / 1000).toFixed(1), url: c.toDataURL(type, 0.95) };
  }

  function go(p) { const g = G(), a = g.player.char.pos, path = g.col.nav.findPath(a, [p[0], 0, p[2]], 6000) ?? []; path.push([p[0], 0, p[2]]); S.path = path; return path.length; }
  const arrived = () => !S.path;
  function door(name) { return G().doors.list.find(d => d.def.name === name) ?? null; }
  function target(at) { const O = window.__orders; if (typeof at === 'string') { const d = door(at); if (!d) throw new Error('no door ' + at); return O.targetAt(d.frameCentre); } return O.targetAt([at[0], at[1] ?? 0, at[2]]); }
  function order(id, at, who = 'all', opts) { return window.__orders.give(id, target(at), who, opts) || 'ok'; }
  function cam(pin) { return window.__stage(pin, {}).pin; }
  function info() {
    const g = G(), sc = g.level.scenarios ?? {}, rc = sc.roomClear;
    return { t: +g.time.toFixed(2), sam: r1(g.player.char.pos), down: !!g.player.down,
      men: g.guards.map(gd => `${gd.callsign}:${gd.team}:${gd.state}@${r1(gd.char.pos)}`),
      civ: (g.civilians ?? []).map(gd => `${gd.callsign}:${gd.state}@${r1(gd.char.pos)}`),
      doors: g.doors.list.map(d => `${d.def.name}@${r1(d.frameCentre)}${d.off ? ':off' : Math.abs(d.angle) > 0.3 ? ':open' : d.locked ? ':locked' : ''}`),
      rooms: (rc?.rooms ?? []).map(r => `${r.id ?? r.name}`), shots: S.shots, log: S.log.slice(-30) };
  }
  // ── what a recipe asks of the run as it stands (so a camera can be laid on where the men ARE, not where a note said they were) ──
  const sam = () => G().player.char.pos;
  const ops = () => G().guards.filter(x => x.team === 'operative' && x.state !== 'dead');
  const foes = (all = false) => G().guards.filter(x => x.team !== 'operative' && (all || x.state !== 'dead'));
  const man = name => [...G().guards, ...(G().civilians ?? [])].find(x => x.callsign === name) ?? null;
  const at = x => typeof x === 'string' ? (door(x)?.frameCentre ?? man(x)?.char.pos) : Array.isArray(x) && x.length === 2 ? [x[0], 0, x[1]] : x.char ? x.char.pos : x;
  const nearest = (list, p = sam()) => list.slice().sort((a, b) => flat(a.char.pos, p) - flat(b.char.pos, p))[0] ?? null;
  const since = (re, t0 = 0) => S.log.some(l => parseFloat(l) >= t0 - 1e-6 && re.test(l));
  // the spot `back` metres short of a place on Sam's own walk to it
  function short(to, back = 3.5) {
    const g = G(), b = at(to), path = [sam().slice(), ...(g.col.nav.findPath(sam(), [b[0], 0, b[2]], 6000) ?? []), [b[0], 0, b[2]]]; let left = back;
    for (let i = path.length - 1; i > 0; i--) { const d = flat(path[i], path[i - 1]); if (d >= left) { const k = left / d; return [path[i][0] + (path[i - 1][0] - path[i][0]) * k, 0, path[i][2] + (path[i - 1][2] - path[i][2]) * k]; } left -= d; }
    return path[0];
  }
  // Sam walks up short of a place, the team in file behind him
  function approach(to, back = 3.5, secs = 45) { order('fallIn', sam()); go(short(to, back)); return sim(secs, () => arrived()); }
  // a camera laid over a set of places as they are now: look = their middle, the lens far enough back to hold them;
  // `from` = the side the camera stands on (a place; `turn` swings it round from there), else `yaw`
  function frameOn(places, o = {}) {
    const P = places.flatMap(p => Array.isArray(p) && typeof p[0] !== 'number' ? p : [p]).map(at).filter(Boolean);   // (a list of men opens out; a coordinate stays one place) let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    const c = [(x0 + x1) / 2 + (o.dx ?? 0), o.y ?? 1, (z0 + z1) / 2 + (o.dz ?? 0)], r = Math.max(...P.map(p => flat(p, c)), 0.5), f = o.from ? at(o.from) : null;
    const yaw = (f ? Math.atan2(f[0] - c[0], f[2] - c[2]) : (o.yaw ?? 0)) + (o.turn ?? 0);
    return cam({ look: c, yaw, pitch: o.pitch ?? 0.8, dist: o.dist ?? Math.min(o.max ?? 14, Math.max(o.min ?? 6.5, 2.2 * r + 3)) });
  }
  // a can / a charge has gone off within r metres of a place since t0 (a defender's own can across the level is not the squad's)
  function bangBy(place, t0 = 0, r = 7) { const c = at(place); return S.log.some(l => { const m = /^([\d.]+) bang @([-\d.]+),([-\d.]+)/.exec(l); return !!m && +m[1] >= t0 - 1e-6 && Math.hypot(+m[2] - c[0], +m[3] - c[2]) <= r; }); }
  // a step of the play that has to have happened: a sim / lead that ran out of time stops the recipe here
  function must(r, what = 'the play') { if (!r || r.hit === false) throw new Error(`${what} never got there (t ${r?.t})`); return r; }
  // Sam's own verbs: the row of that kind and verb, performed with a tap of Space (false = no such row in reach)
  function verb(kind, v) { const g = G(); if (!g.selectVerb(kind, v)) return false; window.__input.pressed.add('Space'); return true; }
  // Sam keeps to the back of a man on his round: re-pathed twice a second to `off` metres behind him, until he is within `near`
  // (and still behind him) or the man has turned on him. Crouch first (tap KeyC) for the quiet walk.
  function stalk(gd, o = {}) {
    const near = o.near ?? 1.6, off = o.off ?? 0.9, N = Math.round((o.secs ?? 60) * 60); quiet(true); let n = 0, why = 'time';
    for (; n < N; n++) {
      const p = gd.char.pos, yaw = gd.char.bodyYaw, f = [Math.sin(yaw), Math.cos(yaw)], s = sam();
      if (n % 20 === 0) go([p[0] - f[0] * off, 0, p[2] - f[1] * off]);
      frame();
      const d = flat(s, p), behind = (s[0] - p[0]) * f[0] + (s[2] - p[2]) * f[1] < 0;
      if (gd.state !== 'patrol') { why = gd.state; break; }
      if (d < near && behind) { why = 'behind'; break; }
      if (o.until && o.until()) { why = 'until'; break; }
    }
    S.path = null; return { t: +G().time.toFixed(2), frames: n, why, d: +flat(sam(), gd.char.pos).toFixed(2) };
  }
  window.__ms = { S, quiet, sim, lead, draw, go, arrived, door, target, order, cam, info, flat, frame,
    sam, ops, foes, man, at, nearest, since, short, approach, frameOn, verb, stalk,
    aim: p => { S.aim = p; }, hold: (k, on = true) => { on ? S.held.add(k) : S.held.delete(k); }, tap: k => window.__input.pressed.add(k), fire: () => window.__click(0),
    shotNow: () => S.by.length > 0, shooters: () => G().guards.filter(x => S.by.includes(x.char.id)), shots: () => S.shots, bangBy, must };
  try { const e = E(); if (e.height > 0) window.__cam.aspect = e.width / e.height; window.__cam.rebuild(); } catch { /* an identity lens until the first step, as before */ }
})();
