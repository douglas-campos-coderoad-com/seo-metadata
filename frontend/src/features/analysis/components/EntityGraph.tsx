'use client';

import { useRef, useState, useMemo, useCallback, useEffect, type RefObject } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

const PALETTE = ['#1F44E0', '#0FA3A3', '#7A5AF8', '#C0700C', '#D4537E', '#2E8B3D', '#D85A30', '#0E7CC4'];

interface GraphNode {
  id: string;
  kind: 'entity' | 'literal';
  type?: string;
  color?: string;
  name?: string | null;
  value?: string;
  hasId?: boolean;
  x?: number;
  y?: number;
  __w?: number;
  __h?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export function buildGraph(root: unknown): { nodes: GraphNode[]; links: GraphLink[]; typeColors: Map<string, string> } {
  const nodes: GraphNode[] = [], links: GraphLink[] = [], idMap = new Map<string, GraphNode>();
  let counter = 0;
  const typeColors = new Map<string, string>();
  const colorFor = (t: string) => {
    if (!typeColors.has(t)) typeColors.set(t, PALETTE[typeColors.size % PALETTE.length]);
    return typeColors.get(t)!;
  };
  const typeOf = (o: Record<string, unknown>) => { let t = o['@type']; if (Array.isArray(t)) t = t[0]; return (t as string) || 'Thing'; };

  function addEntity(obj: Record<string, unknown>): GraphNode {
    const id = (obj['@id'] as string) || '_n' + counter++;
    if (idMap.has(id)) return idMap.get(id)!;
    const type = typeOf(obj);
    const node: GraphNode = {
      id,
      kind: 'entity',
      type,
      color: colorFor(type),
      name: (obj.name || obj.headline || obj.title || null) as string | null,
      hasId: !!obj['@id'],
    };
    idMap.set(id, node); nodes.push(node);
    for (const [k, v] of Object.entries(obj)) {
      if (k === '@type' || k === '@context' || k === '@id') continue;
      walk(node, k, v);
    }
    return node;
  }
  function walk(parent: GraphNode, key: string, val: unknown): void {
    if (Array.isArray(val)) { val.forEach((v) => walk(parent, key, v)); return; }
    if (val && typeof val === 'object') {
      const child = addEntity(val as Record<string, unknown>);
      links.push({ source: parent.id, target: child.id, label: key });
    } else {
      const lit: GraphNode = { id: '_lit' + counter++, kind: 'literal', value: String(val) };
      nodes.push(lit);
      links.push({ source: parent.id, target: lit.id, label: key });
    }
  }
  let items: unknown[];
  if (Array.isArray(root)) items = root;
  else if (root && typeof root === 'object' && (root as Record<string, unknown>)['@graph']) items = (root as Record<string, unknown>)['@graph'] as unknown[];
  else items = [root];
  items.forEach((it) => { if (it && typeof it === 'object') addEntity(it as Record<string, unknown>); });
  return { nodes, links, typeColors };
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// force-graph's hover tooltip renders this via innerHTML, so escape untrusted JSON-LD content.
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* small hook: track a container's width so ForceGraph2D can size itself */
function useWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(680);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface EntityGraphProps {
  jsonld: unknown;
  showLabels?: boolean;
  height?: number;
  onStats?: (stats: { entities: number; literals: number; edges: number }) => void;
}

/* ============================================================================
   EntityGraph — reusable component, backed by react-force-graph-2d.
   Nodes are painted as chips on canvas via nodeCanvasObject.
   ============================================================================ */
export function EntityGraph({ jsonld, showLabels = true, height = 560, onStats }: EntityGraphProps) {
  const fgRef = useRef<ForceGraphMethods>();
  const [wrapRef, width] = useWidth();
  const [hoverId, setHoverId] = useState<string | null>(null);

  // buildGraph -> graphData. Deep-map so react-force-graph can mutate freely
  // without corrupting our source, and so positions only reset when jsonld changes.
  const { data, typeColors } = useMemo(() => {
    const g = buildGraph(jsonld);
    onStats?.({
      entities: g.nodes.filter((n) => n.kind === 'entity').length,
      literals: g.nodes.filter((n) => n.kind === 'literal').length,
      edges: g.links.length,
    });
    return {
      data: { nodes: g.nodes.map((n) => ({ ...n })), links: g.links.map((l) => ({ ...l })) },
      typeColors: g.typeColors,
    };
  }, [jsonld, onStats]);

  // adjacency for click-to-isolate
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    data.links.forEach((l: any) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      (m.get(s) || m.set(s, new Set()).get(s)!).add(t);
      (m.get(t) || m.set(t, new Set()).get(t)!).add(s);
    });
    return m;
  }, [data]);

  const [focus, setFocus] = useState<string | null>(null); // isolated node id
  const active = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    (neighbors.get(focus) || new Set<string>()).forEach((n) => s.add(n));
    return s;
  }, [focus, neighbors]);

  // ---- node chip painter ----
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const fs = 12 / scale;
    const isLit = node.kind === 'literal';
    const main = isLit ? trunc(node.value, 26) : node.type;
    const sub = !isLit && node.name ? trunc(node.name, 24) : null;

    ctx.font = `${isLit ? '' : '600 '}${fs}px Inter, sans-serif`;
    const mainW = ctx.measureText(main).width;
    let subW = 0;
    if (sub) { ctx.font = `${fs * 0.85}px Inter, sans-serif`; subW = ctx.measureText(sub).width; }
    const w = Math.max(mainW, subW) + fs * 1.6;
    const h = sub ? fs * 2.5 : fs * 1.8;
    node.__w = w; node.__h = h;

    const dim = active && !active.has(node.id);
    ctx.globalAlpha = dim ? 0.16 : 1;

    const x = node.x - w / 2, y = node.y - h / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, isLit ? h / 2 : fs * 0.5);
    ctx.fillStyle = isLit ? '#FFFFFF' : node.color + '14';
    ctx.fill();
    ctx.lineWidth = (isLit ? 1 : 1.4) / scale;
    ctx.strokeStyle = isLit ? '#E1E4DE' : node.color;
    if (node.id === hoverId) { ctx.strokeStyle = node.color; ctx.lineWidth = 2.2 / scale; }
    ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (sub) {
      ctx.font = `600 ${fs}px Inter, sans-serif`;
      ctx.fillStyle = node.color;
      ctx.fillText(main, node.x, node.y - fs * 0.5);
      ctx.font = `${fs * 0.85}px Inter, sans-serif`;
      ctx.fillStyle = '#15181C';
      ctx.fillText(sub, node.x, node.y + fs * 0.6);
    } else {
      ctx.font = `${isLit ? '' : '600 '}${fs}px Inter, sans-serif`;
      ctx.fillStyle = isLit ? '#6A7079' : node.color;
      ctx.fillText(main, node.x, node.y);
    }
    ctx.globalAlpha = 1;
  }, [active, hoverId]);

  // hover tooltip text — literal chips only carry `.value`, entities carry `.name` (nullable), so a
  // custom accessor is needed: the default nodeLabel="name" leaves literals and unnamed entities blank.
  const nodeLabel = useCallback((node: any) => {
    const text = node.kind === 'literal' ? node.value : node.name || node.type;
    return text ? escapeHtml(String(text)) : '';
  }, []);

  // hit area matches the chip rect
  const paintPointer = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const w = node.__w || 12, h = node.__h || 12;
    ctx.fillStyle = color;
    ctx.fillRect(node.x - w / 2, node.y - h / 2, w, h);
  }, []);

  // link line + arrowhead, trimmed to each chip's border (not center), plus the property label.
  // Nodes are custom rounded-rect/pill chips of variable size (node.__w/__h, set by paintNode), so
  // the library's own circular-node arrow placement doesn't line up with our chip edges — draw both ourselves.
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const s = link.source, t = link.target;
    if (!s || !t || typeof s !== 'object' || typeof t !== 'object') return;

    const dx = t.x - s.x, dy = t.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;

    // distance from each node's center to where the line exits its chip's bounding box
    const sHalfW = (s.__w || 12) / 2, sHalfH = (s.__h || 12) / 2;
    const tHalfW = (t.__w || 12) / 2, tHalfH = (t.__h || 12) / 2;
    const sTrim = Math.min(sHalfW / (Math.abs(ux) || 1e-6), sHalfH / (Math.abs(uy) || 1e-6));
    const tTrim = Math.min(tHalfW / (Math.abs(ux) || 1e-6), tHalfH / (Math.abs(uy) || 1e-6));

    const x1 = s.x + ux * sTrim, y1 = s.y + uy * sTrim;
    const x2 = t.x - ux * tTrim, y2 = t.y - uy * tTrim;

    const isFocused = active ? (s.id === focus || t.id === focus) : false;
    const color = !active ? '#C3C8CF' : isFocused ? '#1F44E0' : 'rgba(195,200,207,0.22)';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = (isFocused ? 1.8 : 1.3) / scale;
    ctx.stroke();

    // arrowhead, anchored at the trimmed border point (x2, y2) so its tip lands exactly on the chip edge
    const arrowLen = 5 / scale, arrowHalfW = 3 / scale;
    const backX = x2 - ux * arrowLen, backY = y2 - uy * arrowLen;
    const perpX = -uy, perpY = ux;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(backX + perpX * arrowHalfW, backY + perpY * arrowHalfW);
    ctx.lineTo(backX - perpX * arrowHalfW, backY - perpY * arrowHalfW);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (showLabels) {
      const fs = 9.5 / scale;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.font = `${fs}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 / scale; ctx.strokeStyle = '#F7F8F5';
      ctx.strokeText(link.label, mx, my);
      ctx.fillStyle = '#6A7079';
      ctx.fillText(link.label, mx, my);
    }
  }, [showLabels, active, focus]);

  const handleCenter = useCallback(() => {
    fgRef.current?.zoomToFit(400, 40);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', height, background: '#F7F8F5', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data as any}
        width={width}
        height={height}
        backgroundColor="#F7F8F5"
        nodeLabel={nodeLabel}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        onNodeHover={(n: any) => setHoverId(n ? n.id : null)}
        onNodeClick={(n: any) => setFocus((f) => (f === n.id ? null : n.id))}
        onBackgroundClick={() => setFocus(null)}
        cooldownTicks={120}
        d3VelocityDecay={0.28}
      />
      {/* center view */}
      <button
        type="button"
        onClick={handleCenter}
        title="Center view"
        aria-label="Center view"
        style={{
          position: 'absolute', right: 14, bottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, padding: 0,
          background: 'rgba(255,255,255,.9)', border: '1px solid #EBEDE8', borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15181C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1" fill="#15181C" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      {/* legend */}
      <div style={{ position: 'absolute', right: 14, top: 12, background: 'rgba(255,255,255,.9)', border: '1px solid #EBEDE8', borderRadius: 8, padding: '8px 10px', maxWidth: 180 }}>
        {[...typeColors.entries()].map(([t, c]) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '3px 0' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#15181C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '3px 0' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fff', border: '1px solid #E1E4DE' }} />
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#15181C' }}>literal value</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 14, bottom: 12, fontSize: 12, color: '#9AA0A6', pointerEvents: 'none' }}>
        Drag nodes &middot; Scroll to zoom &middot; Click a node to isolate
      </div>
    </div>
  );
}
