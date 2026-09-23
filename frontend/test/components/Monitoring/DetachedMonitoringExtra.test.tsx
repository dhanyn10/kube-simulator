import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { DetachedMonitoring } from '@/components/Monitoring/DetachedMonitoring';

describe('DetachedMonitoring extra branch coverage', () => {
  it('covers isThrottled badge, replicas fallback, light mode card styling, and runtime JSON parse error handling', () => {
    let metricsCallback: ((json: string) => void) | undefined;
    let themeCallback: ((mode: string) => void) | undefined;
    (globalThis as any).runtime = {
      EventsOn: vi.fn((event, cb) => {
        if (event === 'metrics-update') {
          metricsCallback = cb;
        } else if (event === 'theme-sync') {
          themeCallback = cb;
        }
      }),
      EventsEmit: vi.fn(),
    };

    render(<DetachedMonitoring />);

    // Simulate metrics-update event with invalid JSON to test catch block (line 28)
    if (metricsCallback) {
      act(() => {
        metricsCallback!('invalid json');
      });
    }

    // Simulate valid METRICS_UPDATE with isThrottled = true and dep without replicas
    if (metricsCallback) {
      act(() => {
        metricsCallback!(
          JSON.stringify({
            metrics: {
              'dep-1': [
                {
                  cpuPercent: 95,
                  memoryPercent: 80,
                  isThrottled: true,
                  isOOM: false,
                },
              ],
            },
            deployments: [{ id: 'dep-1', label: 'Test Dep' }],
          })
        );
      });
    }

    expect(screen.getByText('Throttled')).toBeInTheDocument();
    expect(screen.getByText('1 Replicas')).toBeInTheDocument();

    // Switch theme to light mode to cover light mode branch on deployment cards
    if (themeCallback) {
      act(() => {
        themeCallback!('light');
      });
    }

    const card = screen.getByText('Test Dep').closest('.rounded-2xl')!;
    expect(card.className).toContain('bg-white');
  });
});
