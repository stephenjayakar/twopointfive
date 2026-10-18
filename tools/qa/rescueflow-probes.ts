// The 'rescue-flow' sub-family of 'rescue' (game/rescueflow.ts + F's two-door entry in game/rescue.ts, run by the door tools — the hostage rescue's DYNAMIC TEMPO), run through probes.ts:
//   bun run tools/qa/probes.ts rescue-flow | rescue-flow-marks | rescue-flow-pass | rescue-flow-states | rescue-flow-orders | rescue-flow-twodoor   [--verbose]
// PASS / FAIL each, all headless, on rescue-probes.ts's rig (the scenario started with game.rescue.start(), Sam teleported along the corridor at his walk — nothing
// here plays his part of a fight; what anybody SEES is the harness's reading of the night, as there).
//   rescue-flow-marks    the route's marks against the floor (RescueFlow.check) and the side door's (SIDE_MARKS — what the door tools stack and stand off on
//                        where the racks leave no floor at its jambs): free floor, a line from each cover mark to what it watches, something to look at
//                        through every opening; the door tools' own stack and points of domination for that door
//   rescue-flow-pass     Sam walks the corridor from the arch to the hostage room's door and gives no order: every opening he passes is taken by ONE man, in
//                        order, with its call; that man is on its mark with his gun on it; the other man never leaves Sam; never both men away at once;
//                        nobody goes into a room; the man catches up; a sprint arrives a man short ('wait one.')
//   rescue-flow-states   what the player is shown: a strip on the floor at every opening in its state's colour, the objective line's 'behind you', the squad
//                        block's words; a shut door reads shut; one of theirs seen in a room turns it hot and its cover is HELD ('contact — holding.') until
//                        he is dead; a room Sam walks through is cleared and is not covered again; with both men on him, the last holds the corridor while Sam
//                        is in a room; RESCUE.marks off: no strip, no words
//   rescue-flow-orders   the menu overrides: an order to the man on a cover takes him off it and the flow does not send the next man behind Sam's back; men
//                        told to hold are left alone while Sam passes openings; 'fall in' hands them back and the next opening is covered; RESCUE.flow off:
//                        nobody covers anything; a lone man covers (flowSolo) or stays on Sam (off)
//   rescue-flow-twodoor  the hostage room through both doors on one F, two of the door tools' bang and clears through one gate: a man posted in the server room
//                        takes the side door, the other the corridor door — both leaves on one frame (the corridor door booted, the unlocked side door shoved
//                        with the boot), a can through each, both entries inside a tenth of a second, the run resolves; F from the server room with both men
//                        free splits them the same way; a man Sam has on a cover is left on it (F is a man short, and with both covering F is refused); a menu
//                        order calls it off on the walk and with the boots going in (the door tools' rule); twoDoor off: everybody to the corridor door
import { ROOT } from './headless.ts';
import { rig, family, guarded, staged, give, orderOf, up, dist, f1, DT } from './rescue-probes.ts';
const { SIDE_MARKS } = await import(`${ROOT}/src/game/rescue.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { NVG } = await import(`${ROOT}/src/game/nvg.ts`);
const { DARKFOE } = await import(`${ROOT}/src/game/darkfoe.ts`);

type Said = { t: number; who: string; text: string };
/** everything any man says from here on (Game.say is the one mouth) */
function ears(T: any): Said[] { const g = T.game, said: Said[] = [], say0 = g.say.bind(g); g.say = (gd: any, text: string, radio?: boolean) => { said.push({ t: g.time, who: gd.callsign, text }); return say0(gd, text, radio); }; return said; }
const flowLog = (T: any) => T.R.log.filter((l: any) => l.what.startsWith('flow:')).map((l: any) => l.what);
const strips = (T: any) => T.game.dynBoxes.filter((b: any) => Math.abs(b.c[1] - 0.012) < 1e-6 && b.h[1] === 0.008);
const INSIDE = (p: number[], B: { x0: number; x1: number; z0: number; z1: number }) => p[0] > B.x0 && p[0] < B.x1 && p[2] > B.z0 && p[2] < B.z1;
const CONF = { x0: 4.12, x1: 13.94, z0: 4.12, z1: 9.94 }, SERVER = { x0: 14.12, x1: 21.88, z0: 4.12, z1: 9.94 }, CUB = { x0: 12.2, x1: 27.8, z0: 12.3, z1: 23.9 }, OFFICE = { x0: 22.12, x1: 29.94, z0: 4.12, z1: 9.94 };
/** Sam along a straight line at `speed`, `each` called after every frame. The default is HIS WALK (Game.tune.playerWalk 1.55 m/s): it was a 3.2 m/s jog — a pace
 *  the player does not have (he walks at 1.55 or sprints at 4.7) and one the team could once match; a teammate's legs now stop at guards.ts PACE.max 2.2 */
function walk(T: any, to: number[], speed = 1.55, each?: () => void) {
  const p = T.game.player.char.pos, from = [p[0], 0, p[2]], n = Math.max(1, Math.ceil(dist(from, to) / (speed * DT)));
  for (let i = 1; i <= n; i++) { T.game.teleportPlayer([from[0] + (to[0] - from[0]) * i / n, 0, from[2] + (to[2] - from[2]) * i / n]); T.step(); each?.(); }
}
const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };

export const flowMarks = guarded(async () => {
  const F = family('rescue-flow-marks: the route\'s marks and the side door\'s against the floor');
  const T = await rig(3, {}); const R = T.R, g = T.game, nav = g.col.nav;
  const bad = R.flow.check();
  F.verdict(bad.length === 0 && R.flow.route.length === 4, 'the four openings: every cover mark on free floor with a line to what it watches, something to see through each', bad.join(' · ') || R.flow.known.map((k: any) => `${k.o.id}: ${k.lookable.length} of ${k.region.pts.length} floor samples seen through it`).join(' · '));
  const S = SIDE_MARKS, sd = g.doors.byName('server_manager'), DTL = g.doorTools;
  const free = (p: number[]) => !nav.isBlocked(p[0], p[2]);
  const west = [...S.stack, ...S.standoff].every((p: number[]) => free(p) && INSIDE(p, SERVER));
  const reach = dist(S.stack[0], sd.frameCentre) < 1.8 && !!nav.findPath([20.4, 0, 8.7], S.stack[0]) && S.standoff.every((p: number[]) => dist(p, sd.frameCentre) > DOORTOOLS.backblastM + 0.15);
  F.verdict(!!sd && west && reach, 'the side door\'s marks: its stack on the server room\'s floor two strides from the leaf, the stand-off for a charge outside its backblast', `on free floor in the server room ${west} · the stack ${dist(S.stack[0], sd.frameCentre).toFixed(2)} m from the leaf's middle · stand-off ${S.standoff.map((p: number[]) => dist(p, sd.frameCentre).toFixed(1)).join(' / ')} m (backblast ${DOORTOOLS.backblastM})`);
  // cover: with the leaf out of the frame (as once it is shoved, kicked or blown), who in the hostage room has a line to a man on a mark?
  { const col = g.col, keep = col.dynamicBoxes; col.dynamicBoxes = keep.filter((b: any) => b !== sd.box);
    const line = (from: number[], p: number[]) => [1.2, 1.6].some(h => !col.shotBlocked([from[0], 1.45, from[2]], [p[0], h, p[2]]));
    const cells: number[][] = []; for (let x = OFFICE.x0 + 0.3; x < OFFICE.x1; x += 0.3) for (let z = OFFICE.z0 + 0.3; z < OFFICE.z1; z += 0.3) if (!nav.isBlocked(x, z)) cells.push([x, 0, z]);
    const posted = [...R.hostiles.filter((h: any) => INSIDE(h.char.pos, OFFICE)).map((h: any) => [...h.char.pos]), [23.4, 0, 6.6]];   // (the captor where he stands + the inside door man's mark)
    const all = [...S.stack, ...S.standoff], share = all.map((p: number[]) => cells.filter(c => line(c, p)).length / cells.length), seen = all.filter((p: number[]) => posted.some(c => line(c, p)));
    const old = [21.4, 0, 9.42], oldShare = cells.filter(c => line(c, old)).length / cells.length, oldSeen = posted.some(c => line(c, old));
    col.dynamicBoxes = keep;
    F.verdict(cells.length > 100 && posted.length >= 2 && seen.length === 0 && share.every((f: number) => f < 0.25) && oldShare > 0.25 && oldSeen,
      'the side door\'s marks are behind cover from the hostage room with the leaf open: nobody on a defender\'s mark has a line to a man on one, and under a quarter of the room\'s floor does', `seen from the defenders' marks ${seen.length} of ${all.length} · share of the room's ${cells.length} floor samples with a line: ${share.map((f: number) => (100 * f).toFixed(0) + ' %').join(' / ')} (the corner past the latch, where a stack would go by habit: ${(100 * oldShare).toFixed(0)} %, and in the inside door man's view ${oldSeen})`); }
  const posts = g.orders.stackPosts(sd, 1, R.ops), pods = DTL.pods(sd, 1);
  F.verdict(!!posts && posts.length === 2 && dist(posts[0].pos, S.stack[0]) < 0.05 && dist(posts[1].pos, S.stack[1]) < 0.05 && pods.length >= 1 && pods.every((q: any) => free(q.pos) && INSIDE(q.pos, OFFICE)),
    'the door tools take them: a stack on that face of the side door is the marks (its jambs have no floor), and its points of domination are on the office\'s floor', `stack ${posts?.map((q: any) => q.pos.map((v: number) => v.toFixed(1)).join(',')).join(' / ') ?? 'none'} · points inside ${pods.map((q: any) => q.pos.map((v: number) => v.toFixed(1)).join(',')).join(' / ')}`);
  const fd = g.doors.byName('manager'), fposts = g.orders.stackPosts(fd, 1, R.ops), M = g.orders.doorMarks;
  F.verdict(M.length === 1 && M[0].door === sd && !!fposts && fposts.every((q: any) => q.pos[2] > 10) && (R.stop(), g.orders.doorMarks.length === 0 && DTL.linked.length === 0),
    'the marks are the scenario\'s own: one door\'s, the corridor door stacked off its jambs as ever, and gone (with the two doors\' link) when it stops', `marks registered ${M.length} · corridor door stack ${fposts?.map((q: any) => q.pos.map((v: number) => v.toFixed(1)).join(',')).join(' / ')} · after stop(): ${g.orders.doorMarks.length} marks, ${DTL.linked.length} linked doors`);
  return F.done();
});

