// MOTHS round the LIT sodium lamps at NIGHT (approved with the wind lane as "dust motes, sodium light moths"; the MOTES half — a particle kind topped up inside the
// torch cones — was cut 08-11, the maintainer: 'they look weird … it's obvious that they spawn when your flashlight shows up somewhere, not ambiently always present').
// A dozen at most, CPU boxes (a moth must orbit a point, which a particle cannot) — one small NoShadow box each, drawn through the g-buffer like anything (so the lamp
// lights it, the wet lot mirrors it, its motion vector rides its key), on a noisy analytic orbit under the cobra head with a bob, a wobble, a dart at the lens now and
// then, wings a-flutter as a fast roll of the box; they gather over a couple of seconds when a lamp comes on and scatter when it goes out (shot, the daylight), in a
// gale (the wind field at the head) or a downpour. Twelve boxes, a few dozen trig calls: nothing. Nobody's AI reads them. Behind tune.moths (kept with the wind's rows).
import { Vec3, v3, quat } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import type { Game, LightTarget } from './game';
import type { RtLight } from '../render/lights';
import { isDaylight } from './lighting';

/** the moths' numbers */
export const MOTHS = {
  max: 12, perLamp: 7,
  rMin: 0.14, rMax: 0.5,      // orbit radius about the lamp's axis (m)
  below: 0.25, bob: 0.16,     // mean depth under the lens, ± bob
  omegaMin: 2.2, omegaMax: 4.6,   // rad/s round the head
  flapHz: 9, wing: 0.016,     // the roll flutter and the wing half-span (m): a big moth — under two pixels from the play camera even so, it is the flicker across the lens that reads
  gatherSecs: 2.5, scatterSecs: 1.2,
  galeMs: [3, 6] as [number, number],   // wind speed at the head (m/s) over which they thin to none
  rainMax: 0.92,              // rain rate past which even the lamp's lee is too wet
  albedo: [0.62, 0.56, 0.42] as Vec3,
};
export const MOTH_STATS = { shown: 0 };

/** integer hash → [0, 1) (the module's dice: every choice counts off its own serial — never Math.random) */
function h01(x: number): number { x = Math.imul((x ^ 0x2545F491) >>> 0, 0x9E3779B1) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA77) >>> 0; x ^= x >>> 13; return (x >>> 8) / 16777216; }
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

interface Moth { lamp: number; r: number; omega: number; ph: number; bobF: number; bobPh: number; wob: number; dartT: number; dartPh: number; flapPh: number; away: Vec3; shown: number; box: Box; }

export class Moths {
  /** the sodium lamps (exterior spot lights hung high, found once off the light targets) and the moth pool dealt round them */
  private lamps: { target: LightTarget; light: RtLight; head: Vec3; act: number }[] = [];
  private moths: Moth[] = [];
  constructor(private g: Game) {
    for (const t of g.targets) { const l = t.light; if (t.kind === 'analytic' && l && l.kind === 1 && t.group === 'exterior' && l.pos[1] > 3.5) this.lamps.push({ target: t, light: l, head: [l.pos[0], l.pos[1] + 0.08, l.pos[2]], act: 0 }); }   // TODO(LevelData): a lamp record; today: any exterior spot over 3.5 m is a street lamp (the office's three)
    for (let i = 0; i < MOTHS.max && this.lamps.length; i++) {
      const hs = (k: number) => h01(i * 7919 + k * 131);
      const box = makeBox({ c: [0, -50, 0], h: [0.006, 0.0025, MOTHS.wing], albedo: v3.copy(MOTHS.albedo), flags: BoxFlag.Dynamic | BoxFlag.NoShadow, rough: 0.8 });   // body along local +X (the heading), the span across local Z: rolling about the body flickers the span seen from above
      box.mkey = MKEY.test + 0x4000 + i;   // motion identity (scene/boxes.ts MKEY: the test range's upper numbers — nothing else keys there)
      const az = hs(9) * Math.PI * 2;
      this.moths.push({ lamp: i % this.lamps.length, r: MOTHS.rMin + (MOTHS.rMax - MOTHS.rMin) * hs(1), omega: (MOTHS.omegaMin + (MOTHS.omegaMax - MOTHS.omegaMin) * hs(2)) * (hs(3) < 0.5 ? -1 : 1), ph: hs(4) * 6.283, bobF: 0.7 + 1.6 * hs(5), bobPh: hs(6) * 6.283, wob: 0.3 + 0.7 * hs(7), dartT: 4 + 6 * hs(8), dartPh: hs(10) * 10, flapPh: hs(11) * 6.283, away: [Math.cos(az), -0.25 - 0.5 * hs(12), Math.sin(az)], shown: 0, box });
    }
  }
  /** the deal back as constructed (encounter restart: a restarted encounter repeats) */
  clear() { this.moths.forEach((m, i) => { m.shown = 0; m.lamp = this.lamps.length ? i % this.lamps.length : 0; }); for (const L of this.lamps) L.act = 0; }

