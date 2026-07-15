# CHALK — Master Build Spec for Codex

**Event:** OpenAI Build Week 2026 · **Track:** Education · **Hard deadline:** July 21, 2026, 5:00 PM PT (= July 22, 3:00 AM GMT+3)
**Working title:** Chalk — *the board that draws itself* (name may change; keep it configurable in one place)

---

## 1. Your role and how to work

You are the lead engineer. I am the product owner. We are building a hackathon project that will be judged on: (1) how thoroughly and skillfully we use Codex and GPT-5.6, (2) a complete, coherent product experience — not a proof of concept, (3) a credible case for a real audience, (4) creativity and novelty.

Working agreement:

1. Build in the **phases** defined in §8, strictly in order. Do not start a later phase before the current phase's acceptance criteria pass.
2. At the end of every phase: make sure the app runs, commit with a descriptive message, append an entry to `DEVLOG.md` (format in §9.3), then give me a status update of at most 5 lines plus anything you need from me.
3. Make reasonable technical decisions autonomously and record each significant one in `DEVLOG.md` tagged `[CODEX DECISION]`. When I make a call, record it tagged `[HUMAN DECISION]`. This log is judging evidence — the hackathon requires us to document how we collaborated.
4. Ask me clarifying questions **only if truly blocking**, max 3 at a time.
5. Never commit secrets. The app must be runnable at the end of every phase.
6. If time pressure forces cuts, cut from the bottom of the current phase's feature list — never from the core loop (§2).

---

## 2. What we're building (product spec)

**One-liner:** Chalk is a live teaching board. A teacher just *talks*, and GPT-5.6 draws and continuously updates a clean concept diagram in real time. Pointing at the board with a hand (via webcam) lets the teacher reference and edit it with words and gestures together — "connect these two" while pointing creates the edge.

**Why it matters (Education track):**
- Teachers can't talk and draw well at the same time — especially in remote lessons, tutoring calls, and low-resource classrooms with no smartboard. Chalk gives every explanation a live visual.
- Visual learners and deaf/hard-of-hearing students get a second channel that carries the *meaning* of the lesson, not just captions.
- Students leave with a replayable diagram, plus an auto-generated handout (recap + comprehension questions) — the lesson becomes a durable artifact.

**Core loop (never cut this):**
speech → rolling transcript → GPT-5.6 "Diagram Director" (structured operations) → incremental, animated diagram on canvas.

**Primary demo scenario (the 3-minute video):** A teacher explains the water cycle. As they speak, nodes for Sun, Ocean, Evaporation, Condensation, Clouds, Precipitation appear and connect into a cycle layout. The teacher points at two nodes and says "and these two are linked, because heat drives this whole process" — an edge appears. They say "actually, scratch that last part" — it undoes. They hit Export and show the generated class handout.

---

## 3. Non-goals — do NOT build any of these

- No accounts, auth, or database. Persistence = `localStorage` + JSON file export/import.
- No multi-user real-time collaboration.
- No Google Meet / Zoom integration. Users screen-share the app; that's the distribution story.
- No mobile support. Chrome desktop only is acceptable and should be stated in the README.
- No sign-language recognition.
- No freehand ink drawing. The whole point is that the AI draws structure, not that humans draw ink.

Scope discipline beats features. A polished small thing wins; a broken big thing loses.

---

## 4. Tech stack (fixed choices — do not relitigate)

- **Framework:** Next.js (App Router) + TypeScript (strict). Deployed on Vercel.
- **Canvas:** React Flow (`@xyflow/react`) for nodes/edges, `elkjs` for auto-layout, CSS/JS transitions so nodes animate into place rather than teleporting.
- **Speech-to-text:** Web Speech API (Chrome) implemented behind a `TranscriptSource` interface. Also implement a **TypedInput** source (a textarea that streams its content through the same pipeline). TypedInput is both an accessibility mode and the judges' no-microphone test path — treat it as a first-class feature, not a debug tool. (Stretch, only if all phases done: an OpenAI audio-transcription source behind the same interface.)
- **Hand tracking:** MediaPipe Tasks Vision `HandLandmarker`, running fully in-browser, with a small webcam picture-in-picture overlay showing landmarks. Must degrade gracefully when no camera: every gesture action has a mouse/keyboard equivalent (§6).
- **LLM:** OpenAI API, called **only** from Next.js route handlers (server-side; API key never reaches the client). Model comes from env `OPENAI_MODEL`, default `gpt-5.6`. ⚠️ Before writing the OpenAI client code, check OpenAI's current official docs for the exact model identifier and the current recommended request format for structured outputs / tool calling — do not rely on memorized API shapes.
- **State:** `zustand` store holding diagram state + the full ops log (the ops log doubles as replay data and undo history).
- **Styling:** Tailwind. Visual direction: "modern chalkboard" — deep slate/charcoal canvas, chalk-white text, one warm accent color per node kind, rounded nodes, generous spacing. It should look like a finished product in screenshots.

