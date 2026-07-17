import { z } from "zod";

export const nodeKinds = ["concept", "actor", "process", "stage", "data", "example", "note"] as const;
export const layoutHints = ["flow", "tree", "timeline", "cycle", "radial"] as const;
export type NodeKind = (typeof nodeKinds)[number];
export type LayoutHint = (typeof layoutHints)[number];

const base = { id: z.string().min(1) };
export const diagramOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_node"), ...base, label: z.string().min(1), kind: z.enum(nodeKinds), group: z.string().nullable() }),
  z.object({ op: z.literal("update_node"), ...base, label: z.string().min(1).nullable(), kind: z.enum(nodeKinds).nullable() }),
  z.object({ op: z.literal("remove_node"), ...base }),
  z.object({ op: z.literal("add_edge"), ...base, source: z.string().min(1), target: z.string().min(1), label: z.string().nullable(), directed: z.boolean().nullable() }),
  z.object({ op: z.literal("remove_edge"), ...base }),
  z.object({ op: z.literal("group_nodes"), ...base, label: z.string().min(1), nodeIds: z.array(z.string().min(1)).min(1) }),
  z.object({ op: z.literal("set_layout"), hint: z.enum(layoutHints) }),
  z.object({ op: z.literal("highlight"), nodeIds: z.array(z.string().min(1)).min(1), reason: z.string().nullable() }),
  z.object({ op: z.literal("clear_highlights") }),
  z.object({ op: z.literal("annotate"), nodeId: z.string().min(1), text: z.string().min(1) }),
  z.object({ op: z.literal("no_op"), reason: z.string().min(1) }),
]);
export const diagramOpsSchema = z.object({ ops: z.array(diagramOpSchema).max(8) });
export const publicDiagramOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_node"), ...base, label: z.string().min(1), kind: z.enum(nodeKinds), group: z.string().optional() }),
  z.object({ op: z.literal("update_node"), ...base, label: z.string().min(1).optional(), kind: z.enum(nodeKinds).optional() }),
  z.object({ op: z.literal("remove_node"), ...base }),
  z.object({ op: z.literal("add_edge"), ...base, source: z.string().min(1), target: z.string().min(1), label: z.string().optional(), directed: z.boolean().optional() }),
  z.object({ op: z.literal("remove_edge"), ...base }),
  z.object({ op: z.literal("group_nodes"), ...base, label: z.string().min(1), nodeIds: z.array(z.string().min(1)).min(1) }),
  z.object({ op: z.literal("set_layout"), hint: z.enum(layoutHints) }),
  z.object({ op: z.literal("highlight"), nodeIds: z.array(z.string().min(1)).min(1), reason: z.string().optional() }),
  z.object({ op: z.literal("clear_highlights") }),
  z.object({ op: z.literal("annotate"), nodeId: z.string().min(1), text: z.string().min(1) }),
  z.object({ op: z.literal("no_op"), reason: z.string().min(1) }),
]);
export const publicDiagramOpsSchema = z.object({ ops: z.array(publicDiagramOpSchema).max(8) });
export type ModelDiagramOp = z.infer<typeof diagramOpSchema>;
export type DiagramOp =
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

/** Converts Structured Output's required nullable properties to the public operations contract. */
export function normalizeModelOps(ops: ModelDiagramOp[]): DiagramOp[] {
  return ops.map((operation) => {
    switch (operation.op) {
      case "add_node": return { ...operation, group: operation.group ?? undefined };
      case "update_node": return { ...operation, label: operation.label ?? undefined, kind: operation.kind ?? undefined };
      case "add_edge": return { ...operation, label: operation.label ?? undefined, directed: operation.directed ?? undefined };
      case "highlight": return { ...operation, reason: operation.reason ?? undefined };
      default: return operation;
    }
  });
}

export type DiagramNode = { id: string; label: string; kind: NodeKind; group?: string; note?: string; x: number; y: number };
export type DiagramEdge = { id: string; source: string; target: string; label?: string; directed?: boolean };
export type DiagramGroup = { id: string; label: string; nodeIds: string[] };
export type Diagram = { nodes: DiagramNode[]; edges: DiagramEdge[]; groups: DiagramGroup[]; layout?: LayoutHint; highlights: string[] };
export const emptyDiagram = (): Diagram => ({ nodes: [], edges: [], groups: [], highlights: [] });

