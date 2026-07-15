# AGENTS.md — Standing instructions for Chalk

## Read first, in every thread
1. Read `SPEC.md` in full — it is the single source of truth for this project (product spec, GPT-5.6 integration, build phases, hackathon compliance).
2. Read `DEVLOG.md` to learn what has already been built and decided.
3. Run `git log --oneline -15` to see the latest state.

Do not begin work until you know which SPEC.md phase we are in.

## Context
Hackathon project for OpenAI Build Week — hard deadline July 21, 2026, 5:00 PM PT. Judged on: skillful use of Codex + GPT-5.6, a complete coherent product experience, credible real-world impact, and novelty. Time is scarce: scope discipline beats features.

## Hard rules — never violate
- Follow SPEC.md phases strictly and in order. Do not start a later phase before the current phase's acceptance criteria pass.
- Never commit secrets. `OPENAI_API_KEY` lives only in `.env.local` (gitignored). `.env.example` documents required variables.
- The OpenAI API is called only from server-side route handlers — never from client code.
- Never leave `main` broken. The app must run at the end of every work session.
- Respect the non-goals in SPEC.md §3 (no auth, nAo database, no multi-user, no Meet/Zoom integration, no mobile, no freehand ink). Do not add them even if convenient.
- The model id comes from env `OPENAI_MODEL` (default `gpt-5.6`). Verify current model identifiers and the structured-output / tool-calling request format against OpenAI's official docs before writing or changing API client code — do not rely on memorized API shapes.

## Logging discipline (judging evidence — required)
Append to `DEVLOG.md`:
- At the end of every phase, using the format in SPEC.md §9.3.
- Whenever a significant technical decision is made, tag it `[CODEX DECISION]` with a one-line why.
- Whenever the human directs or overrides a decision, tag it `[HUMAN DECISION]`.

## Workflow
- Commit at least at every phase boundary, with messages that describe intent.
- After each phase: run the app, verify the phase's acceptance criteria from SPEC.md §8, commit, update `DEVLOG.md`, then report status in at most 5 lines.
- If this thread was opened for a small side task (docs, sample scripts, an isolated bug), keep changes tightly scoped to that task, still log to `DEVLOG.md`, and do not touch core pipeline code (`/api/interpret`, the ops applier, the canvas) unless that is the task.

## Commands
- `npm run dev` — start the app locally
- `npm run typecheck` — must pass before any commit
- `npm run lint` — must pass before any commit

## Quality bar (summary — details in SPEC.md §10)
- TypeScript strict; no `any` on core paths; no dead code or TODO stubs on `main`.
- Every user-visible failure needs a friendly state and a recovery path. The app must never hard-crash: wrap the speech, camera, and OpenAI layers in error boundaries with fallbacks.
