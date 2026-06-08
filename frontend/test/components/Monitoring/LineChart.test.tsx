import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChart } from '@/components/Monitoring/LineChart';
import '@testing-library/jest-dom';

describe('LineChart', () => {
  const data = [10, 20, 30, 40, 50];

  it('renders correctly with default props', () => {
    render(<LineChart data={data} color="blue" label="CPU Usage" />);
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders formatted values if valueFormatter is provided', () => {
    const formatter = (v: number) => `${v}m`;
    render(
      <LineChart
        data={data}
        color="blue"
        label="CPU Usage"
        valueFormatter={formatter}
        limitValue={100}
      />
    );
    expect(screen.getByText('50m / 100m')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    render(<LineChart data={[]} color="blue" label="CPU Usage" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('handles isPercent=false with limitValue', () => {
    render(
      <LineChart
        data={[500]}
        color="purple"
        label="Memory"
        isPercent={false}
        limitValue={1000}
      />
    );
    // last data point is 500, which is 50% of 1000.
    // However, the text display shows Math.round(data.at(-1))% regardless of isPercent for the label on the right
    expect(screen.getByText('500%')).toBeInTheDocument();
  });

  it('applies correct stroke color based on color prop', () => {
    const { container } = render(<LineChart data={data} color="blue" label="CPU" />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toHaveAttribute('stroke', '#3b82f6');

    const { container: purpleContainer } = render(<LineChart data={data} color="purple" label="CPU" />);
    const purplePolyline = purpleContainer.querySelector('polyline');
    expect(purplePolyline).toHaveAttribute('stroke', '#a855f7');
  });
});
