import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoiProjectionPanel } from '@/features/analysis/components/RoiProjectionPanel';
import type { OptimizationData } from '@/features/analysis/hooks/useOptimize';

const DEFAULT_METRICS = {
  monthly_organic_traffic: 10000,
  generative_search_share: 0.2,
  conversion_rate: 0.015,
  avg_order_value: 150.0,
  cost_per_product: 1.0,
};

function optimization(
  overrides: Partial<OptimizationData> = {},
): OptimizationData {
  return {
    id: 1,
    analysis_id: 7,
    optimized_html: null,
    optimized_json_ld: null,
    optimized_content: null,
    changes: null,
    copy_paste_ready: null,
    score_before: { seo: 45, geo: 30, overall: 37 },
    score_after_estimated: { seo: 92, geo: 85, overall: 89 },
    roi_projection: {
      metrics_used: DEFAULT_METRICS,
      incremental_traffic_monthly: {
        seo_traditional: 3760,
        geo_ai: 1100,
        total: 4860,
      },
      financial_impact_annual: {
        incremental_revenue: 131220.0,
        optimization_cost: 1.0,
        net_profit: 131219.0,
        roi_percentage: 13121900.0,
      },
    },
    status: 'completed',
    error: null,
    ...overrides,
  };
}

describe('RoiProjectionPanel', () => {
  it('falls back to a computed projection when the optimization has no server roi_projection', () => {
    render(
      <RoiProjectionPanel
        optimization={optimization({ roi_projection: null })}
      />,
    );

    expect(screen.getByText('ROI Projection')).toBeInTheDocument();
  });

  it('renders nothing when the optimization has no scores at all', () => {
    const { container } = render(
      <RoiProjectionPanel
        optimization={optimization({
          roi_projection: null,
          score_before: null,
          score_after_estimated: null,
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the projected ROI, payback narrative and traffic split', () => {
    render(<RoiProjectionPanel optimization={optimization()} />);

    expect(screen.getByText('ROI Projection')).toBeInTheDocument();
    expect(screen.getByText('Positive ROI')).toBeInTheDocument();
    expect(screen.getAllByText('+13.1M%').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/pays for itself within the first month/),
    ).toBeInTheDocument();

    expect(screen.getByText('Traditional SEO — 3,760/mo')).toBeInTheDocument();
    expect(screen.getByText('AI / GEO — 1,100/mo')).toBeInTheDocument();
  });

  it('recalculates the projection live when assumptions change', async () => {
    const user = userEvent.setup();
    render(<RoiProjectionPanel optimization={optimization()} />);

    // Doubling the conversion rate doubles the projected revenue and ROI.
    const conversionInput = screen.getByLabelText(/Conversion rate/);
    await user.clear(conversionInput);
    await user.type(conversionInput, '0.03');

    expect((await screen.findAllByText('+26.2M%')).length).toBeGreaterThan(0);
    expect(screen.getByText('$262,440/yr')).toBeInTheDocument();
  });

  it('resets assumptions back to the server-provided defaults', async () => {
    const user = userEvent.setup();
    render(<RoiProjectionPanel optimization={optimization()} />);

    const conversionInput = screen.getByLabelText(/Conversion rate/);
    await user.clear(conversionInput);
    await user.type(conversionInput, '0.03');
    expect((await screen.findAllByText('+26.2M%')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(screen.getAllByText('+13.1M%').length).toBeGreaterThan(0);
  });
});
