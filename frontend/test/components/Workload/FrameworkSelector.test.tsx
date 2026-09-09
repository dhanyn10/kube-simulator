import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FrameworkSelector } from '@/components/Workload/FrameworkSelector';

describe('FrameworkSelector', () => {
  const mockPerformUpdate = vi.fn();

  it('renders nothing if runtime is none, empty, or undefined', () => {
    const { container: c1 } = render(
      <FrameworkSelector
        runtime="none"
        framework={undefined}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <FrameworkSelector
        runtime=""
        framework={undefined}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders nothing if runtime is unknown and has no framework config', () => {
    const { container } = render(
      <FrameworkSelector
        runtime="unknown-runtime"
        framework={undefined}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders framework options for a given runtime and applies light mode inactive styling', () => {
    render(
      <FrameworkSelector
        runtime="nodejs"
        framework="NestJS"
        colorMode="light"
        performUpdate={mockPerformUpdate}
      />
    );

    const expressBtn = screen.getByText('Express');
    expect(expressBtn).toHaveClass('bg-white');

    const nestBtn = screen.getByText('NestJS');
    expect(nestBtn).toHaveClass('bg-emerald-600');
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

  it('highlights the active framework in dark mode', () => {
    render(
      <FrameworkSelector
        runtime="nodejs"
        framework="Express"
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    const expressBtn = screen.getByText('Express');
    expect(expressBtn).toHaveClass('bg-emerald-600');

    const nestBtn = screen.getByText('NestJS');
    expect(nestBtn).toHaveClass('bg-slate-950');
  });
});
