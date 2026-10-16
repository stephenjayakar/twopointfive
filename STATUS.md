# STATUS

This file used to be the live work queue. It is archived, word for word, in the old private repo
(`docs/internal/status-archive-2026-08.md` there; not in this repo). Its last entry is from 2026-08-16.

## Where the live state is now

- The work queue lives outside the repo now. The newest in-repo record is `git log`.
- `CLAUDE.md` is the short index, `docs/agents/` documents the systems; `docs/internal/` holds the notebooks.

## What the build is

- The game is a page in the browser: `bun run dev`, then http://localhost:5173.
- Since the archive was written the game was rebuilt into a squad game (missions list and
  loadout on the start page, an orders menu in play). The archive describes the August
  solo game and its queue; read it as history, not as a to-do list.
- The Mac app (the native engine under `tools/native`, `bun run native`) was removed on
  2026-10-11; it is in git history. The archive opens with it because it was the newest
  work on 08-16.

## Reading older references

Notes, code comments and docs that say "STATUS", "STATUS.md" or name a STATUS item
(for example "STATUS E12", "STATUS G5") mean the archived file.
