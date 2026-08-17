'use client';

import { useCallback, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

const FALLBACK_FILENAME = 'seo-report.pdf';

/**
 * Pull the filename the backend chose out of Content-Disposition (FR-017).
 *
 * Prefers the RFC 5987 `filename*` form so non-Latin URLs survive. Returns the
 * fallback when the header is absent — which happens if the API forgets
 * `expose_headers: ['Content-Disposition']`, since the browser then hides it.
 */
export function filenameFromDisposition(header: string | null): string {
  if (!header) return FALLBACK_FILENAME;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      // Malformed percent-encoding: fall through to the ASCII form.
    }
  }

  const ascii = /filename="([^"]+)"/i.exec(header);
  return ascii?.[1] ?? FALLBACK_FILENAME;
}

interface UseExportReportResult {
  exportReport: (analysisId: number) => Promise<void>;
  isExporting: boolean;
  error: string | null;
}

/**
 * Download the PDF report for one analysis.
 *
 * Does not go through the shared `ApiClient`: every one of its methods ends in
 * `response.json()`, and this response is binary. A failed request must never
 * present as a completed download (FR-021), so a non-2xx is surfaced as an
 * error and no file is written.
 */
export function useExportReport(): UseExportReportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportReport = useCallback(async (analysisId: number) => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/report/${analysisId}/pdf`, {
        method: 'GET',
        headers: { Accept: 'application/pdf' },
      });

      if (!response.ok) {
        // The backend sends {"detail": "..."} for 404/409/500. Surface that
        // message rather than a generic failure.
        let detail = `Export failed (${response.status})`;
        try {
          const body = (await response.json()) as { detail?: string };
          if (body?.detail) detail = body.detail;
        } catch {
          // Non-JSON error body; keep the status-based message.
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const filename = filenameFromDisposition(response.headers.get('Content-Disposition'));

      const objectUrl = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        // Revoking immediately after click() is safe: the download has already
        // been handed to the browser, and leaking the URL leaks the whole blob.
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportReport, isExporting, error };
}
