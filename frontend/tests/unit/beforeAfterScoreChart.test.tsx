import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BeforeAfterScoreChart, type ScoreSet } from '@/features/analysis/components/BeforeAfterScoreChart';

const BEFORE: ScoreSet = { overall: 46, seo: 53, geo: 40 };
const AFTER: ScoreSet = { overall: 90, seo: 92, geo: 88 };
const NOT_OPTIMIZED: ScoreSet = { overall: null, seo: null, geo: null };

describe('BeforeAfterScoreChart', () => {
  it('shows both columns, each labelled', () => {
    render(<BeforeAfterScoreChart before={BEFORE} after={AFTER} />);

    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('prints every score as text, so no value is carried by the ring alone', () => {
    render(<BeforeAfterScoreChart before={BEFORE} after={AFTER} />);

    for (const value of [46, 53, 40, 90, 92, 88]) {
      expect(screen.getByText(String(value))).toBeInTheDocument();
    }
  });

  it('exposes each meter to assistive tech with its value out of 100', () => {
    render(<BeforeAfterScoreChart before={BEFORE} after={AFTER} />);

    expect(screen.getByLabelText('Before overall score 46 out of 100')).toBeInTheDocument();
    expect(screen.getByLabelText('After overall score 90 out of 100')).toBeInTheDocument();
  });

  it('states the change on the after column for every metric', () => {
    render(<BeforeAfterScoreChart before={BEFORE} after={AFTER} />);

    expect(screen.getByText('+44')).toBeInTheDocument();
    expect(screen.getByText('+39')).toBeInTheDocument();
    expect(screen.getByText('+48')).toBeInTheDocument();
  });

  it('invents no deltas when nothing is optimized yet', () => {
    render(<BeforeAfterScoreChart before={BEFORE} after={NOT_OPTIMIZED} />);

    // Before scores stay readable.
    expect(screen.getByText('46')).toBeInTheDocument();
    expect(screen.getByText('53')).toBeInTheDocument();

    expect(screen.queryByText(/^[+-]\d+$/)).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByLabelText('After overall score not available')).toBeInTheDocument();
  });

  it('fills each ring in proportion to its score', () => {
    const { container } = render(<BeforeAfterScoreChart before={BEFORE} after={AFTER} />);

    // r = (84 - 9) / 2 = 37.5, so the full sweep is 2*pi*37.5.
    const circumference = 2 * Math.PI * 37.5;
    // Only the value arcs carry a dash offset; the tracks are undashed full circles.
    const arcs = [...container.querySelectorAll('circle[stroke-dasharray]')];

    expect(arcs).toHaveLength(2);
    expect(Number(arcs[0].getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * (1 - 0.46), 3);
    expect(Number(arcs[1].getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * (1 - 0.9), 3);
  });

  it('draws no value arc at all when there is no score', () => {
    const { container } = render(<BeforeAfterScoreChart before={BEFORE} after={NOT_OPTIMIZED} />);

    // The before column still draws one; the after column draws none.
    expect(container.querySelectorAll('circle[stroke-dasharray]')).toHaveLength(1);
  });

  it('marks a regression with a negative delta rather than hiding it', () => {
    render(
      <BeforeAfterScoreChart before={{ overall: 80, seo: 80, geo: 80 }} after={{ overall: 62, seo: 70, geo: 75 }} />,
    );

    expect(screen.getByText('-18')).toBeInTheDocument();
    expect(screen.getByText('-10')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
  });
});
