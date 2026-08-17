import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportReportButton } from '@/features/analysis/components/ExportReportButton';
import { filenameFromDisposition } from '@/features/analysis/hooks/useExportReport';

function pdfResponse(disposition?: string) {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], {
      type: 'application/pdf',
    }),
    headers: { get: (name: string) => (name === 'Content-Disposition' ? disposition ?? null : null) },
  } as unknown as Response;
}

function errorResponse(status: number, detail: string) {
  return {
    ok: false,
    status,
    json: async () => ({ detail }),
    headers: { get: () => null },
  } as unknown as Response;
}

describe('ExportReportButton', () => {
  // Count synthetic anchor clicks; jsdom would otherwise attempt navigation.
  let downloadClicks = 0;
  const originalClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    downloadClicks = 0;
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = () => {
      downloadClicks += 1;
    };
  });

  afterEach(() => {
    HTMLAnchorElement.prototype.click = originalClick;
    vi.restoreAllMocks();
  });

  it('downloads the PDF using the filename the backend chose', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(pdfResponse('attachment; filename="seo-report_example-com_2026-08-16.pdf"'));
    vi.stubGlobal('fetch', fetchMock);

    render(<ExportReportButton analysisId={7} />);
    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => expect(downloadClicks).toBe(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/report/7/pdf'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('surfaces the backend detail message and downloads nothing on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        errorResponse(409, "Analysis 7 is not exportable: status is 'failed'."),
      ),
    );

    render(<ExportReportButton analysisId={7} />);
    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not exportable');
    // FR-021: a failed request must never present as a completed download.
    expect(downloadClicks).toBe(0);
  });

  it('disables the button while exporting so a double-click cannot queue two renders', async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
        release = resolve;
      })),
    );

    render(<ExportReportButton analysisId={7} />);
    const button = screen.getByRole('button', { name: /export pdf/i });
    await userEvent.click(button);

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');

    release(pdfResponse());
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled());
  });
});

describe('filenameFromDisposition', () => {
  it('prefers the RFC 5987 form so non-Latin names survive', () => {
    const header = "attachment; filename=\"report.pdf\"; filename*=UTF-8''seo-report_%E4%BE%8B.pdf";
    expect(filenameFromDisposition(header)).toBe('seo-report_例.pdf');
  });

  it('falls back to the ASCII form', () => {
    expect(filenameFromDisposition('attachment; filename="a.pdf"')).toBe('a.pdf');
  });

  it('falls back to a generic name when the header is hidden by CORS', () => {
    expect(filenameFromDisposition(null)).toBe('seo-report.pdf');
  });
});
