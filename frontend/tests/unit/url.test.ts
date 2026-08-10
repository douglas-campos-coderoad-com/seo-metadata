import { describe, expect, it } from 'vitest';
import { isValidUrl, normalizeUrl } from '@/shared/lib/url';

describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/page')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('   ')).toBe(false);
  });

  it('rejects non-http(s) protocols', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('lowercases the hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.com/Page')).toBe('https://example.com/Page');
  });

  it('trims a single trailing slash on a bare path', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('treats a trailing-slash path as equivalent to the non-trailing-slash form', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe(normalizeUrl('https://example.com/page'));
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com/');
  });
});
