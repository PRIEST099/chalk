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

## 2026-07-17 Phase 2 — Live speech
Built: Web Speech API implementation behind TranscriptSource; final/interim transcript display; request coalescing and cancellation; automatic recognition restart; typed-input fallback; live status states; server-side token-usage/session-total console logs.
[CODEX DECISION] Keep Web Speech isolated behind TranscriptSource so a browser-native live source and TypedInput share one batching and interpretation pipeline.
[HUMAN DECISION] Voice behavior is approved; typed testing isolates the observed voice misfires to speech-recognition noise, so the Diagram Director prompt remains unchanged.
Codex speedups worth mentioning: Added the continuous-speech lifecycle, browser-permission recovery paths, and rate-conscious batching without altering the typed core loop.
Problems hit and how resolved: Chrome may end continuous recognition unexpectedly; restart only while listening remains explicitly enabled, while Stop aborts both recognition and pending interpretation work.

## 2026-07-17 Phase 3 — Layout & visual polish
Built: ELK-driven diagram positioning for flow and timeline layouts; deterministic bounded cycle placement based on ELK ordering; 500ms position and viewport transitions; node-kind accents/icons; stronger highlight glow; high-contrast edge labels; WWI sample alongside the water-cycle sample.
[CODEX DECISION] Use ELK layered layout for reliable ordering, then place cycle nodes in a bounded circular arrangement because ELK's radial algorithm overflowed on cyclic input in the browser build.
[HUMAN DECISION] Prioritize readable edge labels and clearly differentiated node types in the dark-board visual language.
Codex speedups worth mentioning: Added the layout engine, visual vocabulary, sample-driven verification, and browser screenshots in one focused polish phase.
Problems hit and how resolved: React Flow initially fit the temporary node positions before asynchronous layout resolved; added a post-layout viewport fit and bounded cycle coordinates.

[CODEX DECISION] Phase 3 punch-list verification: live typed probes passed—correction removed `evaporation`; Sun/Ocean produced exactly one `sun-heats-ocean` edge and no node; re-mentioning Evaporation returned a highlight without a duplicate. No Diagram Director prompt change was needed.

## 2026-07-17 Phase 4 — Gestures
Built: In-browser MediaPipe HandLandmarker PiP with landmark overlay; throttled and smoothed point cursor; debounced pinch selection; open-palm swipe undo; pointerContext submission; complete mouse and keyboard parity; camera-denied typed/mouse fallback.
[CODEX DECISION] Keep landmark processing in requestAnimationFrame and mutate the cursor DOM ref directly, avoiding React render storms while constraining inference to 30fps.
[HUMAN DECISION] Add self-edge rejection plus solid smoothstep edge labels and post-layout fit-to-view as the Phase 4 opening punch list.
Codex speedups worth mentioning: Connected gesture recognition, pointer-aware model context, and the no-camera control path without compromising the existing typed/speech pipeline.
Problems hit and how resolved: Browser hand tracking cannot be verified without an active physical camera; the app exposes a friendly explicit opt-in and remains completely usable through mouse/keyboard controls.

[CODEX DECISION] Map smoothed hand coordinates into the canvas element's bounding rectangle—not the full browser viewport—and align the axis with the unmirrored PiP, preventing the gesture cursor from appearing only when the finger leaves the expected board area.

[CODEX DECISION] Gesture defect root causes: viewport-pixel hit testing ignored React Flow transforms, the PiP/cursor mirror directions differed, repeated pinches had no exit hysteresis, and radial auto-fit could run after manual navigation. Fixed with Flow-space hit testing, matched mirroring, hand-size-normalized pinch enter/exit thresholds plus cooldowns, open-palm velocity-gated swipe, and a manual-viewport grace period.
[CODEX DECISION] Swipe velocity must use the mirrored hand axis, matching the PiP and cursor coordinate system; using the raw camera axis inverted the left-swipe detector.

## 2026-07-17 Phase 5 — Replay, export, handout, persistence
Built: Server-only `/api/summarize` handout generation with per-call and running token logging; Markdown handout download; dark PNG and portable JSON export/import; debounced local session restore; clear confirmation; and an isolated replay scrubber with play, pause, step, and exit controls.
[CODEX DECISION] Rebuild replay from the immutable ops log into a separate display diagram, so replay never mutates or risks losing the live board.
[HUMAN DECISION] Require the handout to stay grounded exclusively in the final diagram and transcript, including a diagram-specific recap, glossary, and answered comprehension questions.
Codex speedups worth mentioning: Added the second GPT-5.6 route, durable session artifacts, and a presentation-friendly replay path while preserving the existing typed, voice, and gesture loop.
Problems hit and how resolved: The existing board component had accumulated tightly coupled render state; separated the replay display state from live state and deferred restore/playback state changes to avoid React effect cascades.

[CODEX DECISION] PNG export converts `html-to-image`'s generated data URL back into an image Blob before download; wrapping the URL string itself produced a text payload mislabeled as a PNG.

## 2026-07-17 Phase 6 — Deploy & judge kit
Built: Public-release README with the required product, GPT-5.6, architecture, collaboration, setup, and judge-test sections; public-demo rate limits; production-build preparation; and GitHub/Vercel handoff materials.
[CODEX DECISION] Use lightweight in-memory per-IP route limits (20 interpret and 5 handout calls per minute) to protect the public demo balance while remaining generous for normal judging; production verification remains pending the hosted URL.
[HUMAN DECISION] Keep GitHub creation and Vercel environment-variable entry under the product owner’s control, with Codex providing precise release instructions and later production QA.
Codex speedups worth mentioning: Audited every reachable commit and every local Git blob object for common API-key patterns, completed the release documentation, and removed the build-time external font dependency for offline-reliable builds.
Problems hit and how resolved: The full object-store audit found one unreachable `.env.example` blob containing a key pattern; it was pruned before release. The initial production build could not fetch Google Fonts in this environment; replaced the remote build dependency with local system font fallbacks.

[CODEX DECISION] PNG export captures React Flow's renderer rather than its outer container, excluding the webcam video and landmark canvas that `html-to-image` cannot safely serialize.

[HUMAN DECISION] Direct production retest confirmed the typed correction behavior works; the earlier automated browser observation was a timing false negative, so no Diagram Director prompt change is authorized or needed.
