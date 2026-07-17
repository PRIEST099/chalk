import assert from "node:assert/strict";
import { POST as interpretPost } from "@/app/api/interpret/route";
import { POST as summarizePost, summarizeRequestSchema } from "@/app/api/summarize/route";
import { interpretRequestSchema } from "@/lib/diagram";
import { checkDailyRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { checkAllowedOrigin, INTERPRET_MAX_OUTPUT_TOKENS, SUMMARIZE_MAX_OUTPUT_TOKENS } from "@/lib/request-guards";

const validInterpretRequest = {
  transcriptDelta: "The sun heats the ocean.",
  recentTranscript: "The sun heats the ocean.",
  diagram: { nodes: [], edges: [], groups: [] },
  pointerContext: { pointedNodeIds: [], selectedNodeIds: [] },
};

const validSummaryRequest = {
  title: "Water cycle",
  transcript: "The sun heats the ocean.",
  diagram: { nodes: [{ id: "sun", label: "Sun", kind: "concept" }], edges: [] },
};

function request(url: string, body: unknown, origin: string) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
}

async function body(response: Response) {
  return response.json() as Promise<{ error?: string }>;
}

async function main() {
assert.equal(checkAllowedOrigin(request("http://localhost:3000/api/interpret", {}, "http://localhost:3000")), null);
assert.equal(checkAllowedOrigin(request("https://chalk-ebon.vercel.app/api/interpret", {}, "https://chalk-ebon.vercel.app")), null);
const crossOrigin = checkAllowedOrigin(request("http://localhost:3000/api/interpret", {}, "https://example.com"));
assert.equal(crossOrigin?.status, 403);
assert.match((await body(crossOrigin!)).error ?? "", /only accepts requests/i);
assert.equal(checkAllowedOrigin(new Request("http://localhost:3000/api/interpret", { method: "POST" }))?.status, 403);

assert.equal(interpretRequestSchema.safeParse(validInterpretRequest).success, true);
assert.equal(interpretRequestSchema.safeParse({ ...validInterpretRequest, transcriptDelta: "x".repeat(4_001) }).success, false);
assert.equal(interpretRequestSchema.safeParse({ ...validInterpretRequest, recentTranscript: "x".repeat(4_001) }).success, false);
assert.equal(interpretRequestSchema.safeParse({ ...validInterpretRequest, diagram: { ...validInterpretRequest.diagram, nodes: Array.from({ length: 41 }, (_, index) => ({ id: `node-${index}`, label: "Node", kind: "concept" })) } }).success, false);

assert.equal(summarizeRequestSchema.safeParse(validSummaryRequest).success, true);
assert.equal(summarizeRequestSchema.safeParse({ ...validSummaryRequest, transcript: "x".repeat(16_001) }).success, false);
assert.equal(summarizeRequestSchema.safeParse({ ...validSummaryRequest, diagram: { ...validSummaryRequest.diagram, edges: Array.from({ length: 81 }, (_, index) => ({ id: `edge-${index}`, source: "sun", target: "sun" })) } }).success, false);
assert.equal(INTERPRET_MAX_OUTPUT_TOKENS, 1_200);
assert.equal(SUMMARIZE_MAX_OUTPUT_TOKENS, 1_800);

const rateRequest = request("http://localhost:3000/api/interpret", {}, "http://localhost:3000");
assert.equal(checkRateLimit(rateRequest, "rate-test-minute", 1), null);
assert.equal(checkRateLimit(rateRequest, "rate-test-minute", 1)?.status, 429);
assert.equal(checkDailyRateLimit(rateRequest, "rate-test-day", 1), null);
const dailyLimit = checkDailyRateLimit(rateRequest, "rate-test-day", 1);
assert.equal(dailyLimit?.status, 429);
assert.match((await body(dailyLimit!)).error ?? "", /daily demo request allowance/i);

const blockedInterpret = await interpretPost(request("http://localhost:3000/api/interpret", validInterpretRequest, "https://example.com"));
assert.equal(blockedInterpret.status, 403);
const localInterpret = await interpretPost(request("http://localhost:3000/api/interpret", {}, "http://localhost:3000"));
assert.equal(localInterpret.status, 400);
const blockedSummary = await summarizePost(request("http://localhost:3000/api/summarize", validSummaryRequest, "https://example.com"));
assert.equal(blockedSummary.status, 403);
const localSummary = await summarizePost(request("http://localhost:3000/api/summarize", {}, "http://localhost:3000"));
assert.equal(localSummary.status, 400);

console.log("Origin protection, payload bounds, output ceilings, and rate limits pass.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
