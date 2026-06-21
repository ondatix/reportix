---
name: public-reportix-remote
description: The `reportix` git remote is a public, universal-use mirror that excludes proprietary files and the Gleichstellung context
metadata:
  type: project
---

This monorepo (origin = `ondatix/stmas-reportix`) has a second git remote, `reportix` → `https://github.com/ondatix/reportix.git`, which is a **public, universal-use mirror** of the app. It must NOT contain the StMAS "Gleichstellung" context or internal/deploy files.

**When syncing the app to the public remote:**
- Replace the Gleichstellung config/template with a **German public-school showcase** (Schuljahresbericht: `Schueler` snapshot + `Zeitraum_*` event sheets, `Oberstufe` mutation, `Schueler` joins by `SchuelerID`). The 2026-06 sync was pushed as branch `reportix/publish-school` (off `reportix/main`), opened for review (not merged by me).
- **Exclude from the public repo:** `handbuch/`, `stmas/`, `example/`, `.github/`, `Dockerfile`, `nginx.conf`, `.dockerignore`, `CLAUDE.md`, `TODO.md`. **Leave `LICENSE` unchanged** (it already exists on `reportix/main` — preserve that version, don't overwrite).
- The `test/alt-text/stmas_template.*` fixtures are self-contained and already public on `reportix/main`; left as-is (out of scope to scrub).
- Build/publish technique: branch off `reportix/main` in a worktree, replace tree with the school-content commit (`git rm --cached . ; git checkout <src> -- .`), restore `LICENSE` from `reportix/main`, `git rm` the excluded paths. Avoid `grep -z` for filtering `git ls-files` on macOS (BSD grep mishandles it).

The public app build also disables the Handbuch header button in [src/app.ts](../src/app.ts) (commented out — no `/handbuch/` is deployed publicly).
