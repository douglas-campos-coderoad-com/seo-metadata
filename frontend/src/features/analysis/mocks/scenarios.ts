import { ALL_FINDING_TEMPLATES, type FindingTemplate } from './findings';

export type RunOutcome =
  | {
      status: 'complete';
      score: number;
      findingTemplates: FindingTemplate[];
      httpStatus: number;
      contentType: string;
      contentSizeBytes: number;
    }
  | { status: 'failed'; failureReason: string; httpStatus: number | null; contentType: string | null };

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic per submitted URL (contracts/analysis-service.md) — same URL always yields the same outcome. */
export function buildRunOutcome(url: string): RunOutcome {
  const lower = url.toLowerCase();

  if (lower.includes('unreachable')) {
    return {
      status: 'failed',
      failureReason: 'This page could not be reached (connection timed out).',
      httpStatus: null,
      contentType: null,
    };
  }
  if (lower.includes('notfound') || lower.includes('404')) {
    return {
      status: 'failed',
      failureReason: 'The page returned a 404 Not Found response.',
      httpStatus: 404,
      contentType: 'text/html',
    };
  }
  if (lower.endsWith('.pdf') || lower.includes('unsupported')) {
    return {
      status: 'failed',
      failureReason: 'The URL returned non-HTML content (application/pdf) and cannot be analyzed.',
      httpStatus: 200,
      contentType: 'application/pdf',
    };
  }

  const hash = hashString(lower);
  const templateCount = 4 + (hash % 5); // 4-8 findings
  const findingTemplates: FindingTemplate[] = [];
  for (let i = 0; i < templateCount; i += 1) {
    findingTemplates.push(ALL_FINDING_TEMPLATES[(hash + i * 7) % ALL_FINDING_TEMPLATES.length]);
  }

  const penalty = findingTemplates.reduce((total, template) => {
    if (template.severity === 'critical') return total + 12;
    if (template.severity === 'warning') return total + 5;
    return total;
  }, 0);
  const score = Math.max(5, Math.min(100, 96 - penalty));

  return {
    status: 'complete',
    score,
    findingTemplates,
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    contentSizeBytes: 30_000 + (hash % 200_000),
  };
}
