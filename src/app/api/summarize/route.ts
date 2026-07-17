import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({ title: z.string().min(1).max(160), subjectHint: z.string().max(120).optional(), transcript: z.string().min(1).max(12000), diagram: z.object({ nodes: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string() })), edges: z.array(z.object({ source: z.string(), target: z.string(), label: z.string().optional() })) }) });
let sessionInputTokens = 0; let sessionOutputTokens = 0;

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Chalk could not read that handout request. Please try again." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Chalk needs a lesson and diagram before it can create a handout." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Add OPENAI_API_KEY to .env.local, then try again." }, { status: 503 });
  try {
    const lesson = parsed.data; const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({ model: process.env.OPENAI_MODEL ?? "gpt-5.6", input: [{ role: "system", content: "You write accurate class handouts. Use only facts present in the supplied transcript and diagram. Return Markdown only, with: a title, a 5 to 8 sentence recap grounded in the actual nodes and relationships, a ## Glossary with every node label and a one-line transcript-grounded definition, ## Comprehension Questions with exactly three questions, and ## Answers with their answers. Never invent facts." }, { role: "user", content: JSON.stringify(lesson) }] });
    if (response.usage) { sessionInputTokens += response.usage.input_tokens; sessionOutputTokens += response.usage.output_tokens; console.info("Chalk summarize usage", { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, sessionInputTokens, sessionOutputTokens }); }
    return NextResponse.json({ markdown: response.output_text });
  } catch (error) { console.error("Handout generation failed", error); return NextResponse.json({ error: "Chalk could not create the handout yet. Please try again." }, { status: 502 }); }
}
