import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlignmentGuideOverlay } from '@/components/Layout/AlignmentGuideOverlay';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

describe('AlignmentGuideOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      alignmentGuideLines: null,
    });
  });

  it('renders nothing when alignmentGuideLines is null', () => {
    render(
      <ReactFlowProvider>
        <AlignmentGuideOverlay />
      </ReactFlowProvider>
    );

    expect(screen.queryByTestId('alignment-guide-overlay')).toBeNull();
  });

  it('renders nothing when both horizontal and vertical are null', () => {
    useFlowStore.setState({
      alignmentGuideLines: { horizontal: null, vertical: null },
    });

    render(
      <ReactFlowProvider>
        <AlignmentGuideOverlay />
      </ReactFlowProvider>
    );

    expect(screen.queryByTestId('alignment-guide-overlay')).toBeNull();
  });

  it('renders vertical and horizontal guidelines when coordinates are set', () => {
    useFlowStore.setState({
      colorMode: 'dark',
      alignmentGuideLines: { horizontal: 150, vertical: 300 },
    });

    render(
      <ReactFlowProvider>
        <AlignmentGuideOverlay />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('alignment-guide-overlay')).toBeDefined();
    expect(screen.getByTestId('alignment-guide-vertical')).toBeDefined();
    expect(screen.getByTestId('alignment-guide-horizontal')).toBeDefined();
    expect(screen.getByText('Align X')).toBeDefined();
    expect(screen.getByText('Align Y')).toBeDefined();
  });

  it('renders correctly in light mode', () => {
    useFlowStore.setState({
      colorMode: 'light',
      alignmentGuideLines: { horizontal: 100, vertical: 200 },
    });

    render(
      <ReactFlowProvider>
        <AlignmentGuideOverlay />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('alignment-guide-vertical')).toBeDefined();
    expect(screen.getByTestId('alignment-guide-horizontal')).toBeDefined();
  });
});
