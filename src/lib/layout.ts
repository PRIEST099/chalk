import ELK from "elkjs/lib/elk.bundled.js";
import type { Diagram, DiagramNode } from "@/lib/diagram";

const elk = new ELK();

export const NODE_HEIGHT = 64;
/** Approximate rendered node width; shared with gesture hit-testing so both stay in sync. */
export const nodeBoxWidth = (node: Pick<DiagramNode, "label">) => Math.max(130, node.label.length * 11 + 40);

/** Orders nodes by walking the directed edges so ring neighbors follow the explanation, starting from sources. */
function edgeWalkOrder(nodes: DiagramNode[], edges: Diagram["edges"]): DiagramNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const inDegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    if (inDegree.has(edge.target)) inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }
  const visited = new Set<string>();
  const order: DiagramNode[] = [];
  const starts = [...nodes].sort((a, b) => (inDegree.get(a.id) ?? 0) - (inDegree.get(b.id) ?? 0));
  for (const start of starts) {
    let currentId: string | undefined = start.id;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = byId.get(currentId);
      if (node) order.push(node);
      currentId = (outgoing.get(currentId) ?? []).find((target) => byId.has(target) && !visited.has(target));
    }
  }
  return order;
}

/** Places node centers on an ellipse sized from node dimensions so neighbors never overlap. */
function ringLayout(diagram: Diagram, hubId?: string): DiagramNode[] {
  const hub = hubId ? diagram.nodes.find((node) => node.id === hubId) : undefined;
  const ringNodes = edgeWalkOrder(diagram.nodes.filter((node) => node.id !== hub?.id), diagram.edges);
  const count = Math.max(ringNodes.length, 1);
  const maxWidth = Math.max(130, ...ringNodes.map(nodeBoxWidth));
  const neighborClearance = maxWidth + 56;
  const hubClearance = hub ? nodeBoxWidth(hub) / 2 + maxWidth / 2 + 90 : 0;
  const rx = Math.max(210, hubClearance, count >= 3 ? neighborClearance / (2 * Math.sin(Math.PI / count)) : 210);
  const ry = Math.max(160, hub ? NODE_HEIGHT / 2 + 40 + NODE_HEIGHT + 60 : 0, rx * 0.72);
  const cx = rx + maxWidth / 2 + 40;
  const cy = ry + NODE_HEIGHT / 2 + 40;
  const positions = new Map(ringNodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return [node.id, { x: cx + Math.cos(angle) * rx - nodeBoxWidth(node) / 2, y: cy + Math.sin(angle) * ry - NODE_HEIGHT / 2 }];
  }));
  if (hub) positions.set(hub.id, { x: cx - nodeBoxWidth(hub) / 2, y: cy - NODE_HEIGHT / 2 });
  return diagram.nodes.map((node) => ({ ...node, ...positions.get(node.id) }));
}

export async function layoutDiagram(diagram: Diagram): Promise<DiagramNode[]> {
  if (diagram.nodes.length === 0) return [];
  const hint = diagram.layout ?? "flow";
  if (hint === "cycle" && diagram.nodes.length >= 3) return ringLayout(diagram);
  if (hint === "radial" && diagram.nodes.length >= 3) {
    const degree = new Map<string, number>(diagram.nodes.map((node) => [node.id, 0]));
    for (const edge of diagram.edges) { degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1); degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1); }
    const hub = [...diagram.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
    return ringLayout(diagram, hub.id);
  }
  const graph = await elk.layout({
    id: "chalk-diagram",
    layoutOptions: {
      "elk.algorithm": "org.eclipse.elk.layered",
      "elk.direction": hint === "timeline" ? "RIGHT" : "DOWN",
      "elk.spacing.nodeNode": "72",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
    },
    children: diagram.nodes.map((node) => ({ id: node.id, width: nodeBoxWidth(node), height: NODE_HEIGHT })),
    edges: diagram.edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });
  const positions = new Map((graph.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
  return diagram.nodes.map((node) => ({ ...node, ...positions.get(node.id) }));
}
