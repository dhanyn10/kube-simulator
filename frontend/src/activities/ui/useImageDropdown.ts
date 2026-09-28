import { useState, useRef, useEffect, useMemo } from 'react';
import { useFlowStore } from '@/store';
import { filterImageOptions } from './imageDropdownHelpers';

export interface UseImageDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export const useImageDropdown = ({ value, onChange }: UseImageDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const customImages = useFlowStore((state) => state.customImages);
  const addCustomImage = useFlowStore((state) => state.addCustomImage);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target;
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredOptions = useMemo(
    () => filterImageOptions(search, customImages),
    [search, customImages]
  );

  const handleSelectOption = (imgName: string) => {
    onChange(imgName);
    setIsOpen(false);
    setSearch('');
  };

  const handleUseCustomImage = () => {
    if (!search.trim()) return;
    const img = search.trim();
    addCustomImage(img);
    handleSelectOption(img);
  };

  return {
    isOpen,
    setIsOpen,
    search,
    setSearch,
    dropdownRef,
    inputRef,
    filteredOptions,
    handleSelectOption,
    handleUseCustomImage,
  };
};
