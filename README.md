# Chalk — the board that draws itself

> Hero screenshot/GIF coming in Phase 6.

## What it does

Chalk is a live teaching board that turns a teacher's spoken explanation into a clean, evolving concept diagram. It gives visual learners and deaf or hard-of-hearing students a second channel for lesson meaning, while letting teachers keep teaching naturally. Lessons can be replayed and exported as durable study material.

## Track: Education

Chalk helps teachers explain and visualize at the same time, whether they are tutoring remotely or teaching with limited classroom technology. Its durable diagrams and handouts give students a clearer way to revisit lessons.

## How GPT-5.6 is used

GPT-5.6 is Chalk's core: the Diagram Director translates live speech and gesture context into structured diagram operations, while the Class Handout generator turns the completed lesson into a grounded recap and questions.

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

## Architecture

```mermaid
flowchart LR
  A[Mic / Typed input] --> B[Transcript] --> C[/api/interpret] --> D[GPT-5.6] --> E[Diagram operations] --> F[Canvas]
  G[Camera] --> H[MediaPipe] --> I[Pointer context] --> C
```

## How we built this with Codex

### Where Codex accelerated us

### Key decisions we made ourselves

### How the collaboration worked

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.
3. Run `npm run dev`.

Chalk targets Chrome on desktop.

## Judge Testing Guide

Hosted URL: coming in Phase 6. No microphone or camera is required: use Typed Input or Load Sample. A two-minute guided test will be added before deployment.

## License

[MIT](LICENSE)