export const flowPass = staged(['DOORMANNERS.on'], async () => {
  const F = family('rescue-flow-pass: Sam walks the corridor and gives no order — the last man covers each opening, the other stays on him');
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, g = T.game, said = ears(T); T.secs(0.3);
    let nearMax = 0, both = 0, inRoom = '', onMark: Record<string, boolean> = {};
    const each = () => {
      if (isNaN(R.t0) || g.time - R.t0 < 1.5) return;   // (the first second and a half is the pair falling in from the arch)
      const ds = R.ops.map((o: any) => dist(o.char.pos, g.player.char.pos)); nearMax = Math.max(nearMax, Math.min(...ds));
      if (R.flow.jobs.size > 1) both++;
      for (const o of R.ops) { for (const [n, B] of [['conference', CONF], ['server', SERVER], ['cubicles', CUB]] as const) if (INSIDE(o.char.pos, B)) inRoom = `${o.callsign} in the ${n}`;
        const J = R.flow.jobOf(o); if (!J) continue; const O = R.flow.route.find((x: any) => x.id === J.opening);
        if (dist(o.char.pos, O.mark) < 0.6 && Math.abs(wrap(o.char.aimYaw - yawTo(o.char.pos, O.watch))) < 0.3) onMark[O.id] = true; }
    };
    walk(T, [8.2, 0, 11.2], 1.55, each); walk(T, [24.6, 0, 11.2], 1.55, each);
    const tStop = g.time; let back = NaN;
    for (let i = 0; i < 900 && isNaN(back); i++) { T.step(); each(); if (R.flow.jobs.size === 0 && R.ops.every((o: any) => orderOf(T, o) === 'fallIn' && dist(o.char.pos, g.player.char.pos) < 4)) back = g.time - tStop; }
    const L = flowLog(T), takes = L.filter((w: string) => w.startsWith('flow:take:')), ids = takes.map((w: string) => w.split(':')[2]), men = new Set(takes.map((w: string) => w.split(':')[3]));
    F.verdict(ids.join(',') === 'conference,cubicles-w,server,cubicles-e', 'every opening Sam passes is taken, in the order he passes them, with no order given', `${takes.join(' · ')} · menu orders in the log: ${g.orders.log.length} (the unasked fall in)`);
    const calls = ['glass left.', 'opening right.', 'door left.', 'opening right.'], heard = said.filter(s => calls.includes(s.text)).map(s => s.text);
    F.verdict(heard.join('|') === calls.join('|') && said.filter(s => calls.includes(s.text)).every(s => men.has(s.who)), 'each is called by the man taking it: glass left · opening right · door left · opening right', said.map(s => `${(s.t - R.t0).toFixed(1)} ${s.who}: ${s.text}`).join(' · '));
    F.verdict(Object.keys(onMark).length === 4, 'on each he stands on its mark with his gun on it', `on mark with the gun on the opening: ${Object.keys(onMark).join(', ') || 'none'}`);
    F.verdict(men.size === 1 && both === 0 && nearMax < 3.5, 'one man works the openings; the other is never more than a few steps from Sam; never both away at once', `men on covers: ${[...men].join(', ')} · the nearer man's worst distance from Sam ${nearMax.toFixed(2)} m · frames with both on a job ${both}`);
    F.verdict(!inRoom && !T.bad, 'nobody goes into a room he was only told to pass', inRoom || 'never inside the conference room, the server room or the cubicles');
    F.verdict(back < 8, 'he catches up: both men on Sam again at the hostage room\'s door', `${f1(back)} s after Sam stopped at x ${g.player.char.pos[0].toFixed(1)} (that long a man short)`);
  }
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, g = T.game, said = ears(T); T.secs(0.3);
    walk(T, [8.2, 0, 11.2], 4.7); walk(T, [24.6, 0, 11.2], 4.7);
    const tStop = g.time; let back = NaN; const lag = Math.max(...R.ops.map((o: any) => dist(o.char.pos, g.player.char.pos)));
    for (let i = 0; i < 900 && isNaN(back); i++) { T.step(); if (R.flow.jobs.size === 0 && R.ops.every((o: any) => orderOf(T, o) === 'fallIn' && dist(o.char.pos, g.player.char.pos) < 4)) back = g.time - tStop; }
    F.verdict(said.some(s => s.text === 'wait one.') && lag > 6 && back < 12, 'a sprint: Sam arrives a man short, and the man working the openings says so (wait one.)', `at the door the far man was ${lag.toFixed(1)} m back · both on Sam ${f1(back)} s later · ${flowLog(T).filter((w: string) => /take|queue|wait/.test(w)).join(' · ')}`);
  }
  { // NOT a pass: into the cubicles from the lobby, and onto the corridor out of the cubicles' east doorway — nothing was walked past, nobody is sent back west
    const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, g = T.game; T.secs(0.3);
    g.teleportPlayer([9, 0, 16]); T.secs(1.0); walk(T, [14, 0, 16]); T.secs(2);
    const hold = flowLog(T).some((w: string) => w.startsWith('flow:corridor'));
    walk(T, [22.75, 0, 14]); walk(T, [22.75, 0, 11.2]); walk(T, [24.6, 0, 11.2]); T.secs(3);
    const L = flowLog(T).filter((w: string) => /^flow:(take|pass|queue|corridor)/.test(w));
    F.verdict(!hold && L.length === 0 && R.ops.every((o: any) => orderOf(T, o) === 'fallIn') && !R.objective().text.includes('behind you'), 'round by the lobby and the cubicles, out of the east doorway to the hostage room\'s door: no corridor hold, nothing passed, nobody sent back', `corridor hold ${hold} · ${L.join(' · ') || 'no takes, no passes'} · '${R.objective().text}'`);
  }
  { // the flow coming on with Sam already most of the way down the corridor: what he walked past is behind him on the line, and nobody is sent back for it
    const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false, flow: false }); const R = T.R; T.secs(0.3);
    walk(T, [8.2, 0, 11.2]); walk(T, [21, 0, 11.2]); T.secs(1.5);
    R.knobs.flow = true; let west = 99; T.secs(3, () => { west = Math.min(west, ...R.ops.map((o: any) => o.char.pos[0])); return false; });
    const early = flowLog(T).filter((w: string) => w.startsWith('flow:take'));
    walk(T, [24.6, 0, 11.2]); T.secs(1);
    const late = flowLog(T).filter((w: string) => w.startsWith('flow:take')).map((w: string) => w.split(':')[2]);
    F.verdict(early.length === 0 && west > 16 && late.join(',') === 'cubicles-e' && /behind you ▸ conf /.test(R.objective().text), 'switched on with Sam at the server room: nobody runs back for what is already behind him; the next opening he passes is covered', `takes before he moves on ${early.length} · the pair's westmost x in those 3 s ${west.toFixed(1)} · then ${late.join(',') || 'none'} · '${R.objective().text}'`);
  }
  return F.done();
});

