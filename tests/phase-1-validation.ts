import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { diagramOpsSchema, normalizeModelOps, retainValidOps, type DiagramOp } from "../src/lib/diagram";

assert.doesNotThrow(() => zodTextFormat(diagramOpsSchema, "diagram_operations"));

const malformed: DiagramOp[] = [
  { op: "add_edge", id: "broken-edge", source: "missing", target: "ocean" },
  { op: "update_node", id: "missing", label: "Missing" },
  { op: "highlight", nodeIds: ["missing"] },
  { op: "add_node", id: "clouds", label: "Clouds", kind: "concept" },
];
const retained = retainValidOps(malformed, ["ocean"], []);
assert.deepEqual(retained, [{ op: "add_node", id: "clouds", label: "Clouds", kind: "concept" }]);

const nullPayload = diagramOpsSchema.parse({ ops: [{ op: "add_edge", id: "ocean-clouds", source: "ocean", target: "clouds", label: null, directed: null }, { op: "highlight", nodeIds: ["clouds"], reason: null }] });
const normalized = normalizeModelOps(nullPayload.ops);
assert.deepEqual(normalized, [{ op: "add_edge", id: "ocean-clouds", source: "ocean", target: "clouds", label: undefined, directed: undefined }, { op: "highlight", nodeIds: ["clouds"], reason: undefined }]);
assert.equal(retainValidOps(normalized, ["ocean", "clouds"], []).length, 2);
console.log("Structured format builds; malformed operations drop; null fields normalize safely.");
