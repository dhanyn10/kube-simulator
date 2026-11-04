import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceRangeBar } from '@/components/UI/ResourceRangeBar';
import '@testing-library/jest-dom';

describe('ResourceRangeBar', () => {
  it('renders Burstable range when request < limit', () => {
    render(
      <ResourceRangeBar
        label="CPU"
        unit="m"
        requestStr="500m"
        limitStr="1000m"
        parsedRequest={500}
        parsedLimit={1000}
        maxScale={2000}
        colorMode="dark"
        formatDisplay={(v) => `${v}m`}
      />
    );

    expect(screen.getByTestId('resource-range-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('range-status-burstable-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('range-track-reserved-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('range-track-burst-cpu')).toBeInTheDocument();
    expect(screen.getByText('Max: 2000m')).toBeInTheDocument();
  });

  it('renders Guaranteed range when request === limit', () => {
    render(
      <ResourceRangeBar
        label="Memory"
        unit="Mi"
        requestStr="512Mi"
        limitStr="512Mi"
        parsedRequest={512}
        parsedLimit={512}
        maxScale={2048}
        colorMode="light"
      />
    );

    expect(screen.getByTestId('range-status-guaranteed-memory')).toBeInTheDocument();
    expect(screen.getByText('Guaranteed (512Mi)')).toBeInTheDocument();
    expect(screen.getByTestId('range-track-reserved-memory')).toBeInTheDocument();
    expect(screen.queryByTestId('range-track-burst-memory')).not.toBeInTheDocument();
  });

  it('renders Invalid state when request > limit', () => {
    render(
      <ResourceRangeBar
        label="CPU"
        unit="m"
        requestStr="2000m"
        limitStr="500m"
        parsedRequest={2000}
        parsedLimit={500}
        maxScale={2000}
        colorMode="dark"
      />
    );

    expect(screen.getByTestId('range-status-invalid-cpu')).toBeInTheDocument();
    expect(screen.getByText('Invalid: Request > Limit')).toBeInTheDocument();
    expect(screen.getByTestId('range-track-invalid-cpu')).toBeInTheDocument();
  });

  it('handles fallback formatting when formatDisplay is omitted', () => {
    render(
      <ResourceRangeBar
        label="Memory"
        unit="Mi"
        requestStr="256Mi"
        limitStr="512Mi"
        parsedRequest={256}
        parsedLimit={512}
      />
    );

    expect(screen.getByText('Max: 2000Mi')).toBeInTheDocument();
    expect(screen.getByText(/256Mi → 512Mi \(\+256Mi burst\)/)).toBeInTheDocument();
  });

  it('dynamically expands max scale when limit or request exceeds maxScale in light mode', () => {
    const { rerender } = render(
      <ResourceRangeBar
        label="CPU"
        unit="m"
        requestStr="2500m"
        limitStr="4000m"
        parsedRequest={2500}
        parsedLimit={4000}
        maxScale={2000}
        colorMode="light"
      />
    );

    expect(screen.getByText('Max: 4000m')).toBeInTheDocument();

    // When request is huge and invalid
    rerender(
      <ResourceRangeBar
        label="CPU"
        unit="m"
        requestStr="5000m"
        limitStr="3000m"
        parsedRequest={5000}
        parsedLimit={3000}
        maxScale={2000}
        colorMode="light"
      />
    );

    expect(screen.getByText('Max: 5000m')).toBeInTheDocument();
    expect(screen.getByTestId('range-status-invalid-cpu')).toBeInTheDocument();
  });
});
