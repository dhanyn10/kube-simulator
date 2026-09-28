import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutocompletePortal } from '@/activities/modals/useAutocompletePortal';

describe('useAutocompletePortal hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles input focus and value change callback', () => {
    const { result } = renderHook(() => useAutocompletePortal('my-portal'));

    const mockInput = document.createElement('input');
    vi.spyOn(mockInput, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      left: 50,
      width: 200,
      top: 80,
      right: 250,
      height: 20,
      x: 50,
      y: 80,
      toJSON: () => {},
    });

    const onValueChange = vi.fn();

    act(() => {
      result.current.handleInputFocusOrChange(
        mockInput,
        'row-1',
        'key',
        onValueChange,
        'new-val'
      );
    });

    expect(onValueChange).toHaveBeenCalledWith('row-1', 'key', 'new-val');
    expect(result.current.activeDropdown).toEqual({ rowId: 'row-1', field: 'key' });
    expect(result.current.dropdownPos).toEqual({
      top: 104 + window.scrollY,
      left: 50 + window.scrollX,
      width: 200,
    });
  });

  it('deduplicates position update when dimensions match', () => {
    const { result } = renderHook(() => useAutocompletePortal('my-portal'));

    const mockInput = document.createElement('input');
    vi.spyOn(mockInput, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      left: 50,
      width: 200,
      top: 80,
      right: 250,
      height: 20,
      x: 50,
      y: 80,
      toJSON: () => {},
    });

    act(() => {
      result.current.updateDropdownPos(mockInput);
    });

    const pos1 = result.current.dropdownPos;

    act(() => {
      result.current.updateDropdownPos(mockInput);
    });

    const pos2 = result.current.dropdownPos;
    expect(pos1).toBe(pos2);
  });

  it('dismisses active dropdown on outside click, but preserves when clicking input or popup element', () => {
    const { result } = renderHook(() => useAutocompletePortal('test-portal'));

    const portalElem = document.createElement('div');
    portalElem.id = 'test-portal';
    const mockInput = document.createElement('input');
    document.body.appendChild(portalElem);
    document.body.appendChild(mockInput);

    act(() => {
      result.current.handleInputFocusOrChange(mockInput, 'row-1', 'value');
    });
    expect(result.current.activeDropdown).toEqual({ rowId: 'row-1', field: 'value' });

    // Click inside popup element -> stays active
    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      portalElem.dispatchEvent(event);
    });
    expect(result.current.activeDropdown).not.toBeNull();

    // Click inside active input -> stays active
    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      mockInput.dispatchEvent(event);
    });
    expect(result.current.activeDropdown).not.toBeNull();

    // Click outside -> dismissed
    const outsideElem = document.createElement('div');
    document.body.appendChild(outsideElem);
    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      outsideElem.dispatchEvent(event);
    });
    expect(result.current.activeDropdown).toBeNull();

    document.body.removeChild(portalElem);
    document.body.removeChild(mockInput);
    document.body.removeChild(outsideElem);
  });

  it('updates position on scroll and resize events when dropdown is active', () => {
    const { result } = renderHook(() => useAutocompletePortal('test-portal'));

    const mockInput = document.createElement('input');
    let rectBottom = 100;
    vi.spyOn(mockInput, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: rectBottom,
      left: 50,
      width: 200,
      top: 80,
      right: 250,
      height: 20,
      x: 50,
      y: 80,
      toJSON: () => {},
    }));

    act(() => {
      result.current.handleInputFocusOrChange(mockInput, 'row-1', 'key');
    });

    rectBottom = 150;

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.dropdownPos?.top).toBe(154 + window.scrollY);

    rectBottom = 180;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.dropdownPos?.top).toBe(184 + window.scrollY);
  });
});
