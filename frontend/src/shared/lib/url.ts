// FR-002 validation + the URL normalization that backs AnalysisTarget's global-identity
// uniqueness key (data-model.md). Callers must check isValidUrl() before normalizeUrl(),
// which assumes a parseable URL and throws otherwise.

export function isValidUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normalizes scheme/host casing and a trailing bare-path slash so equivalent URLs share one identity. */
export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  url.hostname = url.hostname.toLowerCase();

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname;

  return url.toString();
}