---

## 5. The GPT-5.6 integration — the heart of the project, build with the most care

### 5.1 API route contract

`POST /api/interpret`

Request body:
```ts
{
  transcriptDelta: string;        // new final speech since last call
  recentTranscript: string;       // rolling context, trimmed to ~1500 chars
  diagram: {                      // compact — ids, labels, kinds only; no positions
    nodes: { id: string; label: string; kind: NodeKind; group?: string }[];
    edges: { id: string; source: string; target: string; label?: string }[];
    groups: { id: string; label: string }[];
    layout?: LayoutHint;
  };
  pointerContext: {
    pointedNodeIds: string[];     // nodes currently/recently pointed at via hand or mouse hover
    selectedNodeIds: string[];    // nodes pinched/clicked-selected (max 2)
  };
  subjectHint?: string;           // optional session topic set by user
}
```

Response body: `{ ops: DiagramOp[] }`

Server-side validation before returning: drop any op that references a non-existent id (except `add_*`), cap at 8 ops per response, log dropped ops as warnings. The client must never crash on a malformed op.

### 5.2 DiagramOp schema (implement exactly; this also goes in the README)

```ts
type NodeKind = "concept" | "actor" | "process" | "stage" | "data" | "example" | "note";
type LayoutHint = "flow" | "tree" | "timeline" | "cycle" | "radial";

type DiagramOp =
  | { op: "add_node"; id: string; label: string; kind: NodeKind; group?: string }
  | { op: "update_node"; id: string; label?: string; kind?: NodeKind }
  | { op: "remove_node"; id: string }
  | { op: "add_edge"; id: string; source: string; target: string; label?: string; directed?: boolean }
  | { op: "remove_edge"; id: string }
  | { op: "group_nodes"; id: string; label: string; nodeIds: string[] }
  | { op: "set_layout"; hint: LayoutHint }
  | { op: "highlight"; nodeIds: string[]; reason?: string }
  | { op: "clear_highlights" }
  | { op: "annotate"; nodeId: string; text: string }
  | { op: "no_op"; reason: string };
```

Use OpenAI structured outputs (or tool calling with a strict JSON schema — whichever current docs recommend) so responses always parse.

### 5.3 System prompt for the Diagram Director (use verbatim; iterate only with me)

```
You are the Diagram Director for Chalk, a live board that turns a teacher's
spoken explanation into a clean, evolving concept diagram.

Each request gives you:
- transcript_delta: new speech since your last decision (may contain filler and ASR noise)
- recent_transcript: rolling context (~last 60 seconds)
- diagram: current nodes, edges, and groups (compact)
- pointer_context: node ids the speaker is pointing at or has selected (may be empty)
- subject_hint: optional topic

Respond ONLY with operations conforming to the provided schema. Emit the
minimal set (0–6 ops) that keeps the board faithful to the explanation SO FAR.
If the new speech adds nothing board-worthy (greetings, filler, classroom
logistics), return a single no_op.

Rules:
1. Nodes are durable concepts, actors, processes, stages, quantities, or
   examples — never full sentences. Labels are at most 4 words, Title Case.
2. Reuse before you create: if a mentioned idea matches an existing node,
   update or highlight it instead of adding a near-duplicate. Node ids are
   stable kebab-case slugs of the label.
3. Deixis: when speech says "this / that / these two / here", resolve the
   reference using pointer_context first, then the most recently added or
   highlighted nodes. If the speaker points at two nodes and states or implies
   a relationship ("these are connected", "this feeds into that"), emit
   add_edge between them with a short label.
4. Corrections: "actually / no wait / scratch that / I misspoke" means remove
   or rename the affected recent element(s) rather than adding a contradiction.
5. Granularity: target 6–15 nodes for a five-minute explanation. Prefer one
   good node over three weak ones. Minor details become annotate notes, not nodes.
6. Structure: when the shape of the explanation becomes clear, emit set_layout —
   cycle (looping processes), timeline (historical sequence), tree (hierarchies),
   flow (cause-and-effect chains), radial (one hub, many spokes). Set it at most
   once unless the structure genuinely changes.
7. Follow the speaker: when they return to an existing concept, emit highlight
   for it (and clear_highlights when they move on) so students can follow along.
8. Ground truth is the speech: never invent facts that were not stated or
   clearly implied. You may normalize obvious speech-recognition errors using context.
9. Edges need a reason: only connect nodes when the speech states or strongly
   implies the relationship; label the edge with 1–3 words when the relation
   is not obvious.
10. Be decisive. A good-enough board now, refined by later operations, beats
    waiting for perfect information.
```

