import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { DIAGRAM_DIRECTOR_PROMPT } from "@/lib/diagram-director";
import { diagramOpsSchema, interpretRequestSchema, normalizeModelOps, retainValidOps } from "@/lib/diagram";

export const runtime = "nodejs";
let sessionInputTokens = 0;
let sessionOutputTokens = 0;

export async function POST(request: Request) {
  const parsedRequest = interpretRequestSchema.safeParse(await request.json());
  if (!parsedRequest.success) return NextResponse.json({ error: "Please send a valid lesson update." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Add OPENAI_API_KEY to .env.local, then try again." }, { status: 503 });
  try {
    const input = parsedRequest.data;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.responses.parse({ model: process.env.OPENAI_MODEL ?? "gpt-5.6", input: [{ role: "system", content: DIAGRAM_DIRECTOR_PROMPT }, { role: "user", content: JSON.stringify({ transcript_delta: input.transcriptDelta, recent_transcript: input.recentTranscript, diagram: input.diagram, pointer_context: input.pointerContext, subject_hint: input.subjectHint }) }], text: { format: zodTextFormat(diagramOpsSchema, "diagram_operations") } });
    const usage = completion.usage;
    if (usage) { sessionInputTokens += usage.input_tokens; sessionOutputTokens += usage.output_tokens; console.info("Chalk interpret usage", { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, sessionInputTokens, sessionOutputTokens }); }
    const result = completion.output_parsed;
    if (!result) return NextResponse.json({ ops: [] });
    const normalizedOps = normalizeModelOps(result.ops);
    return NextResponse.json({ ops: retainValidOps(normalizedOps, new Set(input.diagram.nodes.map((node) => node.id)), new Set(input.diagram.edges.map((edge) => edge.id))) });
  } catch (error) { console.error("Diagram interpretation failed", error); return NextResponse.json({ error: "Chalk could not interpret that yet. Please try again." }, { status: 502 }); }
}
