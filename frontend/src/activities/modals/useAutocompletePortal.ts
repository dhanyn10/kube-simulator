import { useState, useEffect, useRef, useCallback } from 'react';

export interface ActiveDropdownState {
  readonly rowId: string;
  readonly field: 'key' | 'value';
}

export interface DropdownPosition {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

/**
 * Custom hook encapsulating portal dropdown positioning, active target tracking, and outside-click/scroll listener logic.
 */
export const useAutocompletePortal = (portalId = 'configmap-autocomplete-portal') => {
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdownState | null>(null);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);

  const updateDropdownPos = useCallback((inputElem: HTMLInputElement) => {
    const rect = inputElem.getBoundingClientRect();
    const newPos = {
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    };
    setDropdownPos((prev) => {
      if (prev && prev.top === newPos.top && prev.left === newPos.left && prev.width === newPos.width) {
        return prev;
      }
      return newPos;
    });
  }, []);

  const handleInputFocusOrChange = useCallback(
    (
      elem: HTMLInputElement,
      rowId: string,
      field: 'key' | 'value',
      onValueChange?: (rowId: string, field: 'key' | 'value', val: string) => void,
      value?: string
    ) => {
      if (value !== undefined && onValueChange) {
        onValueChange(rowId, field, value);
      }
      activeInputRef.current = elem;
      updateDropdownPos(elem);
      setActiveDropdown({ rowId, field });
    },
    [updateDropdownPos]
  );

  useEffect(() => {
    if (!activeDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const popupElem = document.getElementById(portalId);
      if (
        popupElem &&
        !popupElem.contains(e.target as Node) &&
        activeInputRef.current &&
        !activeInputRef.current.contains(e.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    const handleScrollOrResize = () => {
      if (activeInputRef.current) {
        updateDropdownPos(activeInputRef.current);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeDropdown, portalId, updateDropdownPos]);

  return {
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    activeInputRef,
    updateDropdownPos,
    handleInputFocusOrChange,
  };
};