  /** Once a frame (game.ts, after the wind): move the moths. */
  update(dt: number) {
    const g = this.g; if (!this.lamps.length) return;
    const on = (g.tune as { moths?: boolean }).moths !== false && !isDaylight(g);
    const rain = g.weather?.enabled ? (g.weather.snowRate > 0 ? 1 : g.weather.rainRate) : 0;   // (no moths at a lamp in falling snow)
    const wv: Vec3 = [0, 0, 0];
    for (const L of this.lamps) {   // each lamp's pull on its moths: lit × night × calm enough × not a downpour, eased so they gather and scatter over seconds
      let a = on && L.target.factor > 0.05 && !L.target.broken && L.light.enabled ? 1 : 0;
      if (a > 0) { g.wind.at(L.head, wv); a *= 1 - smooth(MOTHS.galeMs[0], MOTHS.galeMs[1], Math.hypot(wv[0], wv[2])); a *= 1 - smooth(0.75, MOTHS.rainMax, rain); }
      const rate = a > L.act ? 1 / MOTHS.gatherSecs : 1 / MOTHS.scatterSecs;
      L.act += Math.max(-rate * dt, Math.min(rate * dt, a - L.act));
    }
    const t = g.time; let shown = 0;
    // who flies where: each lamp's QUOTA is its share of the dozen by pull (≤ perLamp) — two lit lamps hold six each, a third lit later takes four off them — a moth over
    // its lamp's quota scatters, and one away out of sight (shown ≈ 0) whose lamp has no place for it goes over to the lamp with the most places unfilled: a dark
    // lamp hoards nobody, a lamp lit later gathers its own, and every move happens while the moth is invisible, so nothing is seen to jump
    const sumAct = this.lamps.reduce((a, L) => a + L.act, 0);
    const quota = this.lamps.map(L => sumAct > 1e-6 ? Math.min(MOTHS.perLamp, L.act * MOTHS.max / Math.max(1, sumAct)) : 0);
    const held = this.lamps.map(() => 0); for (const m of this.moths) held[m.lamp]++;
    const rankOf = new Map<Moth, number>(); { const seen = this.lamps.map(() => 0); for (const m of this.moths) rankOf.set(m, seen[m.lamp]++); }
    for (const m of this.moths) {
      if (m.shown > 0.01) continue;
      if (quota[m.lamp] - (rankOf.get(m) ?? 0) > 0) continue;   // his own lamp still wants him
      let best = -1, room = 0.5;
      this.lamps.forEach((_K, k) => { const r = quota[k] - held[k]; if (r > room) { room = r; best = k; } });
      if (best >= 0 && best !== m.lamp) { held[m.lamp]--; rankOf.set(m, held[best]); held[best]++; m.lamp = best; }
    }
    this.moths.forEach((m) => {
      const L = this.lamps[m.lamp];
      const rank = rankOf.get(m) ?? 0;   // this moth's place in its lamp's queue: the lamp holds its quota of them
      const want = quota[m.lamp] - rank; const target = Math.max(0, Math.min(1, want));
      const rate = target > m.shown ? 1 / MOTHS.gatherSecs : 1 / MOTHS.scatterSecs;
      m.shown += Math.max(-rate * dt, Math.min(rate * dt, target - m.shown));
      if (m.shown <= 0.01) { m.box.c = [0, -50, 0]; return; }
      // the orbit: round the head at its own rate, radius breathing, bobbing under the lens, and every dartT a half-second dart in at the lens and out again
      const th = m.ph + m.omega * t + 0.6 * Math.sin(t * 0.7 * m.wob + m.bobPh);
      const dartX = ((t + m.dartPh) % m.dartT) / 0.55; const dart = dartX < 1 ? Math.sin(dartX * Math.PI) : 0;
      const r = m.r * (0.75 + 0.35 * Math.sin(t * 1.3 * m.wob + m.ph)) * (1 - 0.8 * dart);
      const y = L.head[1] - MOTHS.below - MOTHS.bob * (0.5 + 0.5 * Math.sin(t * m.bobF + m.bobPh)) + 0.18 * dart;
      const orbit: Vec3 = [L.head[0] + Math.cos(th) * r, y, L.head[2] + Math.sin(th) * r];
      const k = 1 - m.shown; const off = k * k * 3.5;   // scattering: out along its own bearing and down, three metres and more; gathering: back in along it
      const c: Vec3 = [orbit[0] + m.away[0] * off, orbit[1] + m.away[1] * off, orbit[2] + m.away[2] * off];
      const heading = -(th + Math.sign(m.omega) * Math.PI / 2);   // tangent to the orbit (Box yaw convention: local +X → (cos yaw, −sin yaw))
      const roll = 0.9 * Math.sin((t * MOTHS.flapHz + m.flapPh) * 6.283);   // the flutter: the wings' plane rocking fast — the projected span flickers
      m.box.c = c; m.box.yaw = 0; m.box.rot = quat.mul(quat.yaw(heading), quat.axisAngle([1, 0, 0], roll));
      shown++;
    });
    MOTH_STATS.shown = shown;
  }
  /** the moths' boxes into the frame's dynamic list (only the ones about) */
  boxes(out: Box[]) { for (const m of this.moths) if (m.shown > 0.01) out.push(m.box); }
  mothsShown(): number { let n = 0; for (const m of this.moths) if (m.shown > 0.01) n++; return n; }
  summary(): string {
    return (this.g.tune as { moths?: boolean }).moths === false ? 'moths off' : `moths ${this.mothsShown()}/${this.moths.length} about ${this.lamps.length} lamp(s) [${this.lamps.map(L => `${L.target.name} ${L.act.toFixed(2)}`).join(', ')}]`;
  }
}