### 5.4 Client batching logic

- Fire `/api/interpret` on each utterance-final event from the transcript source, OR every 4 seconds if ≥ ~80 new characters have accumulated. Never send an empty delta.
- Max one request in flight; if new speech arrives mid-flight, coalesce it into the next request.
- Before applying a returned ops batch, push a snapshot of diagram state onto the undo stack. Apply the batch atomically with animation.
- Show a status pill in the header: **Listening → Thinking → Drawing → Idle**.
- Target p50 latency under ~2.5s from utterance-final to first animation. Keep payloads small (§5.1 trimming rules) — this also controls API spend.

### 5.5 Second GPT-5.6 use: the Class Handout

`POST /api/summarize` — takes the final diagram + full transcript, returns Markdown: a 5–8 sentence recap of the lesson **grounded in the diagram**, a glossary of node labels with one-line definitions from the transcript, and 3 comprehension questions (with answers collapsed at the bottom). This powers the "Export handout" feature and is our second, distinct, non-trivial GPT-5.6 integration — mention both uses explicitly in the README.

### 5.6 Behavior requirements (test these by hand before calling Phase 2/4 done)

- Chit-chat ("okay everyone, settle down") → `no_op`.
- "Actually, scratch that" after adding a node → the node is removed.
- Pointing at two nodes + "these two are connected" → correct edge appears.
- Re-explaining an existing concept → highlight, not a duplicate node.
- Water-cycle sample → `set_layout: cycle` fires at a sensible moment.

---

## 6. Gesture spec — exactly three gestures, no more

| Gesture | Detection | Effect |
|---|---|---|
| **Point** | Index finger extended, others curled | On-canvas cursor follows fingertip; hovering a node ≥ 400ms marks it "pointed" → added to `pointerContext` + subtle glow on the node |
| **Pinch** | Thumb + index tips touch | Select/deselect the pointed node (max 2 selected, FIFO) |
| **Open-palm swipe left** | Open hand, fast leftward wrist travel | Undo last ops batch |

Implementation notes: run HandLandmarker in `requestAnimationFrame`, throttle to ≤ 30fps, smooth the cursor (exponential moving average), and debounce gesture triggers so one pinch = one select. Show the webcam PiP (bottom-right, ~200px) with landmarks drawn so the demo visibly proves it's real.

**Mouse parity is mandatory:** hover = point, click = pinch-select, Ctrl/Cmd+Z = undo. Judges may test with no camera; nothing may be gesture-only.

---

## 7. UX spec

**Layout:** Header (app name, editable session title, subject hint field, status pill). Main area = canvas. Right sidebar = live transcript (final text solid, interim text ghosted, auto-scroll). Bottom bar = controls: Start/Stop listening · Typed input toggle · Undo · Replay · Export (PNG / JSON / Handout MD) · Load sample.

**Node visual language:** each `NodeKind` gets a distinct accent color + tiny icon; edges are subtle with small labels; highlighted nodes glow; new nodes fade/scale in; layout changes animate positions over ~500ms.

**Replay mode:** a scrubber that replays the ops log from an empty board — students see the explanation rebuild step by step. (Free feature: the ops log already exists.)

**Sample seeds:** 3 built-in scripts — *The Water Cycle*, *Photosynthesis*, *Causes of World War I* (timeline). "Load sample" streams the script through the normal pipeline sentence-by-sentence as if spoken. This is the judges' zero-hardware demo path AND our fallback if live speech misbehaves while recording the video.

**Resilience:** friendly empty state on first load; every failure (API error, mic denied, camera denied, offline) shows a toast + recovery action; the app must never hard-crash. Wrap speech, camera, and API layers in error boundaries.

---

## 8. Build phases with acceptance criteria

**Phase 0 — Scaffold & hygiene (Jul 15)**
Next.js + TS strict + Tailwind + zustand; MIT `LICENSE`; `.env.example` (`OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.6`); `README.md` skeleton with all §9.1 headings; empty `DEVLOG.md`; `npm run typecheck` script. ✅ AC: fresh clone + env + `npm run dev` shows the shell layout.

**Phase 1 — Core loop via typed input (Jul 15–16)**
`/api/interpret` + schema validation + Diagram Director prompt; zustand diagram store + ops applier + undo snapshots; React Flow canvas with basic styling; TypedInput source streaming through the pipeline. ✅ AC: pasting the water-cycle sample paragraph-by-paragraph produces a correct, animated diagram; "actually scratch that" removes; no crash on malformed model output (test by faking one).

