import { describe, expect, it } from 'vitest';
import { highestSeverity, scoreToSeverity, severityLabel, SEVERITY_CLASSES } from '@/shared/lib/severity';

describe('scoreToSeverity', () => {
  it('classifies 80 and above as good', () => {
    expect(scoreToSeverity(80)).toBe('good');
    expect(scoreToSeverity(100)).toBe('good');
  });

  it('classifies 60-79 as warning', () => {
    expect(scoreToSeverity(60)).toBe('warning');
    expect(scoreToSeverity(79)).toBe('warning');
  });

  it('classifies 40-59 as medium', () => {
    expect(scoreToSeverity(40)).toBe('medium');
    expect(scoreToSeverity(59)).toBe('medium');
  });

  it('classifies below 40 as critical', () => {
    expect(scoreToSeverity(39)).toBe('critical');
    expect(scoreToSeverity(0)).toBe('critical');
  });
});

describe('highestSeverity', () => {
  it('returns critical when any severity is critical', () => {
    expect(highestSeverity(['good', 'warning', 'critical'])).toBe('critical');
  });

  it('returns warning when the worst present is warning', () => {
    expect(highestSeverity(['good', 'warning'])).toBe('warning');
  });

  it('returns good when everything is good', () => {
    expect(highestSeverity(['good', 'good'])).toBe('good');
  });

  it('defaults to good for an empty list', () => {
    expect(highestSeverity([])).toBe('good');
  });
});

describe('severity presentation', () => {
  it('has a label and a Badge variant for every severity', () => {
    const expectedBadgeVariant = { good: 'success', warning: 'warning', critical: 'destructive' } as const;
    for (const severity of ['good', 'warning', 'critical'] as const) {
      expect(severityLabel(severity)).toBeTruthy();
      expect(SEVERITY_CLASSES[severity].badge).toBe(expectedBadgeVariant[severity]);
    }
  });
});