export const flowStates = staged(['DOORMANNERS.on', 'glass'], async () => {
  const F = family('rescue-flow-states: what the player is shown of each opening');
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, g = T.game; T.secs(0.3);
    const s0 = strips(T); const amber = (b: any) => b.emissive[0] > b.emissive[2] * 4 && b.emissive[1] > 0.3;
    F.verdict(s0.length === 4 && s0.every((b: any) => (b.flags & 2) !== 0) && !R.objective().text.includes('behind you'), 'staged: a strip on the floor at each of the four openings, each a NoShadow box (no ray, no light meter, no guard sees it); nothing is behind Sam yet', `${s0.length} strips at x ${s0.map((b: any) => b.c[0].toFixed(1)).sort().join(', ')} · objective '${R.objective().text}'`);
    let heldSeen = '', blue = false, words = '';
    walk(T, [8.2, 0, 11.2]); walk(T, [13.5, 0, 11.2], 1.55, () => {
      if (R.flow.stateOf('conference') === 'held') { heldSeen = R.objective().text; const b = strips(T).find((x: any) => Math.abs(x.c[0] - 9.6) < 0.1); blue = !!b && b.emissive[2] > b.emissive[0] * 3;
        const w = g.orders.hud().status.map((r: any) => r.opts.map((o: any) => o.text).join(' ')).join(' | '); if (!/covering conference room/.test(words)) words = w; } });   // (his row WHILE he is on the cover: at Sam's walk he is done and catching up before Sam is at the far end of this leg, the opening still reading held)
    F.verdict(heldSeen.includes('behind you ▸ conf held') && blue && /covering conference room/.test(words), 'the conference room while a man covers it: HELD — a blue strip, the objective line, his row in the squad block', `objective '${heldSeen}' · strip blue ${blue} · squad block '${words}'`);
    walk(T, [24.6, 0, 11.2]); T.secs(7);
    const txt = R.objective().text, st = R.flow.route.map((o: any) => `${o.id} ${R.flow.stateOf(o.id)}`);
    const sv = strips(T).find((x: any) => Math.abs(x.c[0] - 17.6) < 0.1), cw = strips(T).find((x: any) => Math.abs(x.c[0] - 15.75) < 0.1);
    F.verdict(/server shut/.test(txt) && R.flow.stateOf('server') === 'unknown' && amber(sv) && R.flow.stateOf('cubicles-w') === 'looked' && !amber(cw) && /cub W looked/.test(txt) && /cub E looked/.test(txt),
      'behind Sam at the hostage room: the cubicles\' doorways LOOKED (pale), the server room\'s door never opened — unknown, shown as shut (amber)', `'${txt}' · ${st.join(' · ')}`);
    T.secs(12);
    F.verdict(R.flow.stateOf('conference') === 'unknown' && /conf unknown/.test(R.objective().text), 'a look goes stale: ten seconds with no eyes on it and the conference room is unknown again', `'${R.objective().text}'`);
  }
  { // one of theirs in the conference room, seen through the glass: hot, and held for as long as he is
    const T = await rig(5, { doorMan: 'inside', roamers: 2, clock: false, setSecs: 999 }); const R = T.R, g = T.game, said = ears(T); T.secs(0.3);
    const man = R.hostiles.find((h: any) => INSIDE(h.char.pos, CONF));
    walk(T, [8.2, 0, 11.2]); walk(T, [12.5, 0, 11.2]);
    T.secs(5);
    const J = [...R.flow.jobs.keys()][0], held = J ? orderOf(T, J) === 'cover' && dist(J.char.pos, [9.0, 0, 11.55]) < 1.2 : false;
    const red = (() => { const b = strips(T).find((x: any) => Math.abs(x.c[0] - 9.6) < 0.1); return !!b && b.emissive[0] > b.emissive[1] * 5; })();
    F.verdict(!!man && man.state !== 'dead' && R.flow.stateOf('conference') === 'hot' && red && held && said.some(s => s.text === 'contact left — holding.') && /HOT/.test(R.objective().text),
      'one of theirs seen in the conference room through its glass: HOT — a red strip, the objective line, and the man covering it stays on it', `roamer in the conference room: ${man?.callsign} ${man?.state} · state ${R.flow.stateOf('conference')} · red ${red} · still covering five seconds on ${held} · said ${said.filter(s => /contact|holding/.test(s.text)).map(s => s.text).join(', ')} · '${R.objective().text}' · ${T.shots.operative ?? 0} team rounds`);
    if (man && man.state !== 'dead') killGuard(g, man, [1, 0, 0], false, 'shot', 'player');
    const done = T.secs(6, () => R.flow.jobs.size === 0);
    F.verdict(done && R.flow.stateOf('conference') !== 'hot' && R.ops.every((o: any) => o.state === 'dead' || orderOf(T, o) === 'fallIn'), 'he is dead: the room is hot no longer and the man catches up', `state ${R.flow.stateOf('conference')} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · ${flowLog(T).filter((w: string) => /hold|done|hot/.test(w)).join(' · ')}`);
  }
  { // Sam turns into the conference room with both men on him: one holds the corridor; the room walked through is cleared, and is not covered when he passes it again
    const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, g = T.game, said = ears(T); T.secs(0.3);
    walk(T, [8.2, 0, 11.2]); walk(T, [9.6, 0, 10.9], 2); T.secs(2.5);   // (short of the door: nothing passed yet, both men up with him)
    walk(T, [9.6, 0, 8.6], 2); T.secs(1.5);
    const cj = [...R.flow.jobs].find(([, J]: any) => J.kind === 'corridor'), inWith = R.ops.filter((o: any) => INSIDE(o.char.pos, CONF) || dist(o.char.pos, g.player.char.pos) < 3).length;
    const heldNow = R.flow.known.filter((k: any) => k.state === 'held').map((k: any) => k.o.id);
    F.verdict(!!cj && said.some(s => s.text === 'corridor.') && inWith >= 1 && heldNow.length === 0, 'Sam goes into the conference room: the last man holds the corridor at its door (corridor.), the other goes in with him; no opening reads HELD for it (his gun is down the corridor)', `corridor job: ${cj ? cj[0].callsign : 'none'} · men with Sam ${inWith} · held: ${heldNow.join(', ') || 'none'} · ${said.map(s => s.text).join(' ')}`);
    walk(T, [6.0, 0, 6.0], 2.5); walk(T, [12.0, 0, 6.0], 2.5); walk(T, [9.6, 0, 8.6], 2.5);
    const cleared = R.flow.stateOf('conference');
    walk(T, [9.6, 0, 11.2], 2); T.secs(0.5);
    const backOut = ![...R.flow.jobs.values()].some((J: any) => J.kind === 'corridor');
    const before = flowLog(T).filter((w: string) => w.startsWith('flow:take:conference')).length;
    walk(T, [14.0, 0, 11.2]); T.secs(1);
    const after = flowLog(T).filter((w: string) => w.startsWith('flow:take:conference')).length;
    const b = strips(T).find((x: any) => Math.abs(x.c[0] - 9.6) < 0.1), green = !!b && b.emissive[1] > b.emissive[0] * 4 && b.emissive[1] > b.emissive[2] * 2;
    F.verdict(cleared === 'cleared' && backOut && after === before && green && /conf clear/.test(R.objective().text), 'the room walked through is CLEARED (green); back in the corridor the man rejoins, and passing a cleared room sends nobody to cover it',
      `state after the walk ${cleared} · corridor job ended ${backOut} · covers of it after ${after - before} · green ${green} · '${R.objective().text}'`);
  }
  { // a hot room goes cold: the man leaves it unseen, Sam walks the room — not HOT for ever
    // (bare eyes for this one: 'out of everybody's sight' below is the dark far end of the break room, and a pair on its goggles — nvg.ts — sees him THERE, which
    //  lets the room go by the other rule, 'seen anywhere else', with no cold call to check)
    const nv = NVG.on; NVG.on = false;
    const T = await rig(5, { doorMan: 'inside', roamers: 2, clock: false, setSecs: 999 }); const R = T.R, g = T.game; T.secs(0.3);
    const df = DARKFOE.on; DARKFOE.on = false;   // (…and his own gun light off, for the same reason: darkfoe.ts would have the hidden man burn it in that dark corner and be seen by it. Thrown after the rig: the shipped stand raises the switch as it stands a game up)
    const man = R.hostiles.find((h: any) => INSIDE(h.char.pos, CONF));
    walk(T, [8.2, 0, 11.2]); walk(T, [9.6, 0, 10.9], 2); T.secs(1);
    const wasHot = R.flow.stateOf('conference') === 'hot';
    if (man) { man.hold = true; man.char.pos[0] = 33; man.char.pos[2] = 21.5; if (man.char.bones.chest) { man.char.bones.chest[0] = 33; man.char.bones.chest[2] = 21.5; } }   // (out of the room, out of everybody's sight: the far end of the break room)
    walk(T, [9.6, 0, 8.6], 2); walk(T, [6.0, 0, 6.0], 2.5); walk(T, [12.0, 0, 6.0], 2.5); T.secs(1);
    const st = R.flow.stateOf('conference');
    F.verdict(!!man && wasHot && flowLog(T).includes('flow:cold:conference') && st !== 'hot' && !/conf HOT/.test(R.objective().text), 'a hot room the team then walks through and finds empty goes cold (and can be cleared)', `was hot ${wasHot} · after the walk ${st} · ${flowLog(T).filter((w: string) => /hot|cold|cleared/.test(w)).join(' · ')} · man ${man?.state} at ${man?.char.pos.map((x: number) => x.toFixed(1))} · '${R.objective().text}'`);
    NVG.on = nv; DARKFOE.on = df;
  }
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false, marks: false }); const R = T.R; T.secs(0.3);
    walk(T, [8.2, 0, 11.2]); walk(T, [20, 0, 11.2]);
    F.verdict(strips(T).length === 0 && !R.objective().text.includes('behind you') && flowLog(T).some((w: string) => w.startsWith('flow:take')), 'RESCUE.marks off: no strip and no words (the pair still cover)', `${strips(T).length} strips · '${R.objective().text}'`);
  }
  return F.done();
});

