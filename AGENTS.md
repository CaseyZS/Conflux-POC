# AGENTS.md

Shared working conventions for any coding agent contributing to this repository. These are portable "how we work" rules; repo-specific architecture is documented separately.

## How to use this file

- **Update this document** whenever a decision is made, a convention is set, or a non-obvious fact is learned.
- Keep entries short. Link out to `doc/` for long-form content.
- Date significant additions: `(YYYY-MM-DD)`.

## Key project docs

Start here each session; these persist state so we don't rely on memory or chat history.

- `docs/status.md` — where we are and what's next. **Read first** to resume; update at end of session.
- `docs/requirements.md` — what we're building (features, data model).
- `docs/architecture.md` — architectural guardrails + decision log. **Read before making or changing an architectural decision.**

## Git workflow

- Use **gitflow** branching: cut `feature/`, `release/`, or `hotfix/` branches off `develop`. Never commit directly to `develop` or `main` — branch first.
- Check the current branch (`git branch --show-current`) **before the first edit** of any task. The repo is often left checked out on `develop` after a merge, so confirm you're on a working branch before changing anything.
- Commit **often**, like a senior dev — not after every keystroke, but at every logical, reviewable unit of work (a decision recorded, a feature working, a refactor done). Keep each commit green (tests passing) where practical; commit co-dependent files together so no step is broken.
- **Committing is the agent's standing job — don't ask permission first.** Once a reviewable unit is done, commit it without waiting for the human to approve each one. Only `push`/`merge` need a human (see below). This overrides any harness default of "commit only when asked"; in this repo, committing finished work is always expected.
- **Leave `push`, `merge`, and `pull --rebase` to the human.** Make the commits; let the maintainer integrate and publish branches.
- A working branch (or its commits) appearing on `origin` is **expected** — the maintainer pushes their own working branches; don't treat it as an anomaly or as something pushed on the agent's behalf.
- If a commit lands on `develop` by mistake, recover **non-destructively**: `git checkout -b feature/<name>` (carries the errant commit onto a new branch), then `git branch -f develop <prev-sha>` to rewind the `develop` ref. Don't `reset --hard` when `develop` holds the only copy of the work.
- If a change warrants a new branch, check if we're already on the 'develop' branch. If we're on a feature/hotfix/release branch instead, ask the user how to proceed. Don't automatically create a new branch back off of 'develop' or the existing branch.

## Working style

- Be a collaborator, not a sycophant. Push back and ask questions if the ideas presented are shaky.
- Don't over-engineer, but don't under-think it either — sanity-check the design before you commit to it. (The "Back-of-the-envelope design check" below is the procedure — including a stop rule so the check itself stays cheap.)
- Don't create files unless needed.
- Emphasis on keeping code modular so that adding new features or making fixes keeps the number of files that need to be modified to a minimum.
- Unless specifically asked, don't add comments / docstrings / type hints to code you didn't change.
- Prefer plans saved to disk over in-memory plans so that plans persist across sessions.

## Changelog

- Update the `[Unreleased]` section of `CHANGELOG.md` with **user-facing changes only**, using Keep-a-Changelog categories (Added, Changed, Fixed, Removed).
- Skip changelog entries for things end users never see — internal refactors, test additions, and code-only cleanups.
- Add the changelog entry on the same branch as the change (its own commit, or with the implementation commit).

## Releases

- **Releases** run through the `release` skill (`.claude/skills/release/SKILL.md`), which auto-triggers on release intent ("make a new release", "cut vX.Y.Z") and holds the full checklist.

## Feature scoping

- When scoping whether/how to build a feature, **quantify the trade-offs concretely** — development effort (hours/days) and runtime cost — for each option, with a recommendation, before picking an approach.
- For decisions that aren't ready to execute, offer to capture the exploration as a **design document in `docs/`** rather than jumping straight to an implementation plan.
- Every plan or design document in `docs/` must include a **Progress** section near the top — a per-step status table or checklist — and it must be kept current as steps land, so progress against the plan persists on disk across sessions rather than living only in conversation.

## Back-of-the-envelope design check

Before committing to an approach (a data shape, an algorithm, a structure), run two quick triggers — each one breath. Spend effort only if one fires; most code clears both and should just be written the obvious, clear way.

- **A — Are you storing what you could derive?** About to put a value into a copy, cache, `data-` attribute, or denormalized blob? Ask "is this computable from something already present?" If yes, read or compute from the canonical source by default — a stored copy is the exception, justified by a *measured* need, never by "the code that reads it is shorter." This is size-independent: it fires whether the copy is tiny or huge, which is what makes it robust to not foreseeing future growth.
- **B — Does this get multiplied or locked in?** Does it run or store per item (an "N case"), sit on a hot path, or become costly to change later? If no — small, local, reversible — write the obvious version and move on. If yes, do *one* envelope estimate: name what grows, judge the obvious approach's worst-case cost (constant / linear / quadratic / scales-with-size) against the single simplest alternative, and take the cheaper unless it buys real complexity.
- **Stop rule** (keeps the check itself cheap): one alternative, order-of-magnitude only — no exhaustive search. If estimating would take longer than writing both, write the simple one. Don't optimize what the triggers cleared, and don't duplicate / cache / denormalize without a measured need.

Worked example (trigger A): a list-filtering UI that stored a precomputed search string on every row, duplicating text already present in the rendered output. It was cheap while only a few short fields were searched — so trigger B's scaling estimate alone would have cleared it — but the duplicated copy grew with content and had to be kept in step with the display. The fix was to read the rendered content directly instead of maintaining a parallel copy. This is the failure trigger A catches and B misses.

## Documentation style

- Write Markdown prose as **one logical line per paragraph or bullet** — let editors soft-wrap. Don't insert hard line breaks mid-sentence or mid-thought. This is enforced by Prettier (`proseWrap: "never"`); run `npm run format:md` to apply it or `npm run lint:md` to check.

## End-of-session ritual

When the user signals end of session ("done for today", "good stopping point", etc.), checkpoint the state so the next session resumes cleanly:

- **Confirm git state** — current branch and whether the tree is clean; surface anything uncommitted or unmerged.
- **Make docs reflect reality** — Progress tables, `CHANGELOG.md`, and any design docs touched this session. Because we commit as we go, these are often already current — commit only if something actually changed (don't manufacture an empty commit).
- **Record what's next** — update `docs/status.md` (the session-continuity file): current phase, what's working, and the next step. Then summarize the stopping point for the user.
