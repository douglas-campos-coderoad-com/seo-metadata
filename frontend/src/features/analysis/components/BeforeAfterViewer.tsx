'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { ScoreSummary } from './ScoreSummary';
import { FindingsList } from './FindingsList';
import { EntityGraphBlock } from './EntityGraphBlock';
import { CopyPasteReadyPanel } from './CopyPasteReadyPanel';
import { AeoLiveTest } from './AeoLiveTest';
import { RoiProjectionPanel } from './RoiProjectionPanel';
import { useOptimize, type OptimizationData, type GeoScoreData } from '../hooks/useOptimize';
import type { Finding } from '@/shared/types';

interface BeforeAfterViewerProps {
  analysisId: number;
  originalUrl: string;
  initialScore: number;
  initialSeoScore: number | null;
  initialGeoScore: number | null;
  findings: Finding[];
  /** Pre-loaded "after" data (specs/009-project-analysis-ux, historical views) — when
   * both this and `preloadedAfterGeoScore` are provided, the After panel renders them
   * immediately with no "click to optimize" prompt and no POST. Omitted at the existing
   * live-run call site, which is byte-for-byte unchanged. */
  preloadedOptimization?: OptimizationData | null;
  preloadedAfterGeoScore?: GeoScoreData | null;
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

function DownloadHtmlButton({ html, filename }: { html: string; filename: string }) {
  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" onClick={handleDownload} disabled={!html}>
      Download Optimized HTML
    </Button>
  );
}

function AfterBlock({ optimization }: { optimization: OptimizationData | null }) {
  if (!optimization) return null;
  const content = optimization.optimized_content || {};
  return (
    <div className="space-y-6">
      {optimization.score_after_estimated && (
          <ScoreSummary
            scores={{
              overall: optimization.score_after_estimated.overall ?? 0,
              seo: optimization.score_after_estimated.seo ?? null,
              geo: optimization.score_after_estimated.geo ?? null,
            }}
          />
      )}

      <RoiProjectionPanel optimization={optimization} />

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
    </div>
  );
}

export function BeforeAfterViewer({
  analysisId,
  originalUrl,
  initialScore,
  initialSeoScore,
  initialGeoScore,
  findings,
  preloadedOptimization = null,
  preloadedAfterGeoScore = null,
}: BeforeAfterViewerProps) {
  const { optimization: runOptimization, geoScore: runGeoScore, isLoading, error, run } = useOptimize();
  const optimization = runOptimization ?? preloadedOptimization;
  const geoScore = runGeoScore ?? preloadedAfterGeoScore;
  const [optimized, setOptimized] = useState(Boolean(preloadedOptimization));

  const handleOptimize = async () => {
    await run(analysisId);
    setOptimized(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* BEFORE */}
        <section className="rounded-2xl border border-border bg-white p-6 space-y-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Before</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Original</span>
          </div>
          <ScoreSummary scores={{ overall: initialScore, seo: initialSeoScore, geo: initialGeoScore }} />
          <FindingsList findings={findings} />
        </section>

        {/* AFTER */}
        <section className="rounded-2xl border-2 border-primary/40 bg-card p-6">
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
              <EntityGraphBlock jsonld={optimization?.optimized_json_ld ?? null} />
              <GeoScoreBlock geoScore={geoScore} />
              <CopyPasteReadyPanel copyPasteReady={optimization?.copy_paste_ready ?? null} />
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
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleOptimize} disabled={isLoading}>
                  {isLoading ? <><Spinner /> Re-optimizing...</> : 'Re-run Optimizer'}
                </Button>
                <DownloadHtmlButton
                  html={optimization?.optimized_html ?? ''}
                  filename={`optimized-${analysisId}.html`}
                />
              </div>
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
