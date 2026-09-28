import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageDropdown } from '@/activities/ui/useImageDropdown';
import { useFlowStore } from '@/store';

describe('useImageDropdown', () => {
  beforeEach(() => {
    useFlowStore.setState({
      customImages: ['my-custom-image:latest'],
    });
  });

  it('manages state and selects image options', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useImageDropdown({ value: '', onChange }));

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.setIsOpen(true);
      result.current.setSearch('nginx');
    });

    expect(result.current.filteredOptions.dockerHub.some((i) => i.name.includes('nginx'))).toBe(true);

    act(() => {
      result.current.handleSelectOption('nginx:alpine');
    });

    expect(onChange).toHaveBeenCalledWith('nginx:alpine');
    expect(result.current.isOpen).toBe(false);
    expect(result.current.search).toBe('');
  });

  it('registers custom images and triggers selection', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useImageDropdown({ value: '', onChange }));

    act(() => {
      result.current.setSearch('custom-repo/image:v1');
    });

    act(() => {
      result.current.handleUseCustomImage();
    });

    expect(useFlowStore.getState().customImages).toContain('custom-repo/image:v1');
    expect(onChange).toHaveBeenCalledWith('custom-repo/image:v1');
  });
});
