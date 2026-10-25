// THE LOOK PAGE's small mends to a level as it loads (main.ts, on that page only; levels/*.json are not touched).
// SEATED POSTS. The kits stand a gate post in the end of the wall it closes, its face on the gateway exactly on the wall's end face (scene/gwotKit.ts gate: the
// post's inner face is the opening's edge, and so is the wall's). Two faces in one plane: which one a pixel shows is the depth test's coin, a frame at a time.
// In the game's flat paints the two are near enough one colour that nobody saw it; under the look one is render and the other a mud wall on a stone plinth, and
// the reveal flickers between them (the maintainer, 10-25, on a GPU: "seems like a sorting issue that's flickering to right of the red door"). Here a post that
// shares a face with the end of a wall it stands in is made a few millimetres fatter, so its own faces are the ones in front.
// Only that case: the post and the wall both stand square (no yaw, no rotation, no cut), both are drawn and neither is glass, the wall's END face and the
// post's face on that side lie in one plane FACING THE SAME WAY, and the wall's section is inside the post's. A leaf or a pane that merely butts against a post
// from outside faces the other way and is left alone. A post exactly as tall as its wall also rises by the same hair, so its top is the one on top.
// `?seat=0` leaves the level as its file has it. tools/qa/zfight-check.ts finds every such pair in a level file, these among them.
import { BoxFlag, type Box } from './boxes';

const PROUD = 0.004, EPS = 5e-4;   // m a seated post grows a side · two planes nearer than this are one
/** grow each post seated in a wall's end; returns how many */
export function seatPosts(level: { boxes: Box[] }): number {
  const B = level.boxes, plain = (b: Box) => !b.yaw && !b.rot && !b.cut && (b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass)) === 0 && b.h[1] > 0.6; let n = 0;
  for (const p of B) {
    if (!plain(p) || p.h[0] > 0.3 || p.h[2] > 0.3 || p.h[0] < 0.08 || p.h[2] < 0.08) continue;   // a post: tall, a hand to a foot thick both ways
    let hit = false, top = false;
    for (const w of B) {
      if (w === p || !plain(w)) continue;
      if (w.c[1] - w.h[1] >= p.c[1] + p.h[1] || w.c[1] + w.h[1] <= p.c[1] - p.h[1]) continue;
      for (const a of [0, 2] as const) {   // the wall runs along a: its END face on side s lies in the post's face on side s, and its section there is inside the post's
        const o = a === 0 ? 2 : 0;
        if (w.h[a] < 0.5 || w.h[o] > p.h[o] + EPS || Math.abs(w.c[o] - p.c[o]) > p.h[o] - w.h[o] + EPS) continue;
        for (const s of [-1, 1]) if (Math.abs((w.c[a] + s * w.h[a]) - (p.c[a] + s * p.h[a])) < EPS) { hit = true; if (Math.abs((w.c[1] + w.h[1]) - (p.c[1] + p.h[1])) < EPS) top = true; }
      }
    }
    if (hit) { p.h = [p.h[0] + PROUD, p.h[1] + (top ? PROUD / 2 : 0), p.h[2] + PROUD]; if (top) p.c = [p.c[0], p.c[1] + PROUD / 2, p.c[2]]; n++; }
  }
  return n;
}
