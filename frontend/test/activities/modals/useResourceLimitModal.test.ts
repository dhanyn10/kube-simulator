import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResourceLimitModal } from '@/activities/modals/useResourceLimitModal';
import { useFlowStore } from '@/store';

describe('useResourceLimitModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ logs: [] });
  });

  it('initializes default values when isOpen is true and initialResourceLimit is null', () => {
    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', null, mockOnSave, mockOnClose)
    );

    expect(result.current.name).toMatch(/^res-limit-[a-z0-9]+$/);
    expect(result.current.cpuRequest).toBe('500m');
    expect(result.current.cpuLimit).toBe('1000m');
    expect(result.current.memoryRequest).toBe('256Mi');
    expect(result.current.memoryLimit).toBe('512Mi');
  });

  it('initializes existing values when initialResourceLimit is provided', () => {
    const initialLimit = {
      id: 'rl-existing-1',
      name: 'prod-limit',
      cpuRequest: '1000m',
      cpuLimit: '2000m',
      memoryRequest: '512Mi',
      memoryLimit: '1024Mi',
    };

    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', initialLimit, mockOnSave, mockOnClose)
    );

    expect(result.current.name).toBe('prod-limit');
    expect(result.current.cpuRequest).toBe('1000m');
    expect(result.current.cpuLimit).toBe('2000m');
    expect(result.current.memoryRequest).toBe('512Mi');
    expect(result.current.memoryLimit).toBe('1024Mi');
  });

  it('handles CPU limit change and auto-clamps CPU request if limit is set lower than request', () => {
    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', null, mockOnSave, mockOnClose)
    );

    // Initial request is 500m. Change limit to 250m.
    act(() => {
      result.current.setCpuLimit('250m');
    });

    expect(result.current.cpuLimit).toBe('250m');
    expect(result.current.cpuRequest).toBe('250m');
  });

  it('handles Memory limit change and auto-clamps Memory request if limit is set lower than request', () => {
    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', null, mockOnSave, mockOnClose)
    );

    // Initial request is 256Mi. Change limit to 128Mi.
    act(() => {
      result.current.setMemoryLimit('128Mi');
    });

    expect(result.current.memoryLimit).toBe('128Mi');
    expect(result.current.memoryRequest).toBe('128Mi');
  });

  it('evaluates option disablers for CPU and Memory requests', () => {
    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', null, mockOnSave, mockOnClose)
    );

    // cpuLimit is 1000m (1 core). Option 2 Cores ('2000m') should be disabled.
    expect(result.current.isCpuRequestOptionDisabled('2000m')).toBe(true);
    expect(result.current.isCpuRequestOptionDisabled('500m')).toBe(false);

    // memoryLimit is 512Mi. Option 1Gi ('1024Mi') should be disabled.
    expect(result.current.isMemoryRequestOptionDisabled('1024Mi')).toBe(true);
    expect(result.current.isMemoryRequestOptionDisabled('256Mi')).toBe(false);
  });

  it('logs error when handleSave is called with an empty name', () => {
    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', null, mockOnSave, mockOnClose)
    );

    act(() => {
      result.current.setName('   ');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();

    const logs = useFlowStore.getState().logs;
    expect(logs.some(l => l.message === 'Resource Limit name cannot be empty.')).toBe(true);
  });

  it('calls onSave and onClose when handleSave is called with a valid name', () => {
    const initialLimit = {
      id: 'rl-99',
      name: 'old-name',
      cpuRequest: '250m',
      cpuLimit: '500m',
      memoryRequest: '128Mi',
      memoryLimit: '256Mi',
    };

    const { result } = renderHook(() =>
      useResourceLimitModal(true, 'dep-1', initialLimit, mockOnSave, mockOnClose)
    );

    act(() => {
      result.current.setName('new-valid-limit');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(mockOnSave).toHaveBeenCalledWith({
      id: 'rl-99',
      name: 'new-valid-limit',
      cpuRequest: '250m',
      cpuLimit: '500m',
      memoryRequest: '128Mi',
      memoryLimit: '256Mi',
    });
    expect(mockOnClose).toHaveBeenCalled();
  });
});