export const flowOrders = guarded(async () => {
  const F = family('rescue-flow-orders: the menu overrides the flow; the switches');
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false }); const R = T.R, g = T.game; T.secs(0.3);
    walk(T, [8.2, 0, 11.2]); walk(T, [11.0, 0, 11.2]);
    const J = [...R.flow.jobs.keys()][0]; const was = J ? orderOf(T, J) : 'none';
    const w = give(T, 'hold'); T.secs(0.3);
    const p0 = R.ops.map((o: any) => [...o.char.pos]);
    walk(T, [24.6, 0, 11.2]); T.secs(4);
    const drift = Math.max(...R.ops.map((o: any, i: number) => dist(o.char.pos, p0[i]))), L = flowLog(T);
    const takesAfter = L.slice(L.findIndex((x: string) => x.startsWith('flow:override')) + 1).filter((x: string) => x.startsWith('flow:take')).length;
    F.verdict(!!J && was === 'cover' && w === null && R.ops.every((o: any) => orderOf(T, o) === 'hold') && drift < 0.8 && L.some((x: string) => x.startsWith('flow:override')) && takesAfter === 0 && R.flow.jobs.size === 0,
      'hold, given while a man is on a cover: he is the menu\'s that frame; Sam runs on past three more openings and nobody is sent', `he was on '${was}' · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · moved ${drift.toFixed(2)} m · covers after the order ${takesAfter} · ${L.filter((x: string) => /override|unmanned/.test(x)).join(' · ')}`);
    g.teleportPlayer([13.0, 0, 11.2]); T.secs(0.2);
    const w2 = give(T, 'fallIn'); T.secs(4);
    const n0 = flowLog(T).filter((x: string) => x.startsWith('flow:take')).length;
    walk(T, [19.0, 0, 11.2]); T.secs(0.5);
    const n1 = flowLog(T).filter((x: string) => x.startsWith('flow:take')).length;
    F.verdict(w2 === null && n1 > n0, 'fall in hands them back: the next openings Sam passes are covered again', `covers before ${n0}, after ${n1} · ${flowLog(T).slice(-4).join(' · ')}`);
    // one man put on a cover by Sam: the flow leaves him, and — the other being the only man in the file — takes the openings with that one
    const k = R.ops.indexOf([...R.flow.jobs.keys()][0] ?? R.ops[0]) === 0 ? 1 : 0, stay = R.ops[k];
    const w3 = g.orders.give('cover', { kind: 'floor', at: [25, 0, 11.2] }, k); T.secs(0.3); const sp = [...stay.char.pos];
    walk(T, [24.6, 0, 11.2]); T.secs(6);
    F.verdict(w3 === null && orderOf(T, stay) === 'cover' && dist(stay.char.pos, sp) < 0.6 && !flowLog(T).some((x: string) => x.startsWith('flow:take') && x.endsWith(stay.callsign)), 'a man Sam posts on a cover of his own stays on it whatever Sam passes', `${stay.callsign}: ${orderOf(T, stay)}, moved ${dist(stay.char.pos, sp).toFixed(2)} m`);
  }
  { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false, flow: false }); const R = T.R; T.secs(0.3);
    let maxLag = 0; walk(T, [8.2, 0, 11.2]); walk(T, [24.6, 0, 11.2], 1.55, () => { if (T.game.time - R.t0 > 1.5) maxLag = Math.max(maxLag, ...R.ops.map((o: any) => dist(o.char.pos, T.game.player.char.pos))); });
    const offTxt = R.objective().text;
    F.verdict(!flowLog(T).some((x: string) => /take|queue|corridor/.test(x)) && R.ops.every((o: any) => orderOf(T, o) === 'fallIn') && maxLag < 5 && strips(T).length === 4 && /behind you ▸ conf .* · cub W .* · server .* · cub E /.test(offTxt), 'RESCUE.flow off: nobody covers anything — the pair follow, as the build had it (the strips and the objective line still show what the team has seen of what Sam passed)', `flow lines other than states and passes ${flowLog(T).filter((x: string) => !/^flow:(state|pass)/.test(x)).length} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · worst lag ${maxLag.toFixed(1)} m · '${offTxt}'`);
  }
  for (const solo of [true, false]) { const T = await rig(12, { doorMan: 'inside', roamers: 0, clock: false, flowSolo: solo }); const R = T.R, g = T.game; T.secs(0.3);
    killGuard(g, R.ops[0], [1, 0, 0], false, 'shot', 'guard'); T.secs(0.2);
    walk(T, [8.2, 0, 11.2]); walk(T, [14.0, 0, 11.2]); T.secs(0.3);
    const n = flowLog(T).filter((x: string) => x.startsWith('flow:take')).length;
    F.verdict(solo ? n >= 1 : n === 0 && orderOf(T, R.ops[1]) === 'fallIn', solo ? 'one man left: he still peels off to cover what Sam passes (flowSolo)' : 'flowSolo off: the one man left stays on Sam', `covers ${n} · ${R.ops[1].callsign}: ${orderOf(T, R.ops[1])}`);
  }
  return F.done();
});

