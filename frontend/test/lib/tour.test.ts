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
});