**Phase 2 — Live speech (Jul 17)**
Web Speech API source behind `TranscriptSource`; transcript sidebar with interim ghosting; batching per §5.4; status pill. ✅ AC: speaking naturally for 2 minutes builds a sensible diagram; all §5.6 behaviors pass by voice.

**Phase 3 — Layout & visual polish (Jul 17–18)**
elkjs auto-layout driven by `set_layout` hints; animated position transitions; node-kind visual language; highlight glow. ✅ AC: water-cycle sample lays out as a cycle; WWI sample as a timeline; screenshots look like a finished product.

**Phase 4 — Gestures (Jul 18–19)**
MediaPipe HandLandmarker; the three gestures; PiP overlay; pointerContext wired into `/api/interpret`; mouse parity. ✅ AC: point at two nodes, say "connect these two" → edge appears; palm swipe undoes; camera-denied fallback works.

**Phase 5 — Replay, export, handout (Jul 19–20)**
Replay scrubber; PNG export (canvas snapshot); JSON save/load; `/api/summarize` + Handout MD download; localStorage session restore. ✅ AC: handout for the water-cycle sample is accurate and well-formatted; reload restores the session.

**Phase 6 — Deploy & judge kit (Jul 20)**
Vercel deploy; README completed per §9.1 including the Judge Testing Guide; DEVLOG polished; final QA pass of every AC above on the deployed URL. ✅ AC: a stranger with no mic and no camera can open the URL, click Load Sample, and understand the product in 2 minutes.

**Jul 21 is reserved for the video and Devpost submission — no new features that day.**

---

## 9. Repo & hackathon compliance (non-negotiable)

### 9.1 README.md must contain, in this order
1. Name + tagline + hero GIF/screenshot
2. **What it does** (3–5 sentences) and the problem it solves for teachers/students
3. **Track:** Education — 2–3 sentences on fit
4. **How GPT-5.6 is used** — specific: (a) the Diagram Director turning live speech + gesture deixis into incremental structured diagram operations (include the DiagramOp schema), (b) the Class Handout generator. State clearly that GPT-5.6 is the core of the product, not a bolt-on.
5. **Architecture** — a Mermaid diagram of the pipeline (mic/typed → transcript → /api/interpret → GPT-5.6 → ops → canvas; camera → MediaPipe → pointerContext)
6. **How we built this with Codex** — scaffold the section with subheads (*Where Codex accelerated us · Key decisions we made ourselves · How the collaboration worked*); I will finalize the prose from `DEVLOG.md`. This section is explicitly judged.
7. **Local setup** — clone, env vars, run; note Chrome-desktop requirement
8. **Judge Testing Guide** — hosted URL; the no-mic/no-camera path (Typed Input + Load Sample); a 2-minute "what to try" list; what to expect
9. License (MIT)

### 9.2 Hard rules
- `.env.example` committed; real keys never committed; API key server-side only.
- Repo will be **public** with MIT license (or, if I decide private, shared with `testing@devpost.com` and `build-week-event@openai.com`) — write code and comments accordingly.
- App must run with nothing but `OPENAI_API_KEY` set.
- All materials in English.

### 9.3 DEVLOG.md entry format (append every phase, plus ad-hoc for big decisions)
```
## [date] Phase N — <title>
Built: ...
[CODEX DECISION] ... (what + why)
[HUMAN DECISION] ... (what + why)
Codex speedups worth mentioning: ...
Problems hit and how resolved: ...
```

---

## 10. Quality bar

- TypeScript strict; no `any` on core paths; no dead code or TODO stubs on main.
- Every user-visible failure has a friendly state and a recovery path.
- The app must survive: API 500s, rate limits, mic permission denied, camera permission denied, offline mid-session.
- Commit at every phase boundary minimum, with messages that describe intent.
- Hand tracking must not jank the canvas (throttle, avoid re-render storms; keep landmark processing off the React render path).

---

## 11. Submission checklist (for both of us — surface this at the end of Phase 6)

- [ ] Hosted URL live and cold-start tested
- [ ] Repo public (MIT) or shared with `testing@devpost.com` + `build-week-event@openai.com`
- [ ] README complete per §9.1, including the Codex collaboration section
- [ ] `/feedback` run **in this Codex thread** → Session ID saved for the submission form
- [ ] Demo video: under 3 minutes, public on YouTube, with audio narration covering **what we built AND how we used Codex + GPT-5.6**, no copyrighted music or third-party trademarks
- [ ] Devpost form: track = Education, text description, video link, repo URL, Session ID — submitted **before Jul 21, 5:00 PM PT**

---

## 12. First action

Confirm you've read this spec. Restate your Phase 0 + Phase 1 plan in at most 10 bullets. Ask me at most 3 questions only if genuinely blocking. Then begin Phase 0.
