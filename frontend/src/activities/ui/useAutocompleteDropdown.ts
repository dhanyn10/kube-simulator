import { useState, useEffect, useRef } from 'react';
import { centerDropdownItem } from '@/lib/autocompleteUtils';

export interface UseAutocompleteDropdownProps {
  selectedIndex: number;
  suggestionsLength: number;
}

export const useAutocompleteDropdown = ({
  selectedIndex,
  suggestionsLength,
}: UseAutocompleteDropdownProps) => {
  const [activeInfoIndex, setActiveInfoIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    centerDropdownItem(containerRef.current, selectedIndex, suggestionsLength);
  }, [selectedIndex, suggestionsLength]);

  return {
    activeInfoIndex,
    setActiveInfoIndex,
    containerRef,
  };
};
