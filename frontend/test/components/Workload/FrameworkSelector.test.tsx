import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrameworkSelector } from '@/components/Workload/FrameworkSelector';

describe('FrameworkSelector', () => {
  const mockPerformUpdate = vi.fn();

  it('renders nothing if runtime is none', () => {
    const { container } = render(
      <FrameworkSelector
        runtime="none"
        framework={undefined}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders framework options for a given runtime', () => {
    render(
      <FrameworkSelector
        runtime="nodejs"
        framework={undefined}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    expect(screen.getByText('Express')).toBeDefined();
    expect(screen.getByText('NestJS')).toBeDefined();
  });

  it('calls performUpdate when a framework is clicked', () => {
    render(
      <FrameworkSelector
        runtime="nodejs"
        framework={undefined}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    fireEvent.click(screen.getByText('Express'));
    expect(mockPerformUpdate).toHaveBeenCalledWith({ framework: 'Express' });
  });

  it('highlights the active framework', () => {
    render(
      <FrameworkSelector
        runtime="nodejs"
        framework="Express"
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    const expressBtn = screen.getByText('Express');
    expect(expressBtn.className).toContain('bg-emerald-600');
  });
});
