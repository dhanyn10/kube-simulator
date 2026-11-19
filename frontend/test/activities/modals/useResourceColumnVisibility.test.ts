import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useResourceColumnVisibility,
  getInitialResourceColumnVisibility,
  saveResourceColumnVisibility,
} from '@/activities/modals/useResourceColumnVisibility';

describe('useResourceColumnVisibility', () => {
  const mockStorageKey = 'test_col_key';

  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getInitialResourceColumnVisibility', () => {
    it('returns default { profile: true, component: true } when storage is empty or invalid', () => {
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: true,
        component: true,
      });

      globalThis.localStorage.setItem(mockStorageKey, 'invalid-json');
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: true,
        component: true,
      });

      globalThis.localStorage.setItem(mockStorageKey, JSON.stringify({ profile: 'not-bool' }));
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: true,
        component: true,
      });
    });

    it('returns parsed visibility when valid json is in storage', () => {
      globalThis.localStorage.setItem(mockStorageKey, JSON.stringify({ profile: false, component: true }));
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: false,
        component: true,
      });
    });
  });

  describe('saveResourceColumnVisibility', () => {
    it('saves visibility JSON to localStorage', () => {
      saveResourceColumnVisibility(mockStorageKey, { profile: false, component: false });
      const stored = JSON.parse(globalThis.localStorage.getItem(mockStorageKey) || '{}');
      expect(stored).toEqual({ profile: false, component: false });
    });
  });

  describe('useResourceColumnVisibility hook', () => {
    it('initializes and toggles column visibility state and persists to storage', () => {
      const { result } = renderHook(() => useResourceColumnVisibility(mockStorageKey));

      expect(result.current.columns).toEqual({ profile: true, component: true });

      act(() => {
        result.current.toggleColumn('profile');
      });

      expect(result.current.columns.profile).toBe(false);
      expect(result.current.columns.component).toBe(true);
      const storedAfterProfile = JSON.parse(globalThis.localStorage.getItem(mockStorageKey) || '{}');
      expect(storedAfterProfile.profile).toBe(false);

      act(() => {
        result.current.toggleColumn('component');
      });

      expect(result.current.columns.component).toBe(false);
      const storedAfterComponent = JSON.parse(globalThis.localStorage.getItem(mockStorageKey) || '{}');
      expect(storedAfterComponent.component).toBe(false);
    });
  });
});
