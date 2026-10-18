import { describe, it, expect, vi } from 'vitest';
import { startTour } from '@/lib/tour';
import Shepherd from 'shepherd.js';

const mockTourInstance = {
  addStep: vi.fn(),
  start: vi.fn(),
  next: vi.fn(),
  back: vi.fn(),
  complete: vi.fn()
};

vi.mock('shepherd.js', () => {
  return {
    default: {
      Tour: vi.fn().mockImplementation(function() {
        return mockTourInstance;
      })
    }
  };
});

describe('startTour', () => {
  it('initializes and starts the tour', () => {
    startTour('dark');

    expect(Shepherd.Tour).toHaveBeenCalled();
    expect(mockTourInstance.addStep).toHaveBeenCalledTimes(4);
    expect(mockTourInstance.start).toHaveBeenCalled();
  });

  it('initializes and starts the tour in light mode and verifies step button actions', () => {
    mockTourInstance.addStep.mockClear();
    mockTourInstance.start.mockClear();

    startTour('light');

    expect(Shepherd.Tour).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultStepOptions: expect.objectContaining({
          classes: 'shepherd-theme-light',
        }),
      })
    );
    expect(mockTourInstance.addStep).toHaveBeenCalledTimes(4);

    // Verify first step buttons (only Next button, no Back)
    const firstStepArgs = mockTourInstance.addStep.mock.calls[0][0];
    expect(firstStepArgs.buttons).toHaveLength(1);
    expect(firstStepArgs.buttons[0].text).toBe('Next');
    firstStepArgs.buttons[0].action();

    // Verify second step buttons (Back and Next buttons)
    const secondStepArgs = mockTourInstance.addStep.mock.calls[1][0];
    expect(secondStepArgs.buttons).toHaveLength(2);
    expect(secondStepArgs.buttons[0].text).toBe('Back');
    expect(secondStepArgs.buttons[0].classes).toContain('bg-slate-200');
    secondStepArgs.buttons[0].action();

    // Verify last step buttons (Back and Finish buttons)
    const lastStepArgs = mockTourInstance.addStep.mock.calls[3][0];
    expect(lastStepArgs.buttons).toHaveLength(2);
    expect(lastStepArgs.buttons[1].text).toBe('Finish');
    lastStepArgs.buttons[1].action();
  });
});
