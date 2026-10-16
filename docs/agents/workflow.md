# Workflow

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 3017–3079 -->
## Workflow the user expects

- **Fast loop:** implement → drive it briefly in the browser (boots, no console/GPU errors, feature visibly works)
  → typecheck → commit immediately with a normal human message. Don't batch features waiting on reviews.
- **Reviews never block:** right after each commit launch a code-review agent **in the background** on that commit;
  apply real findings as a small follow-up commit. Every few commits, a background QA agent in a worktree under
  `.worktrees/` (gitignored) does a broader soak. Nothing minutes-long runs in the foreground while the user is
  around. Up to ~32 parallel agents is fine.
- **Lanes = background agents in `.worktrees/<name>` on their own branch; the lead is the merge + verify gate** (unsigned `git merge --no-ff` in the main checkout, the changed
  families through `gate.sh` + tour (+ soak for gameplay) + `bun run build` on the MERGED tree in the background, a pane boot when shader text changed, commit, retire the worktree).
  Each lane serves ITS checkout on ITS OWN port (`PORT=52xx nohup bun run tools/serve.ts` there; a shot sink beside it,
  `window.__shotPort` pointing the harnesses at it (main's default 5174); `vendor/typescript` symlinked from the main tree) and stops it BY PID / PORT (`lsof -ti :52xx`) — never
  `pkill -f tools/serve.ts`: that killed every lane's server and the maintainer's :5173 at once. **:5173 is the maintainer's own `bun run dev` tab and it bundles at start-up: after
  every merge to main restart it from the main checkout (kill the pid on the port, `PORT=5173 nohup bun run tools/serve.ts`) and say so — their tab keeps running, a
  reload picks the build up; `.claude/launch.json`'s `lead` entry (:5199) is for the lead's own boots.** The Browser pane is SHARED by every lane: pin `tabId` on each call (an
  unpinned `__hotCommon` / `__stage` / `__shot` has landed on another lane's page and spoiled its take), close your tabs when done (the pane's tab cap once left a lane unable to
  boot), or drive a private headless Chrome (`--headless=new`, Metal, over CDP) from the worktree. Commit in small steps and keep the
  notebook's top self-sufficient so a resume costs minutes.
- **A lane's deliverables** (every renderer / perf / prototype lane since v3): notebook `docs/internal/<topic>.md` (10-line summary on top, method, negatives written up), numbers
  `docs/perf/<topic>-*.json`, ×3 crops `docs/shots/<prefix>_*` judged as tiles, an in-page instrument `tools/qa/<topic>-{harness,scenes,lab}.js` (`await import('/qa/<file>.js')` →
  a `__xx` hook: views via `__stage`, serialized interleaved `costAB`, `identityHash`, a `validate` sweep of presets × switches × debug views for GPU errors) and a SELF-CONTAINED
  page `docs/review/<topic>.html` from `tools/qa/<topic>-page.py` (body-only: light / dark tokens, data-URI images, tables in `overflow-x` boxes, inline SVG)
  published as an Artifact with the by-eye calls named and the taste constants as one-liners; every new switch defaults OFF (= main hash for hash) until the maintainer has looked.
- **STATUS.md is the live queue** (it WAS, through 08-16; since 2026-10-09 it is archived at docs/internal/status-archive-2026-08.md, the queue lives outside the repo, and "STATUS" anywhere in this file means that archive — the rest of this bullet is how the queue was kept)**:** strike items with the commit hash as they land, insert new asks at the right
  priority the moment they arrive (notes come as terse playtest lines + screenshots), refresh the state block, and
  when handing back after a long autonomous stretch put a short "morning report" on top (what to try first, what
  was verified and how, caveats, what was deliberately not done) — and, since they read a page rather than STATUS,
  the same report as `docs/internal/morning-YYYY-MM-DD.html` published as its own Artifact (favicon ☀️, a new file
  and URL per day, linked from STATUS, refreshed as late merges land). When the queue drains: refill toward the stated
  goal, then keep raising quality rather than stopping.
- **Build board:** `docs/roadmap.json` → `bun run tools/build-roadmap.ts` → republish the Artifact at the URL in
  STATUS.md (same URL every time; favicon 🔦; the board was last brought up to date 08-16). Keep the log in plain first-person prose.
- **Commits:** unsigned is fine (`git -c commit.gpgsign=false commit …`). Human-style messages only: no attribution lines, no tool trailers. Never `git stash`. Never `cd` into `.worktrees/*` (use `git -C`).
- **Their taste, learned the hard way:** physically-motivated effects that show off the renderer win (light through
  an opening door, blackout beacons, shootable fixtures whose light really goes, lasers in haze); grade your own
  renders harshly (see above) — "looks fine downscaled" has been wrong repeatedly.

## Where the repo lives (since 2026-10-16)

- **Development** = branch `twopointsix` on `github.com/sujayakar/twopointfive` (PUBLIC). The build to play is that branch's
  head; it moves only by the merge of a finished branch, fast-forward only, never forced. Work on your own branch off it. `main`
  there is the older twopointfive project and is not touched.
- **Everything here is public.** Nothing from outside the game goes into a file or a commit message: no private links or ids, no
  machine paths, no names, no model names, no attribution lines.
- **Not in this repo:** `handoff.md`, the story and design notes (`docs/design`), the August work log and its board
  (`docs/internal/status-archive-2026-08.md`, `docs/roadmap.json`, `tools/build-roadmap.ts`), the morning reports and the pending
  inventory of that month (`docs/internal/morning-*.html`, `docs/internal/pending-inventory-2026-08-11.md`) and
  `tools/publish-public.sh`, and the one-file page generators (`tools/artifact-page.py`, `tools/page-artifact.ts`,
  `tools/sounds-artifact.ts`). They stayed in the old private repo with the history up to 2026-10-16; a pointer to one of them in
  a comment or a bullet is a pointer there.
- **Playable build** = a one-file page made from `dist/` and published by the lead. Its generators are not in this repo.
