import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodeHandles } from '@/components/Nodes/NodeHandles';
import { ReactFlowProvider } from '@xyflow/react';

describe('NodeHandles', () => {
  it('renders all 8 handles at exact 50% midpoint positions', () => {
    const { container } = render(
      <ReactFlowProvider>
        <NodeHandles color="cyan" />
      </ReactFlowProvider>
    );

    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(8);

    const topTarget = container.querySelector('[data-handleid="top-t"]') as HTMLElement;
    const topSource = container.querySelector('[data-handleid="top-s"]') as HTMLElement;
    const bottomTarget = container.querySelector('[data-handleid="bottom-t"]') as HTMLElement;
    const bottomSource = container.querySelector('[data-handleid="bottom-s"]') as HTMLElement;
    const leftTarget = container.querySelector('[data-handleid="left-t"]') as HTMLElement;
    const leftSource = container.querySelector('[data-handleid="left-s"]') as HTMLElement;
    const rightTarget = container.querySelector('[data-handleid="right-t"]') as HTMLElement;
    const rightSource = container.querySelector('[data-handleid="right-s"]') as HTMLElement;

    expect(topTarget).toBeInTheDocument();
    expect(topSource).toBeInTheDocument();
    expect(bottomTarget).toBeInTheDocument();
    expect(bottomSource).toBeInTheDocument();
    expect(leftTarget).toBeInTheDocument();
    expect(leftSource).toBeInTheDocument();
    expect(rightTarget).toBeInTheDocument();
    expect(rightSource).toBeInTheDocument();

    // Verify exact midpoint placement styles
    expect(topTarget.style.left).toBe('50%');
    expect(topTarget.style.top).toBe('0px');
    expect(topTarget.style.transform).toBe('translate(-50%, -50%)');

    expect(bottomSource.style.left).toBe('50%');
    expect(bottomSource.style.bottom).toBe('0px');
    expect(bottomSource.style.transform).toBe('translate(-50%, 50%)');

    expect(leftTarget.style.left).toBe('0px');
    expect(leftTarget.style.top).toBe('50%');
    expect(leftTarget.style.transform).toBe('translate(-50%, -50%)');

    expect(rightSource.style.right).toBe('0px');
    expect(rightSource.style.top).toBe('50%');
    expect(rightSource.style.transform).toBe('translate(50%, -50%)');
  });

  it('supports custom bottomSourceClassName and rightSourceClassName', () => {
    const { container } = render(
      <ReactFlowProvider>
        <NodeHandles
          color="purple"
          bottomSourceClassName="opacity-20 pointer-events-none"
          rightSourceClassName="opacity-20 pointer-events-none"
        />
      </ReactFlowProvider>
    );

    const disabledHandles = container.querySelectorAll('.opacity-20');
    expect(disabledHandles).toHaveLength(2);
  });
});
