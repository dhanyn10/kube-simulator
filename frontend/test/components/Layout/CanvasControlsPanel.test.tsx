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
      alignAllNodesToGrid: vi.fn(),
    });
  });

  it('renders canvas control buttons in dark mode and handles click callbacks', () => {
    const toggleAutofocusSpy = vi.spyOn(useFlowStore.getState(), 'toggleAutofocus');
    const alignAllNodesSpy = vi.spyOn(useFlowStore.getState(), 'alignAllNodesToGrid');

    render(
      <ReactFlowProvider>
        <CanvasControlsPanel />
      </ReactFlowProvider>
    );

    const zoomInBtn = screen.getByTitle('Zoom In');
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    const fitViewBtn = screen.getByTitle('Fit View');
    const autofocusBtn = screen.getByTitle('Enable Autofocus');
    const alignGridBtn = screen.getByTestId('align-all-cards-btn');

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(fitViewBtn);
    fireEvent.click(autofocusBtn);
    fireEvent.click(alignGridBtn);

    expect(toggleAutofocusSpy).toHaveBeenCalledTimes(1);
    expect(alignAllNodesSpy).toHaveBeenCalledTimes(1);
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

  it('toggles canvas profile popover and controls grid pattern, opacity, autosave and card alignment', () => {
    const setCanvasBgVariant = vi.spyOn(useFlowStore.getState(), 'setCanvasBgVariant');
    const setCanvasBgOpacity = vi.spyOn(useFlowStore.getState(), 'setCanvasBgOpacity');
    const toggleAutosave = vi.spyOn(useFlowStore.getState(), 'toggleAutosave');
    const alignAllNodesToGrid = vi.spyOn(useFlowStore.getState(), 'alignAllNodesToGrid');

    useFlowStore.setState({
      canvasBgVariant: 'dots',
      canvasBgOpacity: 0.4,
      isAutosaveEnabled: false,
    });

    render(
      <ReactFlowProvider>
        <CanvasControlsPanel />
      </ReactFlowProvider>
    );

    const profileBtn = screen.getByTestId('canvas-profile-btn');
    fireEvent.click(profileBtn);

    expect(screen.getByTestId('canvas-profile-popover')).toBeInTheDocument();

    // Pattern change
    fireEvent.click(screen.getByTestId('pattern-btn-lines'));
    expect(setCanvasBgVariant).toHaveBeenCalledWith('lines');

    // Opacity change
    const opacitySlider = screen.getByLabelText('Grid Opacity');
    fireEvent.change(opacitySlider, { target: { value: '0.8' } });
    expect(setCanvasBgOpacity).toHaveBeenCalledWith(0.8);

    // Autosave toggle
    const autosaveBtn = screen.getByTestId('canvas-autosave-toggle');
    fireEvent.click(autosaveBtn);
    expect(toggleAutosave).toHaveBeenCalledTimes(1);

    // Align cards button
    const alignCardsBtn = screen.getByTestId('canvas-popover-align-btn');
    fireEvent.click(alignCardsBtn);
    expect(alignAllNodesToGrid).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByLabelText('Close Canvas Profile');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('canvas-profile-popover')).toBeNull();
  });
});
