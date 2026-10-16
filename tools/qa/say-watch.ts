// WHAT THE DEFENDERS SAY, AND WHAT OF IT REACHES THE PLAYER — a bystander for tools/qa/playthrough.ts (PT_SAY=1), like its Tally and DefWatch: it reads, and
// writes nothing the game reads. Three records of a run:
//   lines      every Game.say() call: who, what, radio or not, the call site (file:line off the stack), and what became of it on the player's side —
//              the bubble (ui/bubbles.ts: drawn only over a man the fog of war has not hidden, while he is in the view), the radio strip (ui/overlay.ts: only
//              game.messages rows that start 'radio: ', the newest three, eight seconds), or neither (a row in game.messages nothing draws). Beside it how far
//              off the speaker stood, the sound model's path and carry from his head to Sam's, and what the mixer was asked to play at him that frame.
//   decisions  every note the room fight, the squads, the dig-in and the press file about a defender, and every change of a defender's state (patrol /
//              suspicious / search / alert / dead) or of his room-fight mode (hold / move / free) — the things he DECIDES — with the second it happened.
//   after      once the run has ended (PT_AFTER=secs: the game stepped on with nobody at the keys), a row a second per living defender: state, mode, how
//              far he has walked, the marker the HUD would put over him, whether the fog hides him.
// The harness has no GPU and no DOM: 'drawn' is the two HUD files' own conditions asked of the same game state (the camera's projection, FogOfWar.hidden,
// the 'radio: ' prefix), not a picture. Only lines that go through Game.say are seen (every guard's and unit's do): the civilians' own writer, the Director's
// radio and rows a module pushes straight into Game.msg appear in `msgs` alone.

export interface SaidLine {
  t: number; who: string; team: string; text: string; radio: boolean; site: string; state: string; mode: string;
  /** at the moment he spoke: hidden by the fog of war · in the camera's view · any teammate's eyes on him (the room fight's own answer) · Sam down */
  hidden: boolean; inView: boolean; teamSees: boolean; samDown: boolean;
  /** the row say() pushed into game.messages (null: none — an unhidden man in view speaking off the radio) and whether the HUD's strip draws it */
  log: string | null; strip: boolean;
  /** seconds the bubble was drawable (not hidden, in view, alive, not yet replaced or expired) */
  bubble: number;
  /** metres from his head to Sam's: straight · along the sound model's path · its carry (1 = open air) */
  dist: number; path: number; carry: number;
  /** what the mixer was asked to play within 2 m of him on that frame */
  audio: string[];
  /** held in Sam's arm: say() dropped it */
  dropped: boolean;
}
export interface Decision { t: number; who: string; kind: 'note' | 'state' | 'mode'; what: string }
export interface AfterRow { t: number; who: string; state: string; mode: string; marker: string; hidden: boolean; fromMark: number; toSam: number; speed: number }
/** a 'radio' squelch or the alert sting the mixer was asked for: level = the mixer's own estimate (audio.ts play: gain × occlusion cut × inverse distance at the
 *  apparent position) with Sam's head as the ear, the gain itself for one that is not placed; under 0.0056 the mixer plays no voice */
export interface Blip { t: number; name: string; gain: number; level: number; samDown: boolean }
/** a line of game/cues.ts's own (it does not go through Game.say): seconds its bubble was drawable */
export interface CueSaid { t: number; who: string; text: string; radio: boolean; hidden: boolean; bubble: number }
export interface SaidOut { cues: CueSaid[]; lines: SaidLine[]; decisions: Decision[]; after: AfterRow[]; marks: [number, string][]; msgs: { t: number; text: string; strip: boolean }[]; blips: Blip[] }

