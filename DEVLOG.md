# DEVLOG

## 2026-07-15 Phase 0 — Scaffold & hygiene
Built: Next.js App Router scaffold with strict TypeScript and Tailwind; Zustand dependency; modern chalkboard shell layout; MIT license; environment template; README compliance skeleton; typecheck script.
[HUMAN DECISION] Start the repository history with the specification files before scaffolding, preserving the product brief as the first commit.
[CODEX DECISION] Used the App Router scaffold with a responsive static shell so Phase 1 can add the core pipeline without revisiting app structure.
Codex speedups worth mentioning: Initialized the repository, scaffolded the app, established the project hygiene files, and verified the first runnable shell in one phase pass.
Problems hit and how resolved: The workspace name had uppercase letters, which npm rejects as a package name; scaffolded in a temporary lowercase folder then moved the generated project into the prescribed root.
