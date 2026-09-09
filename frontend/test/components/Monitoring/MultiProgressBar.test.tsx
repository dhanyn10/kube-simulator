import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MultiProgressBar } from '@/components/Monitoring/MultiProgressBar';
import '@testing-library/jest-dom';

describe('MultiProgressBar', () => {
  it('renders segments with titles and dark mode styling', () => {
    const segments = [
      { value: 40, color: 'bg-blue-500', title: 'Pod 1 (40%)' },
      { value: 30, color: 'bg-purple-500', title: 'Pod 2 (30%)' },
    ];

    const { container } = render(
      <MultiProgressBar segments={segments} height="h-3" colorMode="dark" className="custom-progress" />
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('bg-slate-800');
    expect(outerDiv).toHaveClass('h-3');
    expect(outerDiv).toHaveClass('custom-progress');

    const bars = outerDiv.children;
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute('title', 'Pod 1 (40%)');
    expect(bars[0]).toHaveStyle('width: 40%');
    expect(bars[1]).toHaveAttribute('title', 'Pod 2 (30%)');
    expect(bars[1]).toHaveStyle('width: 30%');
  });

  it('renders segments without title (using default segment key fallback) and light mode styling', () => {
    const segments = [
      { value: 50, color: 'bg-emerald-500' },
    ];

    const { container } = render(
      <MultiProgressBar segments={segments} colorMode="light" />
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('bg-slate-100');
    expect(outerDiv).toHaveClass('h-2.5');

    const bar = outerDiv.children[0];
    expect(bar).not.toHaveAttribute('title');
    expect(bar).toHaveStyle('width: 50%');
  });
});
