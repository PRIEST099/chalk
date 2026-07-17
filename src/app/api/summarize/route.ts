import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDailyRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { checkAllowedOrigin, SUMMARIZE_DAILY_LIMIT, SUMMARIZE_MAX_OUTPUT_TOKENS } from "@/lib/request-guards";

const requestId = z.string().min(1).max(80);
const requestLabel = z.string().min(1).max(120);
export const summarizeRequestSchema = z.object({
  title: z.string().min(1).max(160),
  subjectHint: z.string().max(120).optional(),
  transcript: z.string().min(1).max(16_000),
  diagram: z.object({
    nodes: z.array(z.object({ id: requestId, label: requestLabel, kind: z.string().min(1).max(40) })).max(40),
    edges: z.array(z.object({ id: requestId.optional(), source: requestId, target: requestId, label: z.string().max(120).optional() })).max(80),
  }),
});
let sessionInputTokens = 0; let sessionOutputTokens = 0;

export async function POST(request: Request) {
  const blockedOrigin = checkAllowedOrigin(request);
  if (blockedOrigin) return blockedOrigin;
  const rateLimited = checkRateLimit(request, "summarize", 5);
  if (rateLimited) return rateLimited;
  const dailyRateLimited = checkDailyRateLimit(request, "summarize", SUMMARIZE_DAILY_LIMIT);
  if (dailyRateLimited) return dailyRateLimited;
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Chalk could not read that handout request. Please try again." }, { status: 400 }); }
  const parsed = summarizeRequestSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Chalk needs a lesson and diagram before it can create a handout." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Add OPENAI_API_KEY to .env.local, then try again." }, { status: 503 });
  try {
    const lesson = parsed.data; const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({ model: process.env.OPENAI_MODEL ?? "gpt-5.6", max_output_tokens: SUMMARIZE_MAX_OUTPUT_TOKENS, input: [{ role: "system", content: "You write accurate class handouts. Use only facts present in the supplied transcript and diagram. Return Markdown only, with: a title, a 5 to 8 sentence recap grounded in the actual nodes and relationships, a ## Glossary with every node label and a one-line transcript-grounded definition, ## Comprehension Questions with exactly three questions, and ## Answers with their answers. Never invent facts." }, { role: "user", content: JSON.stringify(lesson) }] });
    if (response.usage) { sessionInputTokens += response.usage.input_tokens; sessionOutputTokens += response.usage.output_tokens; console.info("Chalk summarize usage", { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, sessionInputTokens, sessionOutputTokens }); }
    return NextResponse.json({ markdown: response.output_text });
  } catch (error) { console.error("Handout generation failed", error); return NextResponse.json({ error: "Chalk could not create the handout yet. Please try again." }, { status: 502 }); }
}
