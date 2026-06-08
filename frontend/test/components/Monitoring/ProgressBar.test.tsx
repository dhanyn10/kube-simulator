import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '@/components/Monitoring/ProgressBar';
import '@testing-library/jest-dom';

describe('ProgressBar', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<ProgressBar value={50} />);
    const bar = container.querySelector('.bg-blue-500');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveStyle({ width: '50%' });
  });

  it('renders labels correctly', () => {
    render(<ProgressBar value={75} label="CPU" subLabel="75%" />);
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('handles max value correctly', () => {
    const { container } = render(<ProgressBar value={200} max={100} />);
    const bar = container.querySelector('.bg-blue-500');
    expect(bar).toHaveStyle({ width: '100%' });
  });

  it('applies custom color and height', () => {
    const { container } = render(
      <ProgressBar value={30} color="bg-red-500" height="h-4" />
    );
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
    expect(container.querySelector('.h-4')).toBeInTheDocument();
  });

  it('applies light mode background', () => {
    const { container } = render(<ProgressBar value={50} colorMode="light" />);
    expect(container.querySelector('.bg-slate-100')).toBeInTheDocument();
  });

  it('applies dark mode background', () => {
    const { container } = render(<ProgressBar value={50} colorMode="dark" />);
    expect(container.querySelector('.bg-slate-800')).toBeInTheDocument();
  });

  it('applies custom class names', () => {
    const { container } = render(
      <ProgressBar value={50} className="custom-wrapper" barClassName="custom-bar" />
    );
    expect(container.firstChild).toHaveClass('custom-wrapper');
    expect(container.querySelector('.custom-bar')).toBeInTheDocument();
  });
});