const requestId = z.string().min(1).max(80);
const requestLabel = z.string().min(1).max(120);
const compactDiagramSchema = z.object({
  nodes: z.array(z.object({ id: requestId, label: requestLabel, kind: z.enum(nodeKinds), group: z.string().max(120).optional() })).max(40),
  edges: z.array(z.object({ id: requestId, source: requestId, target: requestId, label: z.string().max(120).optional() })).max(80),
  groups: z.array(z.object({ id: requestId, label: requestLabel })).max(12),
  layout: z.enum(layoutHints).optional(),
});

export const interpretRequestSchema = z.object({
  transcriptDelta: z.string().min(1).max(4_000),
  recentTranscript: z.string().max(4_000),
  diagram: compactDiagramSchema,
  pointerContext: z.object({ pointedNodeIds: z.array(requestId).max(4), selectedNodeIds: z.array(requestId).max(2) }),
  subjectHint: z.string().max(120).optional(),
});
export type InterpretRequest = z.infer<typeof interpretRequestSchema>;

export function compactDiagram(diagram: Diagram) { return { nodes: diagram.nodes.map(({ id, label, kind, group }) => ({ id, label, kind, group })), edges: diagram.edges.map(({ id, source, target, label }) => ({ id, source, target, label })), groups: diagram.groups.map(({ id, label }) => ({ id, label })), layout: diagram.layout }; }

export function applyOps(diagram: Diagram, ops: DiagramOp[]): Diagram {
  const next: Diagram = structuredClone(diagram);
  for (const operation of ops) {
    if (operation.op === "add_node") next.nodes.push({ ...operation, x: 100 + next.nodes.length * 35, y: 140 + (next.nodes.length % 4) * 120 });
    if (operation.op === "update_node") next.nodes = next.nodes.map((node) => node.id === operation.id ? { ...node, ...operation } : node);
    if (operation.op === "remove_node") { next.nodes = next.nodes.filter((node) => node.id !== operation.id); next.edges = next.edges.filter((edge) => edge.source !== operation.id && edge.target !== operation.id); }
    if (operation.op === "add_edge") next.edges.push({ ...operation });
    if (operation.op === "remove_edge") next.edges = next.edges.filter((edge) => edge.id !== operation.id);
    if (operation.op === "group_nodes") next.groups = [...next.groups.filter((group) => group.id !== operation.id), operation];
    if (operation.op === "set_layout") next.layout = operation.hint;
    if (operation.op === "highlight") next.highlights = operation.nodeIds;
    if (operation.op === "clear_highlights") next.highlights = [];
    if (operation.op === "annotate") next.nodes = next.nodes.map((node) => node.id === operation.nodeId ? { ...node, note: operation.text } : node);
  }
  return next;
}

/** Removes operations that could corrupt the current client diagram. */
export function retainValidOps(ops: DiagramOp[], startingNodeIds: Iterable<string>, startingEdgeIds: Iterable<string>): DiagramOp[] {
  const nodeIds = new Set(startingNodeIds); const edgeIds = new Set(startingEdgeIds); const valid: DiagramOp[] = [];
  for (const operation of ops.slice(0, 8)) {
    const needsNodes = (ids: string[]) => ids.every((id) => nodeIds.has(id));
    const accepted = operation.op === "add_node" || operation.op === "set_layout" || operation.op === "clear_highlights" || operation.op === "no_op"
      || (operation.op === "update_node" || operation.op === "remove_node" || operation.op === "annotate" ? nodeIds.has(operation.op === "annotate" ? operation.nodeId : operation.id)
          : operation.op === "add_edge" ? operation.source !== operation.target && needsNodes([operation.source, operation.target]) && !edgeIds.has(operation.id)
          : operation.op === "remove_edge" ? edgeIds.has(operation.id)
            : operation.op === "group_nodes" || operation.op === "highlight" ? needsNodes(operation.nodeIds) : false);
    if (!accepted) { console.warn("Dropped invalid diagram operation", operation); continue; }
    valid.push(operation);
    if (operation.op === "add_node") nodeIds.add(operation.id);
    if (operation.op === "remove_node") nodeIds.delete(operation.id);
    if (operation.op === "add_edge") edgeIds.add(operation.id);
    if (operation.op === "remove_edge") edgeIds.delete(operation.id);
  }
  return valid;
}
