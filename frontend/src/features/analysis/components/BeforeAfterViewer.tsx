'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { ScoreSummary } from './ScoreSummary';
import { FindingsList } from './FindingsList';
import { EntityGraph } from './EntityGraph';
import { AeoLiveTest } from './AeoLiveTest';
import { useOptimize, type OptimizationData, type GeoScoreData } from '../hooks/useOptimize';
import type { Finding } from '@/shared/types';

interface BeforeAfterViewerProps {
  analysisId: number;
  originalUrl: string;
  initialScore: number;
  findings: Finding[];
}

function GeoScoreBlock({ geoScore }: { geoScore: GeoScoreData | null }) {
  if (!geoScore) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">GEO Citation Score</h4>
      <div className="text-3xl font-bold text-primary">{geoScore.total_score}<span className="text-lg text-muted-foreground">/100</span></div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Fact Density</dt><dd>{geoScore.summary.fact_density ?? 0}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">AEO Structure</dt><dd>{geoScore.summary.aeo_structure ?? 0}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Entity Coverage</dt><dd>{geoScore.summary.entity_coverage ?? 0}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">JSON-LD Validity</dt><dd>{geoScore.summary.json_ld_validity ?? 0}</dd></div>
      </dl>
    </div>
  );
}

function AfterBlock({ optimization }: { optimization: OptimizationData | null }) {
  if (!optimization) return null;
  const content = optimization.optimized_content || {};
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Optimized Content</h4>
        {content.optimized_title && <p className="font-medium">{content.optimized_title}</p>}
        {content.optimized_meta_description && <p className="mt-1 text-sm text-muted-foreground">{content.optimized_meta_description}</p>}
        {content.geo_content ? (
          <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-sm">
            {content.geo_content}
          </div>
        ) : content.optimized_title ? null : (
          <p className="text-sm text-muted-foreground">No optimized content available.</p>
        )}
      </div>

      {content.qa_pairs && content.qa_pairs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Q&A (AEO)</h4>
          <div className="space-y-2">
            {content.qa_pairs.map((qa, i) => (
              <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">Q: {qa.question}</p>
                <p className="mt-1 text-muted-foreground">A: {qa.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {optimization.score_after_estimated && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Estimated Scores After</h4>
          <div className="flex gap-4 text-sm">
            <span>SEO: <b>{optimization.score_after_estimated.seo}</b></span>
            <span>GEO: <b>{optimization.score_after_estimated.geo}</b></span>
            <span>Overall: <b>{optimization.score_after_estimated.overall}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

export function BeforeAfterViewer({ analysisId, originalUrl, initialScore, findings }: BeforeAfterViewerProps) {
  const { optimization, geoScore, isLoading, error, run } = useOptimize();
  const [optimized, setOptimized] = useState(false);

  const handleOptimize = async () => {
    await run(analysisId);
    setOptimized(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* BEFORE */}
        <section className="rounded-2xl border border-border bg-muted/20 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Before</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Original</span>
          </div>
          <ScoreSummary score={initialScore} />
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Current GEO/AEO metrics: low visibility, unstructured content, no knowledge graph.</p>
          </div>
          <FindingsList findings={findings} />
        </section>

        {/* AFTER */}
        <section className="rounded-2xl border border-primary/30 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">After</h2>
            {optimized ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Optimized</span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Pending</span>
            )}
          </div>

          {!optimized ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-center text-sm text-muted-foreground">
                Optimize this page for GEO/AEO: high fact-density content, entity knowledge graph, and Q&A structure.
              </p>
              <Button onClick={handleOptimize} disabled={isLoading}>
                {isLoading ? <><Spinner /> Optimizing...</> : 'Run GEO/AEO Optimizer'}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <AfterBlock optimization={optimization} />
              <EntityGraph optimization={optimization} />
              <GeoScoreBlock geoScore={geoScore} />
              {optimization?.changes && optimization.changes.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h4 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Changes Applied ({optimization.changes.length})</h4>
                  <ul className="space-y-1 text-sm">
                    {optimization.changes.map((change, i) => (
                      <li key={i}>
                        <b>{String(change.element ?? `Change ${i + 1}`)}</b> — <span className="text-muted-foreground">{String(change.action ?? '')}: {String(change.reason ?? '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button variant="outline" onClick={handleOptimize} disabled={isLoading}>
                {isLoading ? <><Spinner /> Re-optimizing...</> : 'Re-run Optimizer'}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Star component: AEO Live Test (AI recommendation simulator) */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-bold">AEO Live Test — AI Recommendation Simulator</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Ask an AI assistant the same question before and after optimization to see whether it recommends your product and cites your source.
        </p>
        <AeoLiveTest analysisId={analysisId} />
      </section>
    </div>
  );
}
