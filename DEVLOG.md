# DEVLOG

## 2026-07-15 Phase 0 — Scaffold & hygiene
Built: Next.js App Router scaffold with strict TypeScript and Tailwind; Zustand dependency; modern chalkboard shell layout; MIT license; environment template; README compliance skeleton; typecheck script.
[HUMAN DECISION] Start the repository history with the specification files before scaffolding, preserving the product brief as the first commit.
[CODEX DECISION] Used the App Router scaffold with a responsive static shell so Phase 1 can add the core pipeline without revisiting app structure.
Codex speedups worth mentioning: Initialized the repository, scaffolded the app, established the project hygiene files, and verified the first runnable shell in one phase pass.
Problems hit and how resolved: The workspace name had uppercase letters, which npm rejects as a package name; scaffolded in a temporary lowercase folder then moved the generated project into the prescribed root.

[HUMAN DECISION] Use the Diagram Director prompt from SPEC.md verbatim; any change requires product-owner sign-off.
[CODEX DECISION] Use the Responses API with `responses.parse` and Zod Structured Outputs because the model is returning application data rather than invoking application tools; the documented `gpt-5.6` alias is retained as the environment default.
[CODEX DECISION] Structured Outputs requires every response-schema property to be required; represented DiagramOp's optional properties as nullable in the model-only Zod schema, then normalized null to undefined at the API route boundary so the public operation contract remains unchanged.

## 2026-07-17 Phase 1 — Core loop via typed input
Built: Server-only Diagram Director route with strict structured-output and reference validation; Zustand diagram and undo state; React Flow canvas; first-class typed input; water-cycle sample path and malformed-operation resilience coverage.
[CODEX DECISION] The API schema fix above keeps OpenAI's required-field constraint isolated at the server boundary while preserving the public DiagramOp contract.
[HUMAN DECISION] Phase 1 acceptance was manually verified with the water cycle, correction, no-op chit-chat, re-explanation highlight, and undo behaviors.
Codex speedups worth mentioning: Built the validated model-to-canvas loop, resilient operation handling, and focused automated schema tests alongside the interactive path.
Problems hit and how resolved: Structured Outputs rejected optional Zod fields; used required nullable model fields and immediate normalization, documented above.