const r1 = (x: number) => +x.toFixed(1), r2 = (x: number) => +x.toFixed(2);
let cuesTable: { on: boolean } | null = null;
/** game/cues.ts's switch (handed over by the play-through; absent on a build without it) */
export function watchCues(T: { on: boolean }) { cuesTable = T; }
const CUES_ON = () => !!cuesTable?.on;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class SayWatch {
  out: SaidOut = { cues: [], lines: [], decisions: [], after: [], marks: [], msgs: [], blips: [] };
  private g: any; private live = new Map<any, { L: SaidLine; b: any }>(); private was = new Map<any, { state: string; mode: string; mark: number[] }>();
  private cueLive = new Map<any, CueSaid>();
  private fresh: SaidLine[] = []; private freshAt = new Map<SaidLine, any>(); private noteSeen = 0; private lastNote: unknown = null; private t = 0; private frameAudio: { name: string; pos: number[] | null }[] = []; private afterOn = false; private lastAfter = -1;
  constructor(private W: any) {
    const g = this.g = W.game, me = this;
    W.audioLog = [];
    const say0 = g.say.bind(g), msg0 = g.msg.bind(g);
    g.msg = (text: string) => { me.out.msgs.push({ t: r1(me.t), text, strip: text.startsWith('radio: ') }); return msg0(text); };
    g.say = (gd: any, text: string, radio = false) => {
      const n0 = g.messages.length, last0 = g.messages[n0 - 1], m0 = me.out.msgs.length;
      const site = ((new Error().stack ?? '').split('\n').map(s => /src\/game\/([\w-]+\.ts):(\d+)/.exec(s)).filter(Boolean) as RegExpExecArray[]).map(m => `${m[1]}:${m[2]}`).find(s => !/^game\.ts:/.test(s)) ?? '?';
      const head = gd.char.bones.head ?? [gd.char.pos[0], gd.char.pos[1] + 1.7, gd.char.pos[2]], sam = g.player.char.bones.head ?? [g.player.char.pos[0], 1.65, g.player.char.pos[2]];
      let path = NaN, carry = NaN; try { const pr = g.col.sound.propagate(head, sam); path = pr.pathLen; carry = pr.carry; } catch { /* (a point the grid has no cell for) */ }
      const b0 = gd.bubble, c0 = g.cues?.stats.heardDrawn ?? 0, raw0 = g.cues?.stats.drawn[0] ?? 0; const ret = say0(gd, text, radio);
      const cued = !!g.cues && (g.cues.stats.heardDrawn > c0 || g.cues.stats.drawn[0] > raw0);   // (game/cues.ts on: the strip is its rows — this line got one)
      const pushed = me.out.msgs.length > m0 ? me.out.msgs[me.out.msgs.length - 1].text : (g.messages[g.messages.length - 1] !== last0 ? g.messages[g.messages.length - 1].text : null);
      const D = g.fight?.defs?.find((d: any) => d.gd === gd);
      const L: SaidLine = { t: r1(me.t), who: gd.callsign ?? '?', team: gd.team ?? '?', text, radio: !!radio, site, state: gd.state, mode: D?.mode ?? '-',
        hidden: !!g.fogOfWar.hidden(gd), inView: me.inView(head), teamSees: !!g.fight?.teamSees?.(gd), samDown: !!g.player.down,
        log: pushed, strip: g.cues?.stats.heard !== undefined && CUES_ON() ? cued : !!pushed && pushed.startsWith('radio: '), bubble: 0, dist: r1(Math.hypot(head[0] - sam[0], head[2] - sam[2])), path: r1(path), carry: r2(carry), audio: [], dropped: gd.bubble === b0 };
      me.out.lines.push(L); me.fresh.push(L); me.freshAt.set(L, gd); if (!L.dropped) me.live.set(gd, { L, b: gd.bubble });
      return ret;
    };
  }
  /** ui/bubbles.ts place(): a hand above the head, gone once 5 % of the view past its edge */
  private inView(head: number[]): boolean { const c = this.W.canvas; const [, , vis] = this.W.cam.project([head[0], head[1] + 0.62, head[2]], c.clientWidth, c.clientHeight, 1.05); return !!vis; }
  mark(what: string) { this.out.marks.push([r1(this.t), what]); if (/^end:/.test(what)) this.afterOn = true; }
  tick(t: number, dt = 1 / 60) {
    const g = this.g; this.t = t;
    // the mixer's calls of the step just made, pinned on the lines said in that same step by a man within 2 m of the call
    const A = this.W.audioLog as { name: string; pos: number[] | null; gain: number }[];
    for (const a of A) {
      if (a.name === 'radio' || a.name === 'alertSting') { let level = a.gain;
        if (a.pos) { const sam = g.player.char.bones.head ?? [g.player.char.pos[0], 1.65, g.player.char.pos[2]]; try { const pr = g.col.sound.propagate(a.pos, sam); const d = Math.max(1.6, Math.hypot(pr.apparent[0] - sam[0], pr.apparent[1] - sam[1], pr.apparent[2] - sam[2])); level = a.gain * (1 - 0.55 * pr.muffle) * (1.6 / (1.6 + 1.1 * (d - 1.6))); } catch { level = NaN; } }
        this.out.blips.push({ t: r1(t), name: a.name, gain: a.gain, level: +level.toFixed(4), samDown: !!g.player.down }); }
      if (a.name !== 'footstep' && a.pos) for (const L of this.fresh) if (flat(a.pos, this.freshAt.get(L).char.pos) < 2 && !L.audio.includes(a.name)) L.audio.push(a.name);
    }
    A.length = 0; this.fresh.length = 0; this.freshAt.clear();
    // the bubbles: drawable this frame? (ui/bubbles.ts update: the speaker's bubble still this one, not dead, not hidden, not expired, in view)
    for (const [gd, R] of this.live) {
      if (gd.bubble !== R.b || g.time - R.b.t > R.b.dur) { this.live.delete(gd); continue; }
      if (gd.state === 'dead' || g.fogOfWar.hidden(gd)) continue;
      if (g.cues && g.cues.bubbleOf(gd) !== R.b) continue;   // (a cue of cues.ts's is drawn over it)
      const head = gd.char.bones.head ?? gd.char.pos; if (this.inView(head)) R.L.bubble = r2(R.L.bubble + dt);
    }
    // the cues' own bubbles (game/cues.ts: kept on its side, never on the man): each as it first shows, then the seconds it is drawable
    if (g.cues) for (const gd of g.guards) { const c = g.cues.bubbleOf(gd); if (!c || c === gd.bubble) continue;
      let R = this.cueLive.get(c); if (!R) { R = { t: r1(t), who: gd.callsign ?? '?', text: c.text, radio: !!c.radio, hidden: !!g.fogOfWar.hidden(gd), bubble: 0 }; this.cueLive.set(c, R); this.out.cues.push(R); }
      if (gd.state !== 'dead' && !g.fogOfWar.hidden(gd) && this.inView(gd.char.bones.head ?? gd.char.pos)) R.bubble = r2(R.bubble + dt); }
    // the notes the fight's modules file (roomfight.ts note — the squads', the dig-in's and the press's come through it)
    const L = (g.fight?.log ?? []) as { t: number; who: string; what: string }[]; if (L.length < this.noteSeen) this.noteSeen = L.indexOf(this.lastNote as any) + 1;
    const hostile = new Set<string>(); for (const x of g.guards) if (x.team === 'hostile') hostile.add(x.callsign);
    for (; this.noteSeen < L.length; this.noteSeen++) { const n = L[this.noteSeen]; this.lastNote = n; if (n.who !== '-' && !hostile.has(n.who)) continue; if (/^(heard (loud|small)|watch →|adopt )/.test(n.what)) continue; this.out.decisions.push({ t: r1(t), who: n.who, kind: 'note', what: n.what }); }
    // every defender's state and room-fight mode, as they change
    for (const h of g.guards) { if (h.team !== 'hostile') continue;
      const mode = g.fight?.defs?.find((d: any) => d.gd === h)?.mode ?? '-'; const w = this.was.get(h);
      if (!w) { this.was.set(h, { state: h.state, mode, mark: [...h.char.pos] }); continue; }
      if (w.state !== h.state) { this.out.decisions.push({ t: r1(t), who: h.callsign, kind: 'state', what: `${w.state} → ${h.state}` }); w.state = h.state; }
      if (w.mode !== mode) { this.out.decisions.push({ t: r1(t), who: h.callsign, kind: 'mode', what: `${w.mode} → ${mode}` }); w.mode = mode; }
    }
    if (this.afterOn && Math.floor(t) !== this.lastAfter) { this.lastAfter = Math.floor(t);
      for (const h of g.guards) { if (h.team !== 'hostile' || h.state === 'dead') continue; const w = this.was.get(h); if (!w) continue;
        const marker = h.state === 'alert' ? '!' : h.state === 'suspicious' || h.state === 'search' ? '?' : h.awareness > 0.05 ? '·'.repeat(1 + Math.floor(h.awareness * 6)) : '';   // (ui/overlay.ts: the glyph over a man's head)
        this.out.after.push({ t: r1(t), who: h.callsign, state: h.state, mode: w.mode, marker, hidden: !!g.fogOfWar.hidden(h), fromMark: r1(flat(h.char.pos, w.mark)), toSam: r1(flat(h.char.pos, g.player.char.pos)), speed: r1(Math.hypot(h.char.vel[0], h.char.vel[2])) }); }
    }
  }
  close(): SaidOut { return this.out; }
}
