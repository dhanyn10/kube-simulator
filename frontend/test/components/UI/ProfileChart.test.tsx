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

    it('handles MiniCurvePreview without currentMinuteIndex or currentHourIndex (fallback minuteIdx 0)', () => {
      render(
        <MiniCurvePreview
          profile={dummyProfile}
          isApplied={true}
          isRed={false}
        />
      );

      expect(screen.getByTestId('mini-active-traffic-dot')).toBeInTheDocument();
    });

    it('renders mini curve preview with sub-hourly interval granularity', () => {
      const subHourlyProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '00:10': 120,
          '00:20': 140,
          '00:30': 150,
          '01:00': 200,
        }
      };

      const { container } = render(
        <MiniCurvePreview
          profile={subHourlyProfile}
          isApplied={true}
          currentMinuteIndex={10}
          isRed={false}
        />
      );

      const path = container.querySelector('path[stroke="#3b82f6"]');
      expect(path).toBeInTheDocument();
      expect(screen.getByTestId('mini-active-traffic-dot')).toBeInTheDocument();
    });
  });

  describe('InteractiveTrafficChart', () => {
    it('renders interval dropdown and horizontal zoom slider and auto-detects profile interval', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const subHourly10mProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '00:10': 120,
          '00:30': 150,
        }
      };

      const { rerender } = render(
        <InteractiveTrafficChart
          profile={subHourly10mProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      const intervalSelect = screen.getByRole('combobox') as HTMLSelectElement;
      expect(intervalSelect).toBeInTheDocument();
      expect(intervalSelect.value).toBe('10');

      rerender(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );
      expect(intervalSelect.value).toBe('60');

      fireEvent.change(intervalSelect, { target: { value: '30' } });
      expect(intervalSelect.value).toBe('30');

      const zoomSlider = screen.getByRole('slider');
      expect(zoomSlider).toBeInTheDocument();
      fireEvent.change(zoomSlider, { target: { value: '200' } });
      expect(screen.getByText('200%')).toBeInTheDocument();
    });

    it('hydrates profile points when switching to sub-hourly interval and handles resample warning overlay', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();
      const onUpdateProfile = vi.fn();

      const subHourlyProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '00:10': 120,
          '01:00': 200,
        }
      };

      const { unmount } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
          onUpdateProfile={onUpdateProfile}
        />
      );

      const intervalSelect = screen.getByRole('combobox') as HTMLSelectElement;

      // Select 30 minutes on 1h profile -> hydrates keys and calls onUpdateProfile
      fireEvent.change(intervalSelect, { target: { value: '30' } });
      expect(onUpdateProfile).toHaveBeenCalled();
      unmount();

      // Render with sub-hourly profile
      render(
        <InteractiveTrafficChart
          profile={subHourlyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
          onUpdateProfile={onUpdateProfile}
        />
      );

      const subIntervalSelect = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(subIntervalSelect, { target: { value: '60' } });

      const warningOverlay = screen.getByTestId('interval-resample-warning-overlay');
      expect(warningOverlay).toBeInTheDocument();

      // Click Cancel on warning overlay
      const cancelBtn = screen.getByTestId('cancel-resample-btn');
      fireEvent.click(cancelBtn);
      expect(screen.queryByTestId('interval-resample-warning-overlay')).not.toBeInTheDocument();

      // Trigger warning again and click Continue
      fireEvent.change(subIntervalSelect, { target: { value: '60' } });
      const confirmBtn = screen.getByTestId('confirm-resample-btn');
      fireEvent.click(confirmBtn);

      expect(onUpdateProfile).toHaveBeenCalled();
      expect(screen.queryByTestId('interval-resample-warning-overlay')).not.toBeInTheDocument();
    });

    it('hydrates missing sub-hourly keys on pointer down when intervalMinutes < 60', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();
      const onUpdateProfile = vi.fn();

      const subHourlyProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '00:10': 120,
          '01:00': 200,
        }
      };

      const { container } = render(
        <InteractiveTrafficChart
          profile={subHourlyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
          onUpdateProfile={onUpdateProfile}
        />
      );

      const targetCircles = container.querySelectorAll('circle.cursor-ns-resize');
      if (targetCircles.length > 0) {
        fireEvent.pointerDown(targetCircles[0], { clientX: 100, clientY: 120, pointerId: 1 });
        expect(onUpdateProfile).toHaveBeenCalled();
      }
    });

    it('triggers onPointerDown on point indicator circle', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const { container } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      // Circle at index 1 is the visible point indicator dot with r=3
      const targetCircles = container.querySelectorAll('circle.cursor-ns-resize');
      if (targetCircles.length > 1) {
        fireEvent.pointerDown(targetCircles[1], { clientX: 100, clientY: 120, pointerId: 1 });
        expect(targetCircles[1]).toBeInTheDocument();
      }
    });

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

    it('covers zoomScale <= 100 100% width style, currentHourIndex fallback in InteractiveTrafficChart, and pointer up when not dragging', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const { container } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="dark"
          isApplied={true}
          currentHourIndex={3}
          isRed={true}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      const chartSvg = container.querySelector('svg[viewBox="0 0 680 280"]')!;
      expect(chartSvg).toBeInTheDocument();

      // Pointer up when draggingHour is null
      fireEvent.pointerUp(chartSvg, { pointerId: 1 });

      // Pointer move when draggingHour is null (should not call onUpdatePoint)
      fireEvent.pointerMove(chartSvg, { clientX: 100, clientY: 100 });
      expect(onUpdatePoint).not.toHaveBeenCalled();
    });

    it('covers interval change without onUpdateProfile callback and non-60m interval dropdown changes', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const { unmount } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      const selectEl = screen.getByRole('combobox') as HTMLSelectElement;
      // Change to 30 min interval without passing onUpdateProfile prop
      fireEvent.change(selectEl, { target: { value: '30' } });
      expect(selectEl.value).toBe('30');
      unmount();

      // Test with profile that already has intermediate 30m key '00:30'
      const profileWith30mKey: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '00:30': 150,
          '01:00': 200,
        },
      };

      render(
        <InteractiveTrafficChart
          profile={profileWith30mKey}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      const selectEl2 = screen.getByRole('combobox') as HTMLSelectElement;
      // Changing to 30 should not prompt warning overlay since keys exist
      fireEvent.change(selectEl2, { target: { value: '30' } });
      expect(screen.queryByTestId('interval-resample-warning-overlay')).not.toBeInTheDocument();
    });

    it('covers InteractiveTrafficChart resample confirm without onUpdateProfile, pointer down on < 60m interval without onUpdateProfile, and isRed active simulation state', () => {
      useFlowStore.setState({ isSimulating: true });
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const subHourlyProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '00:10': 120,
          '01:00': 200,
        },
      };

      const { container } = render(
        <InteractiveTrafficChart
          profile={subHourlyProfile}
          colorMode="dark"
          isApplied={true}
          currentMinuteIndex={0}
          isRed={true}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      expect(screen.getByTestId('interactive-active-traffic-dot')).toBeInTheDocument();

      // Pointer down on first circle when intervalMinutes < 60 without onUpdateProfile prop
      const targetCircles = container.querySelectorAll('circle.cursor-ns-resize');
      if (targetCircles.length > 0) {
        fireEvent.pointerDown(targetCircles[0], { clientX: 100, clientY: 120, pointerId: 1 });
      }

      // Switch to 60m to trigger resample warning overlay and click confirm without onUpdateProfile
      const selectEl = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(selectEl, { target: { value: '60' } });

      const confirmBtn = screen.getByTestId('confirm-resample-btn');
      fireEvent.click(confirmBtn);
      expect(screen.queryByTestId('interval-resample-warning-overlay')).not.toBeInTheDocument();
    });

    it('covers zoomScale > 100 explicit pixel width styling and 10m interval key linear interpolation hydration loop', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();
      const onUpdateProfile = vi.fn();

      // Profile with only 00:00 and 01:00 keys
      const hourlyProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {
          '00:00': 100,
          '01:00': 300,
        },
      };

      const { container } = render(
        <InteractiveTrafficChart
          profile={hourlyProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
          onUpdateProfile={onUpdateProfile}
        />
      );

      // 1. Zoom slider to 200% -> zoomScale > 100 triggers pixel width styling
      const zoomSlider = screen.getByRole('slider');
      fireEvent.change(zoomSlider, { target: { value: '200' } });

      const chartSvg = container.querySelector('svg[viewBox="0 0 1360 280"]');
      expect(chartSvg).toBeInTheDocument();
      expect(chartSvg?.getAttribute('style')).toContain('width: 1360px');

      // 2. Select 10m interval -> triggers 10m interval key interpolation hydration loop
      const selectEl = screen.getByRole('combobox') as HTMLSelectElement;
      fireEvent.change(selectEl, { target: { value: '10' } });

      expect(onUpdateProfile).toHaveBeenCalled();
      const hydratedHourly = onUpdateProfile.mock.calls[0][0].hourly;
      expect(hydratedHourly['00:10']).toBeDefined();
      expect(hydratedHourly['00:30']).toBeDefined();
    });

    it('covers pointer move and leave while draggingHour is active, and hover tooltip in light mode', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();

      const { container } = render(
        <InteractiveTrafficChart
          profile={dummyProfile}
          colorMode="light"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
        />
      );

      const overlayRect = screen.getByTestId('interactive-chart-canvas-overlay');

      // 1. Hover in light mode to cover lines 585 & 595 (colorMode === 'dark' false branch in tooltip)
      act(() => {
        fireEvent.pointerMove(overlayRect, { clientX: 150, clientY: 50, bubbles: true });
      });
      expect(screen.getByTestId('interactive-hover-minute-indicator')).toBeInTheDocument();

      // 2. Start dragging a point
      const targetCircles = container.querySelectorAll('circle.cursor-ns-resize');
      if (targetCircles.length > 0) {
        fireEvent.pointerDown(targetCircles[0], { clientX: 100, clientY: 120, pointerId: 1 });
      }

      // 3. Move and leave overlay rect while draggingHour is active (covers lines 260 and 266 !draggingHour false branches)
      act(() => {
        fireEvent.pointerMove(overlayRect, { clientX: 160, clientY: 60, bubbles: true });
        fireEvent.pointerLeave(overlayRect);
      });

      // Release pointer
      fireEvent.pointerUp(overlayRect, { pointerId: 1 });
    });

    it('covers pointer down on <60m interval when all sub-hourly keys already exist (modified=false) and interval dropdown change to 60m', () => {
      const onUpdatePoint = vi.fn();
      const onUpdateName = vi.fn();
      const onUpdateProfile = vi.fn();

      // Profile that has all 30m keys for the day
      const complete30mProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: {},
      };
      for (let i = 0; i <= 48; i++) {
        const m = Math.min(1440, i * 30);
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        complete30mProfile.hourly[`${hh}:${mm}`] = 100;
      }

      const { container } = render(
        <InteractiveTrafficChart
          profile={complete30mProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
          onUpdateProfile={onUpdateProfile}
        />
      );

      // 1. The component auto-detects interval 30m. Pointer down on a circle when all 30m keys already exist
      // Line 233: modified is false, so onUpdateProfile is NOT called
      const targetCircles = container.querySelectorAll('circle.cursor-ns-resize');
      if (targetCircles.length > 0) {
        fireEvent.pointerDown(targetCircles[0], { clientX: 100, clientY: 120, pointerId: 1 });
        expect(onUpdateProfile).not.toHaveBeenCalled();
        fireEvent.pointerUp(targetCircles[0], { pointerId: 1 });
      }

      // 2. Test selecting 60m on a standard profile without subhourly keys (covers line 380 newInterval < 60 false branch)
      const standardProfile: InternetProfileItem = {
        ...dummyProfile,
        hourly: { '00:00': 100, '01:00': 200 },
      };

      render(
        <InteractiveTrafficChart
          profile={standardProfile}
          colorMode="dark"
          isApplied={false}
          onUpdatePoint={onUpdatePoint}
          onUpdateName={onUpdateName}
          onUpdateProfile={onUpdateProfile}
        />
      );

      const selectEl = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
      // Change to 60 (newInterval = 60, so line 380 newInterval < 60 is false)
      fireEvent.change(selectEl, { target: { value: '60' } });
      expect(selectEl.value).toBe('60');
    });
  });
});

