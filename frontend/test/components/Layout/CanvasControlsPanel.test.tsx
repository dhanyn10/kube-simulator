import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasControlsPanel } from '@/components/Layout/CanvasControlsPanel';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';
import '@testing-library/jest-dom';

describe('CanvasControlsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      isAutofocusEnabled: false,
    });
  });

  it('renders canvas control buttons in dark mode and handles click callbacks', () => {
    const toggleAutofocusSpy = vi.spyOn(useFlowStore.getState(), 'toggleAutofocus');

    render(
      <ReactFlowProvider>
        <CanvasControlsPanel />
      </ReactFlowProvider>
    );

    const zoomInBtn = screen.getByTitle('Zoom In');
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    const fitViewBtn = screen.getByTitle('Fit View');
    const autofocusBtn = screen.getByTitle('Enable Autofocus');

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(fitViewBtn);
    fireEvent.click(autofocusBtn);

    expect(toggleAutofocusSpy).toHaveBeenCalledTimes(1);
  });

  it('renders in light mode with autofocus enabled styling', () => {
    useFlowStore.setState({ colorMode: 'light', isAutofocusEnabled: true });

    render(
      <ReactFlowProvider>
        <CanvasControlsPanel />
      </ReactFlowProvider>
    );

    const autofocusBtn = screen.getByTitle('Disable Autofocus');
    expect(autofocusBtn).toBeInTheDocument();
  });
});
