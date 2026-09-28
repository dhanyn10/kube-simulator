import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutocompleteDropdown } from '@/activities/ui/useAutocompleteDropdown';

describe('useAutocompleteDropdown', () => {
  it('manages active info index', () => {
    const { result } = renderHook(() =>
      useAutocompleteDropdown({ selectedIndex: 0, suggestionsLength: 5 })
    );

    expect(result.current.activeInfoIndex).toBeNull();

    act(() => {
      result.current.setActiveInfoIndex(2);
    });

    expect(result.current.activeInfoIndex).toBe(2);
  });
});
