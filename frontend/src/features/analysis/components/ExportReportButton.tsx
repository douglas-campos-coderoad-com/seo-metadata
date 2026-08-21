'use client';

import { Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { Alert } from '@/shared/components/ui/alert';
import { useExportReport } from '@/features/analysis/hooks/useExportReport';

interface ExportReportButtonProps {
  /** Backend analysis id. The export keys off this, not the ingested-url id. */
  analysisId: number;
  /** `sm` lets it sit inline with the other per-analysis actions in a history card. */
  size?: 'sm' | 'md';
  /** Shortened to just "PDF" where the surrounding row already says "report". */
  label?: string;
}

/**
 * Export the current analysis as a PDF (SC-001: one action, no configuration).
 *
 * The button is disabled while a render is in flight, which both communicates
 * progress (SC-004) and stops a double-click from queueing a second expensive
 * render for the same analysis.
 */
export function ExportReportButton({
  analysisId,
  size = 'md',
  label = 'Export PDF Report',
}: ExportReportButtonProps) {
  const { exportReport, isExporting, error } = useExportReport();
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => void exportReport(analysisId)}
        disabled={isExporting}
        aria-busy={isExporting}
      >
        {isExporting ? <Spinner className={iconClass} /> : <Download className={iconClass} aria-hidden="true" />}
        {isExporting ? 'Preparing PDF…' : label}
      </Button>

      {/* Announced to assistive tech without stealing focus (WCAG 2.2 AA). */}
      <span aria-live="polite" className="sr-only">
        {isExporting ? 'Preparing your PDF report.' : ''}
      </span>

      {error && (
        <Alert variant="destructive" role="alert">
          {error}
        </Alert>
      )}
    </div>
  );
}
