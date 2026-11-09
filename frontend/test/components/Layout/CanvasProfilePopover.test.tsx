import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasProfilePopover } from '@/components/Layout/CanvasProfilePopover';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('CanvasProfilePopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CanvasProfilePopover isOpen={false} onClose={vi.fn()} colorMode="dark" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('toggles canvas profile popover and controls grid pattern, opacity, and autosave', () => {
    const setCanvasBgVariant = vi.spyOn(useFlowStore.getState(), 'setCanvasBgVariant');
    const setCanvasBgOpacity = vi.spyOn(useFlowStore.getState(), 'setCanvasBgOpacity');
    const toggleAutosave = vi.spyOn(useFlowStore.getState(), 'toggleAutosave');
    const onClose = vi.fn();

    useFlowStore.setState({
      canvasBgVariant: 'dots',
      canvasBgOpacity: 0.4,
      isAutosaveEnabled: false,
    });

    const { rerender } = render(
      <CanvasProfilePopover isOpen={true} onClose={onClose} colorMode="dark" />
    );

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

    // Close button
    const closeBtn = screen.getByLabelText('Close Canvas Profile');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);

    // Rerender with light mode
    rerender(<CanvasProfilePopover isOpen={true} onClose={onClose} colorMode="light" />);
    expect(screen.getByTestId('canvas-profile-popover')).toBeInTheDocument();
  });
});
