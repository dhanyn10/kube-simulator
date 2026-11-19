import { useState } from 'react';

export interface ResourceColumnVisibility {
  profile: boolean;
  component: boolean;
}

/**
 * Retrieves the stored column visibility preference from localStorage,
 * falling back to default { profile: true, component: true }.
 */
export const getInitialResourceColumnVisibility = (
  storageKey: string
): ResourceColumnVisibility => {
  if (globalThis.localStorage !== undefined) {
    const saved = globalThis.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.profile === 'boolean' && typeof parsed?.component === 'boolean') {
          return parsed;
        }
      } catch {
        // Fallback to default
      }
    }
  }
  return { profile: true, component: true };
};

/**
 * Safely persists column visibility preferences to localStorage.
 */
export const saveResourceColumnVisibility = (
  storageKey: string,
  visibility: ResourceColumnVisibility
): void => {
  if (globalThis.localStorage !== undefined) {
    globalThis.localStorage.setItem(storageKey, JSON.stringify(visibility));
  }
};

/**
 * Custom hook to manage resource column visibility state and persistence.
 */
export const useResourceColumnVisibility = (storageKey: string) => {
  const [columns, setColumns] = useState<ResourceColumnVisibility>(() =>
    getInitialResourceColumnVisibility(storageKey)
  );

  const toggleColumn = (key: keyof ResourceColumnVisibility) => {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveResourceColumnVisibility(storageKey, next);
      return next;
    });
  };

  return {
    columns,
    toggleColumn,
  };
};
