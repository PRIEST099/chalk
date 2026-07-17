import ELK from "elkjs/lib/elk.bundled.js";
import type { Diagram, DiagramNode } from "@/lib/diagram";

const elk = new ELK();

export async function layoutDiagram(diagram: Diagram): Promise<DiagramNode[]> {
  if (diagram.nodes.length === 0) return [];
  const hint = diagram.layout ?? "flow";
  const graph = await elk.layout({
    id: "chalk-diagram",
    layoutOptions: {
      "elk.algorithm": "org.eclipse.elk.layered",
      "elk.direction": hint === "timeline" ? "RIGHT" : "DOWN",
      "elk.spacing.nodeNode": "72",
      "elk.layered.spacing.nodeNodeBetweenLayers": "110",
    },
    children: diagram.nodes.map((node) => ({ id: node.id, width: Math.max(130, node.label.length * 11 + 40), height: 64 })),
    edges: diagram.edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });
  const orderedNodes = [...(graph.children ?? [])].sort((left, right) => (left.x ?? 0) - (right.x ?? 0));
  const positions = hint === "cycle"
    ? new Map(orderedNodes.map((node, index) => { const angle = (Math.PI * 2 * index) / orderedNodes.length - Math.PI / 2; return [node.id, { x: 300 + Math.cos(angle) * 115, y: 210 + Math.sin(angle) * 75 }]; }))
    : new Map(orderedNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
  return diagram.nodes.map((node) => ({ ...node, ...positions.get(node.id) }));
}
