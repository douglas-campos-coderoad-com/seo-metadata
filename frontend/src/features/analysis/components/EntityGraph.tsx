'use client';

import type { OptimizationData } from '../hooks/useOptimize';

/** Extract entities + relationships from the optimization JSON-LD. */
function extractGraph(jsonLd: Record<string, unknown> | null | undefined): {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
} {
  const nodes: Array<{ id: string; label: string; type: string }> = [];
  const edges: Array<{ from: string; to: string; label: string }> = [];

  if (!jsonLd) return { nodes, edges };

  const graph = Array.isArray(jsonLd['@graph']) ? (jsonLd['@graph'] as Array<Record<string, unknown>>) : [jsonLd];
  const idByKey: Record<string, string> = {};

  graph.forEach((entity, index) => {
    const type = Array.isArray(entity['@type']) ? (entity['@type'] as string[])[0] : (entity['@type'] as string) || 'Entity';
    const name = (entity['name'] as string) || (entity['headline'] as string) || `${type} ${index + 1}`;
    const id = `node-${index}`;
    idByKey[`@id:${index}`] = id;
    nodes.push({ id, label: name, type });
  });

  // Build edges for the primary entity's object properties (creator, brand, offers, etc.)
  if (graph.length > 0) {
    const main = graph[0];
    const mainId = 'node-0';
    const relationFields: Record<string, string> = {
      creator: 'created by',
      manufacturer: 'manufactured by',
      brand: 'brand',
      offers: 'offered at',
      material: 'material',
      dimensions: 'dimensions',
    };
    Object.entries(relationFields).forEach(([field, label]) => {
      const value = main[field];
      if (!value) return;
      const targetLabel =
        typeof value === 'object' && value !== null
          ? ((value as Record<string, unknown>)['name'] as string) || field
          : String(value);
      edges.push({ from: mainId, to: `${mainId}-${field}`, label });
      nodes.push({ id: `${mainId}-${field}`, label: targetLabel, type: field });
    });
  }

  return { nodes, edges };
}

export function EntityGraph({ optimization }: { optimization: OptimizationData | null }) {
  const { nodes, edges } = extractGraph(optimization?.optimized_json_ld);

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No entity graph available. Run the optimizer to generate a Knowledge Graph.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Knowledge Graph (Entities)</h3>

      {/* Central node */}
      <div className="mb-4 flex justify-center">
        <div className="rounded-full border-2 border-primary px-6 py-3 text-center">
          <div className="text-sm font-semibold">{nodes[0].label}</div>
          <div className="text-xs text-muted-foreground">{nodes[0].type}</div>
        </div>
      </div>

      {/* Related entity nodes */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.slice(1).map((node) => (
          <div key={node.id} className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground uppercase">{node.type}</div>
            <div className="truncate text-sm font-medium">{node.label}</div>
          </div>
        ))}
      </div>

      {/* Edges summary */}
      {edges.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Relationships</div>
          <ul className="space-y-1">
            {edges.map((edge, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{edge.from === 'node-0' ? nodes[0].label : edge.from}</span>
                <span className="text-muted-foreground">— {edge.label} →</span>
                <span className="truncate">{edge.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}