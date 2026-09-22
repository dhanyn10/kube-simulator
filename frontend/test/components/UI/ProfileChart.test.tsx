import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import {
  MiniCurvePreview,
  InteractiveTrafficChart,
  InteractiveTrafficChartProps
} from '@/components/UI/ProfileChart';
import { ECOMMERCE_PROFILE } from '@/activities/modals';
import { useFlowStore } from '@/store/useFlowStore';

describe('ProfileChart Component', () => {
  beforeEach(() => {
    useFlowStore.setState({ isSimulating: false });
    vi.clearAllMocks();
  });

  describe('MiniCurvePreview', () => {
    it('renders without applied badge or traffic dot when isApplied is false', () => {
      const { container } = render(
        <MiniCurvePreview profile={ECOMMERCE_PROFILE} />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByTestId('mini-active-traffic-dot')).not.toBeInTheDocument();
    });

    it('renders active traffic dot when isApplied is true with isRed true and false', () => {
      const { rerender } = render(
        <MiniCurvePreview
          profile={ECOMMERCE_PROFILE}
          isApplied={true}
          currentHourIndex={3}
          isRed={false}
        />
      );

      const dotGroup = screen.getByTestId('mini-active-traffic-dot');
      expect(dotGroup).toBeInTheDocument();
      const circle = dotGroup.querySelectorAll('circle')[1];
      expect(circle.className.baseVal || circle.getAttribute('class')).toContain('fill-blue-400');

      // Rerender with isRed = true
      rerender(
        <MiniCurvePreview
          profile={ECOMMERCE_PROFILE}
          isApplied={true}
          currentHourIndex={3}
          isRed={true}
        />
      );
      expect(circle.className.baseVal || circle.getAttribute('class')).toContain('fill-rose-500');
    });

    it('handles mouse move and mouse leave for hover indicator', () => {
      const { container } = render(
        <MiniCurvePreview
          profile={ECOMMERCE_PROFILE}
          isApplied={true}
          currentHourIndex={0}
          isRed={false}
        />
      );

      const svg = container.querySelector('svg')!;

      // Mock getBoundingClientRect
      vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 220,
        height: 55,
        right: 220,
        bottom: 55,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      // Hover over same hour (0)
      fireEvent.mouseMove(svg, { clientX: 10 });
      let hoverDot = screen.getByTestId('mini-hover-traffic-dot');
      expect(hoverDot).toBeInTheDocument();

      // Mouse leave resets hover
      fireEvent.mouseLeave(svg);
      expect(screen.queryByTestId('mini-hover-traffic-dot')).not.toBeInTheDocument();
    });

    it('tests hover dot fill class when hoveredHourIdx === safeHourIdx (red vs green) and different hour', () => {
      const { container, rerender } = render(
        <MiniCurvePreview
          profile={ECOMMERCE_PROFILE}
          isApplied={true}
          currentHourIndex={0}
          isRed={false}
        />
      );

      const svg = container.querySelector('svg')!;
      vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 220,
        height: 55,
        right: 220,
        bottom: 55,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      // Hover over safe hour (0) - green dot
      fireEvent.mouseMove(svg, { clientX: 10 });
      let hoverCircle = screen.getByTestId('mini-hover-traffic-dot').querySelector('circle')!;
      expect(hoverCircle.className.baseVal || hoverCircle.getAttribute('class')).toContain('fill-emerald-400');

      // Hover over safe hour with isRed = true
      rerender(
        <MiniCurvePreview
          profile={ECOMMERCE_PROFILE}
          isApplied={true}
          currentHourIndex={0}
          isRed={true}
        />
      );
      fireEvent.mouseMove(svg, { clientX: 10 });
      hoverCircle = screen.getByTestId('mini-hover-traffic-dot').querySelector('circle')!;
      expect(hoverCircle.className.baseVal || hoverCircle.getAttribute('class')).toContain('fill-rose-500');

      // Hover over a different hour index
      fireEvent.mouseMove(svg, { clientX: 100 });
      hoverCircle = screen.getByTestId('mini-hover-traffic-dot').querySelector('circle')!;
      expect(hoverCircle.className.baseVal || hoverCircle.getAttribute('class')).toContain('fill-blue-300');
    });

    it('handles fallback profile without hourly or daily values and undefined currentHourIndex', () => {
      const emptyProfile = {
        name: 'Empty Mini Profile'
      };

      const { container } = render(
        <MiniCurvePreview
          profile={emptyProfile}
          isApplied={true}
          // currentHourIndex omitted
        />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByTestId('mini-active-traffic-dot')).toBeInTheDocument();
    });
  });

  describe('InteractiveTrafficChart', () => {
    const defaultProps: InteractiveTrafficChartProps = {
      profile: ECOMMERCE_PROFILE,
      colorMode: 'dark',
      isApplied: false,
      currentHourIndex: 0,
      isRed: false,
      onUpdatePoint: vi.fn(),
      onUpdateName: vi.fn()
    };

    it('renders in dark mode and light mode correctly', () => {
      const { container, rerender } = render(
        <InteractiveTrafficChart {...defaultProps} colorMode="dark" />
      );

      expect(container.firstChild).toHaveClass('bg-slate-950/80');

      rerender(
        <InteractiveTrafficChart {...defaultProps} colorMode="light" />
      );
      expect(container.firstChild).toHaveClass('bg-slate-50');
    });

    it('handles profile name editing via input change', () => {
      const onUpdateName = vi.fn();
      render(
        <InteractiveTrafficChart {...defaultProps} onUpdateName={onUpdateName} />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Custom Profile Name' } });
      expect(onUpdateName).toHaveBeenCalledWith('New Custom Profile Name');
    });

    it('formats Y-axis ticks for values both >= 1000 and < 1000', () => {
      const smallValueProfile = {
        name: 'Low Traffic',
        hourly: {
          '00:00': 100,
          '01:00': 200,
          '02:00': 150
        }
      };

      render(
        <InteractiveTrafficChart {...defaultProps} profile={smallValueProfile} />
      );

      // Y-axis ticks contain ratio = 1 tick (0) which is < 1000 and formatted as number '0'
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThan(0);
      // ratio = 0 tick (1500) which is >= 1000 and formatted as '1.5k'
      expect(screen.getByText('1.5k')).toBeInTheDocument();
    });

    it('handles pointer move, pointer down, pointer up, and pointer leave for dragging data points', () => {
      const onUpdatePoint = vi.fn();
      const { container } = render(
        <InteractiveTrafficChart {...defaultProps} onUpdatePoint={onUpdatePoint} />
      );

      const svg = container.querySelector('svg')!;
      const mockRect = {
        left: 0,
        top: 0,
        width: 680,
        height: 280,
        right: 680,
        bottom: 280,
        x: 0,
        y: 0,
        toJSON: () => {}
      };
      vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(mockRect);

      // Pointer move on chart when draggingHour is null (triggers !draggingHour return in pointerMove)
      fireEvent.pointerMove(svg, { clientX: 100, clientY: 100 });

      // Find SVG circles
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);

      // Pointer down on first point circle ('00:00')
      fireEvent.pointerDown(circles[0], { pointerId: 1, clientY: 100 });

      // Move pointer on circle itself or svg while dragging
      fireEvent.pointerMove(circles[0], { clientX: 80, clientY: 120 });
      fireEvent.pointerMove(svg, { clientX: 80, clientY: 120 });

      expect(onUpdatePoint).toHaveBeenCalled();

      // Pointer up releases drag
      fireEvent.pointerUp(circles[0], { pointerId: 1 });

      // Pointer up when not dragging (should not throw)
      fireEvent.pointerUp(svg, { pointerId: 1 });

      // Pointer leave resets hover
      fireEvent.pointerLeave(svg);
    });

    it('covers all guide line and point fill combinations during active simulation, hover, and error state', () => {
      useFlowStore.setState({ isSimulating: true });

      const { container, rerender } = render(
        <InteractiveTrafficChart
          {...defaultProps}
          isApplied={true}
          currentHourIndex={0}
          isRed={false}
        />
      );

      const svg = container.querySelector('svg')!;
      vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 680,
        height: 280,
        right: 680,
        bottom: 280,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      // 1. Hover on active simulation hour (00:00) with isRed = false (isHoveredThis && isSameHour)
      fireEvent.pointerMove(svg, { clientX: 70, clientY: 100 });

      // 2. Hover on active simulation hour (00:00) with isRed = true
      rerender(
        <InteractiveTrafficChart
          {...defaultProps}
          isApplied={true}
          currentHourIndex={0}
          isRed={true}
        />
      );
      fireEvent.pointerMove(svg, { clientX: 70, clientY: 100 });

      // 3. Simulation active on hour 0, but hovering on different hour (03:00) with isRed = true (isSimulatingActive && !isHoveredThis with isRed)
      fireEvent.pointerMove(svg, { clientX: 150, clientY: 100 });

      // 4. Simulation active on hour 0, hovering on different hour with isRed = false (isSimulatingActive && !isHoveredThis without isRed)
      rerender(
        <InteractiveTrafficChart
          {...defaultProps}
          isApplied={true}
          currentHourIndex={0}
          isRed={false}
        />
      );
      fireEvent.pointerMove(svg, { clientX: 150, clientY: 100 });

      // Reset hover
      fireEvent.pointerLeave(svg);
    });
  });
});