/** the server room opened (as a kick of Sam's opens it) and one man sent to stand by the side door on the menu's 'move there' */
async function sideRig(seed: number, knobs: Record<string, unknown> = {}) {
  const T = await rig(seed, { doorMan: 'inside', roamers: 0, flow: false, ...knobs }); const R = T.R, g = T.game; T.secs(0.3);
  const sv = g.doors.byName('server'); g.doors.kickIn(sv, [17.6, 0, 11.0], g.player.char.id);
  T.secs(0.6);
  return { T, R, g };
}
const beat = (T: any, what: string) => T.at(what);

export const flowTwoDoor = staged(['DARKFOE.on', 'RESCUEEND.on'], async () => {
  const F = family('rescue-flow-twodoor: the hostage room through both doors on one F');
  if (process.env.GATEHAND_BREAK) DOORTOOLS.gateHand = false;   // (GATEHAND_BREAK=1: the side door's man steps to its handle only after the boot beside him has landed, as it was — where leaves are worked from the handle the two leaves are then a walk apart and the line below must go red)
  // where doors open one way a can is not thrown at a leaf (DOORTOOLS.bangWay) and a SHOVED leaf is two tenths of a second longer getting out of its can's way
  // than a booted one: the leaves are still asked on one frame, the cans and the men a quarter of a second apart. Double-acting leaves: a tenth, as it was.
  const apart = () => DOORWAY.oneWay ? 0.25 : 0.1;   // (asked once a game stands: the stand's own rows are in by then)
  { let secured = 0, alive = 0, teamUp = 0; const N = 6; let shown = '';
    for (let s = 0; s < N; s++) {
      const { T, R, g } = await sideRig(40 + s, { clock: false }); const DTL = g.doorTools;
      const w = g.orders.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1);
      const there = T.secs(14, () => INSIDE(R.ops[1].char.pos, SERVER) && dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
      T.press('KeyF');
      const split = R.log.find((l: any) => l.what.startsWith('split:front'))?.what ?? 'no split', kinds = R.entry?.ops.map((e: any) => `${e.op.kind}:${e.op.door.def.name}`).join(' + ') ?? 'no entry', oneGate = !!R.entry && R.entry.ops.every((e: any) => e.op.gate === R.entry.gate);
      // how far each leaf went in, and where the side leaf stood as its man was sent through it. Where it stands at the END is not asked of the side door: on this
      // stand (double-acting leaves, closers) a man who meets an open leaf's free edge on the way to his point pulls it to behind him — at real-size doors the
      // side man's point is on the hinge's hand of the door (the other hand's is in the north wall's margin), so he does. As shipped the leaf stays at its stop.
      const fd = g.doors.byName('manager'), sd = g.doors.byName('server_manager'); let inF = 0, inS = 0, sideAtIn = NaN;
      T.secs(40, () => { inF = Math.max(inF, Math.abs(fd.angle)); inS = Math.max(inS, Math.abs(sd.angle)); if (isNaN(sideAtIn) && T.at('enter:side') !== undefined) sideAtIn = Math.abs(sd.angle);
        return !!T.at('clear') || !!R.result || (!!T.at('enter1') && T.game.time - T.at('enter1')! > 16); });
      const fl = beat(T, 'door-flung'), fs = beat(T, 'door-flung:side'), e1 = beat(T, 'enter1'), es = beat(T, 'enter:side'), b1 = beat(T, 'bang'), bs = beat(T, 'bang:side');
      if (s === 0) { const APART = apart();
        F.verdict(w === null && there && split === 'split:front=Blue One,side=Blue Two' && kinds === 'bangClear:manager + bangClear:server_manager' && oneGate, 'a man moved to the side door on the menu, then one F: he has the side door, the other the corridor door — two of the door tools\' bang and clears on one gate', `move there: ${w ?? 'given'}, in place ${there} · ${split} · ${kinds} · one gate ${oneGate}`);
        F.verdict(T.order(['split:set', 'split:go', 'kick', 'door-flung', 'toss', 'bang', 'enter1']) && fl !== undefined && fs !== undefined && Math.abs(fl - fs) < 0.02 && b1 !== undefined && bs !== undefined && Math.abs(b1 - bs) < APART && !!T.at('toss:side') && e1 !== undefined && es !== undefined && Math.abs(e1 - es) < APART && DTL.bangs === 1,
          `both set → both leaves on one frame → a can through each (two of the squad\'s three), off together → both men in, inside ${APART > 0.1 ? 'a quarter' : 'a tenth'} of a second of each other`, `leaves ${f1(T.since('door-flung'))} / ${f1(T.since('door-flung:side'))} s · bangs ${f1(T.since('bang'))} / ${f1(T.since('bang:side'))} s · in ${f1(T.since('enter1'))} / ${f1(T.since('enter:side'))} s (from the clock's start) · set ${f1(T.since('split:set'))} s · bangs left ${DTL.bangs}`);
        F.verdict(Math.abs(fd.angle) > 0.8 && inS > 0.8 && sideAtIn > 0.8 && fd.lockBroken && !sd.lockBroken, 'both leaves go in: the corridor door booted off its lock and standing in, the side door (unlocked at staging) shoved with the boot and in as its man is sent through',
          `corridor door in to ${inF.toFixed(2)} rad, ${fd.angle.toFixed(2)} at the end, lock broken ${fd.lockBroken} · side door in to ${inS.toFixed(2)} rad, ${isNaN(sideAtIn) ? 'nobody sent through it' : `${sideAtIn.toFixed(2)} as its man was sent in`}, ${sd.angle.toFixed(2)} at the end, lock broken ${sd.lockBroken}`);
        shown = R.summary();
      }
      T.secs(6, () => R.state === 'secured' || !!R.result);
      if (R.state === 'secured' || R.result?.state === 'rescued') secured++; alive += up(R.hostages); teamUp += up(R.ops);
      if (s === 0) F.verdict(R.mode === 'free' && R.entry === null && R.ops.every((o: any) => o.state === 'dead' || g.orders.has(o)) && !T.bad, 'it resolves: the men up are the menu\'s again', `'${shown}' → '${R.summary().slice(0, 150)}'`);
    }
    F.verdict(secured >= N / 2, `over ${N} seeds the two-door entry takes the room at least half the time (Sam a statue in the corridor)`, `secured ${secured}/${N} · hostages alive ${alive}/${2 * N} · pair up ${teamUp}/${2 * N}`);
  }
  { // F from inside the server room with both men falling in: split by who is nearer the side door
    const { T, R, g } = await sideRig(7, { clock: false });
    walk(T, [17.6, 0, 11.2]); walk(T, [17.6, 0, 8.6]); walk(T, [19.6, 0, 8.6]);
    T.secs(12, () => R.ops.every((o: any) => orderOf(T, o) === 'fallIn') && R.ops.some((o: any) => INSIDE(o.char.pos, SERVER)));   // (until the pair are on him again: at the team's walk the man who worked the corridor's openings is a few seconds behind)
    const both = R.ops.every((o: any) => orderOf(T, o) === 'fallIn'), inRoom = R.ops.filter((o: any) => INSIDE(o.char.pos, SERVER)).length;
    T.press('KeyF'); const split = R.log.find((l: any) => l.what.startsWith('split:'))?.what ?? 'no split';
    F.verdict(both && inRoom >= 1 && /^split:front=Blue (One|Two),side=Blue (One|Two)$/.test(split) && /both doors/.test(g.messages.map((m: any) => m.text).join('|')), 'F from the server room with both men on Sam: one takes the side door, the other goes round to the corridor door', `${inRoom} of the pair in the server room · ${split} · '${g.messages[g.messages.length - 1]?.text}'`);
    let through = ''; const set = T.secs(25, () => { if (!T.at('door-flung')) for (const o of R.ops) if (INSIDE(o.char.pos, OFFICE)) through = o.callsign; return !!T.at('split:set'); });
    F.verdict(set && !through, 'the man sent round goes by the server room\'s own door to the corridor door — never through the side door and the hostage room — and both are set', `set ${f1(T.since('split:set'))} s after the clock started · ${through ? `${through} was in the office first` : 'nobody in the office before the doors'} · ${R.summary().slice(0, 120)}`);
  }
  { // a man on a cover of Sam's own is left on it: F takes the other alone; both covering: F refused
    const { T, R, g } = await sideRig(9, { clock: false });
    walk(T, [8.2, 0, 11.2]); T.secs(1.5);
    const w = g.orders.give('cover', { kind: 'floor', at: [20, 0, 11.2] }, 0); T.secs(0.3); const p0 = [...R.ops[0].char.pos];
    T.press('KeyF'); const split = R.log.find((l: any) => l.what.startsWith('split:'))?.what ?? 'no split';
    T.secs(30, () => !!T.at('enter1') || !!R.result);
    F.verdict(w === null && split === 'split:front=Blue Two' && orderOf(T, R.ops[0]) === 'cover' && dist(R.ops[0].char.pos, p0) < 0.6 && !!T.at('enter1') && !T.at('enter:side'), 'one man on a cover of Sam\'s: F is a man short — the other boots the corridor door, bangs it and goes in alone; the cover stands', `${split} · Blue One: ${orderOf(T, R.ops[0])}, moved ${dist(R.ops[0].char.pos, p0).toFixed(2)} m · ${['stacked', 'kick', 'door-flung', 'toss', 'bang', 'enter1'].map(b => `${b} ${f1(T.since(b))}`).join(' · ')}`);
  }
  { const { T, R, g } = await sideRig(9, { clock: false });
    walk(T, [8.2, 0, 11.2]); T.secs(1.5);
    const w = g.orders.give('cover', { kind: 'floor', at: [20, 0, 11.2] }, 'all'); T.secs(0.3);
    const did = R.orderDoor();
    F.verdict(w === null && did === null && R.mode === 'free' && g.doorTools.bangs === 3 && /nobody free/.test(g.messages[g.messages.length - 1]?.text ?? ''), 'both men on covers of Sam\'s: F is refused, and says why (no can spent)', `did ${did} · '${g.messages[g.messages.length - 1]?.text}'`);
  }
  { // the menu calls it off — on the walk, and with the boots going in (the door tools' men are theirs only while they stand on the order)
    const { T, R, g } = await sideRig(11, { clock: false }); const DTL = g.doorTools;
    g.orders.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1); T.secs(14, () => dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
    T.press('KeyF'); T.secs(1.0);
    const owned = R.ops.map((o: any) => R.owns(o)).join('/'), spent = DTL.bangs;
    const w = give(T, 'hold'); T.secs(0.3);
    F.verdict(owned === 'true/true' && spent === 1 && w === null && R.mode === 'free' && !!T.at('drill:called-off') && R.ops.every((o: any) => orderOf(T, o) === 'hold') && DTL.bangs === 3, 'a menu order on the walk to the two doors calls it off, they take the order, and both cans come back', `F had them ${owned} · hold: ${w ?? 'given'} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · bangs ${spent} → ${DTL.bangs}`);
    g.orders.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1); T.secs(8, () => dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
    T.press('KeyF'); const kicked = T.secs(30, () => R.log.filter((l: any) => l.what === 'kick').length > 0);
    const w2 = give(T, 'hold'); T.secs(0.5); const offs = R.log.filter((l: any) => l.what === 'drill:called-off').length;
    F.verdict(kicked && w2 === null && R.entry === null && R.mode === 'free' && offs === 2 && R.ops.every((o: any) => orderOf(T, o) === 'hold'), 'F again: with the boot going in a menu order still takes them, at both doors, as off any door order of the menu\'s (no "committed")', `hold: ${w2 ?? 'given'} · called off ×${offs} · orders ${R.ops.map((o: any) => orderOf(T, o)).join(' / ')} · bangs ${DTL.bangs}`);
  }
  { // the same with the flow on (the default configuration): F takes its men off the flow, the door tools run them, and they are handed back to the menu
    const { T, R, g } = await sideRig(40, { clock: false, flow: true });
    g.orders.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1);
    T.secs(14, () => INSIDE(R.ops[1].char.pos, SERVER) && dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
    T.press('KeyF'); let jobs = 0;
    T.secs(40, () => { if (R.entry) jobs = Math.max(jobs, R.flow.jobs.size); return !!T.at('clear') || !!R.result || (!!T.at('enter1') && T.game.time - T.at('enter1')! > 16); });
    const split = R.log.find((l: any) => l.what.startsWith('split:front'))?.what ?? 'no split';
    F.verdict(split === 'split:front=Blue One,side=Blue Two' && T.order(['split:set', 'split:go', 'kick', 'door-flung', 'toss', 'bang', 'enter1']) && !!T.at('enter:side') && jobs === 0 && R.mode === 'free' && !R.entry, 'with the flow on (as shipped): the same split, no flow job on a man F has, and the mode back to free after', `${split} · flow jobs during the entry ${jobs} · mode ${R.mode} · in ${f1(T.since('enter1'))} / ${f1(T.since('enter:side'))} s`);
  }
  { // RESCUE.twoDoor off, the same set-up over the same seeds: both men to the corridor door on one bang and clear — and the man in the server room goes
    // out by its own door, never through the side door and the hostage room (the short way)
    let secured = 0, alive = 0, teamUp = 0, through = '', one = 0; const N = 6;
    for (let s = 0; s < N; s++) {
      const { T, R, g } = await sideRig(40 + s, { clock: false, twoDoor: false });
      g.orders.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1); T.secs(14, () => dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
      T.press('KeyF');
      if (R.entry && R.entry.ops.length === 1 && !R.entry.ops[0].side && R.entry.ops[0].op.men.length === 2 && !R.log.some((l: any) => l.what.startsWith('split:'))) one++;
      const each = () => { if (!T.at('enter1')) for (const o of R.ops) if (o.state !== 'dead' && INSIDE(o.char.pos, OFFICE)) through = `${o.callsign} in the office before the entry (seed ${40 + s})`; return !!T.at('clear') || !!R.result || (!!T.at('enter1') && g.time - T.at('enter1')! > 16); };
      T.secs(45, each);
      T.secs(6, () => R.state === 'secured' || !!R.result);
      if (R.state === 'secured' || R.result?.state === 'rescued') secured++; alive += up(R.hostages); teamUp += up(R.ops);
    }
    F.verdict(one === N && !through, 'RESCUE.twoDoor off: F takes both men to the corridor door on one order; the man in the server room goes round by its own door (the one fix with no switch)', `one order for both ${one}/${N} · ${through || 'nobody through the hostage room on the way'} · the same six seeds through the one door: secured ${secured}/${N} · hostages alive ${alive}/${2 * N} · pair up ${teamUp}/${2 * N}`);
  }
  { // RESCUE.twoDoor off with both men on covers Sam gave: F still takes them both, as it always did (no refusal, no one-man entry)
    const T = await rig(41, { doorMan: 'inside', roamers: 0, clock: false, twoDoor: false }); const R = T.R, g = T.game; T.secs(0.3);
    walk(T, [8.2, 0, 11.2]); const w = g.orders.give('cover', { kind: 'floor', at: [14, 0, 11.2] }, 'all'); T.secs(1.5);
    T.press('KeyF'); T.secs(0.5);
    F.verdict(w === null && R.mode === 'door' && R.ops.every((o: any) => R.owns(o)) && !R.entry?.split && !R.log.some((l: any) => l.what.startsWith('split:')), 'RESCUE.twoDoor off, both men on a cover of Sam\'s: F takes both to the corridor door', `cover: ${w ?? 'given'} · mode ${R.mode} · F has ${R.ops.filter((o: any) => R.owns(o)).map((o: any) => o.callsign).join(', ') || 'nobody'} · split ${!!R.entry?.split}`);
  }
  return F.done();
});
