import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MiniCurvePreview, InteractiveTrafficChart } from '@/components/UI/ProfileChart';
import { InternetProfileItem } from '@/activities/modals';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('ProfileChart', () => {
  const dummyProfile: InternetProfileItem = {
    id: 'p1',
    name: 'Standard E-Commerce Traffic',
    category: 'E-Commerce',
    description: 'Typical 24h traffic',
    hourly: {
      '00:00': 100,
      '01:00': 150,
      '12:00': 1000,
      '23:00': 200,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    SVGElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 10,
      left: 10,
      bottom: 290,
      right: 690,
      width: 680,
      height: 280,
      x: 10,
      y: 10,
      toJSON: () => {},
    });
    useFlowStore.setState({
      isSimulating: false,
    });
  });

  describe('MiniCurvePreview', () => {
    it('renders mini curve SVG preview in normal and applied/active dot state', () => {
      const { container } = render(
        <MiniCurvePreview
          profile={dummyProfile}
          isApplied={true}
          currentMinuteIndex={720} // 12:00
          isRed={true}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByTestId('mini-active-traffic-dot')).toBeInTheDocument();

      // Trigger pointer move on overlay rect to test hover dot
      const overlayRect = screen.getByTestId('mini-chart-canvas-overlay');
      if (overlayRect) {
        act(() => {
          fireEvent.pointerMove(overlayRect, { clientX: 50, clientY: 20 });
        });
        expect(screen.getByTestId('mini-hover-traffic-dot')).toBeInTheDocument();

        act(() => {
          fireEvent.pointerLeave(overlayRect);
        });
        expect(screen.queryByTestId('mini-hover-traffic-dot')).not.toBeInTheDocument();
      }
    });

    it('handles currentHourIndex fallback when currentMinuteIndex is undefined', () => {
      render(
        <MiniCurvePreview
          profile={dummyProfile}
          isApplied={true}
          currentHourIndex={5}
          isRed={false}
        />
      );

      expect(screen.getByTestId('mini-active-traffic-dot')).toBeInTheDocument();
    });
  });

  describe('InteractiveTrafficChart', () => {
    it('renders interactive chart with active simulation dot, title input, and pointer interaction', () => {
      useFlowStore.setState({ isSimulating: true });
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const { container } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="dark"
          isApplied={true}
          currentMinuteIndex={60}
          isRed={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      expect(screen.getByDisplayValue('Standard E-Commerce Traffic')).toBeInTheDocument();
      expect(screen.getByTestId('interactive-active-traffic-dot')).toBeInTheDocument();

      const nameInput = screen.getByDisplayValue('Standard E-Commerce Traffic');
      fireEvent.change(nameInput, { target: { value: 'New Profile Name' } });
      expect(onUpdateName).toHaveBeenCalledWith('New Profile Name');

      const overlayRect = screen.getByTestId('interactive-chart-canvas-overlay');
      act(() => {
        fireEvent.pointerMove(overlayRect, { clientX: 150, clientY: 50, bubbles: true });
      });
      expect(screen.getByTestId('interactive-hover-minute-indicator')).toBeInTheDocument();
      act(() => {
        fireEvent.pointerLeave(overlayRect);
      });
      expect(screen.queryByTestId('interactive-hover-minute-indicator')).not.toBeInTheDocument();
    });

    it('renders in light mode with pointer down, move, and up dragging', () => {
      useFlowStore.setState({ isSimulating: false });
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const { container } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="light"
          isApplied={false}
          currentHourIndex={12}
          isRed={true}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      const chartSvg = container.querySelector('svg[viewBox="0 0 680 280"]')!;
      fireEvent.pointerMove(chartSvg, { clientX: 150, clientY: 100 });

      const targetCircles = container.querySelectorAll('circle.cursor-ns-resize');
      if (targetCircles.length > 0) {
        fireEvent.pointerDown(targetCircles[0], { clientX: 100, clientY: 120, pointerId: 1 });
        fireEvent.pointerMove(targetCircles[0], { clientX: 100, clientY: 80, pointerId: 1 });
        expect(onUpdatePoint).toHaveBeenCalled();

        fireEvent.pointerUp(targetCircles[0], { pointerId: 1 });
      }
    });
  });
});
