import React from 'react';
import { SuggestionItem } from './terminalAutocomplete';

export interface HandleTerminalKeyDownOptions {
  e: React.KeyboardEvent<HTMLInputElement>;
  commandHistory: string[];
  historyIndex: number;
  setHistoryIndex: (idx: number) => void;
  setCommandInput: (val: string) => void;
  suggestions?: SuggestionItem[];
  selectedIndex?: number;
  setSelectedIndex?: (idx: number) => void;
  selectedSubIndex?: number;
  setSelectedSubIndex?: React.Dispatch<React.SetStateAction<number>>;
  isDropdownOpen?: boolean;
  setIsDropdownOpen?: (open: boolean) => void;
  setIsNavigatingHistory?: (navigating: boolean) => void;
}

interface HandleTabKeyOptions {
  e: React.KeyboardEvent<HTMLInputElement>;
  isDropdownOpen: boolean;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  selectedSubIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedSubIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsDropdownOpen: (open: boolean) => void;
}

const handleTabKey = (opts: HandleTabKeyOptions) => {
  const {
    e,
    isDropdownOpen,
    suggestions,
    selectedIndex,
    setSelectedIndex,
    setSelectedSubIndex,
    setIsDropdownOpen,
  } = opts;

  if (suggestions.length === 0) return;

  if (!isDropdownOpen) {
    setIsDropdownOpen(true);
    setSelectedIndex(0);
    setSelectedSubIndex(0);
    return;
  }

  const activeIndex = Math.max(0, selectedIndex);
  const activeItem = suggestions[activeIndex];
  const subCount = activeItem?.subItems?.length || 0;

  if (e.shiftKey) {
    if (subCount > 0) {
      setSelectedSubIndex(prev => (prev <= 0 ? subCount - 1 : prev - 1));
    } else {
      setSelectedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      setSelectedSubIndex(0);
    }
  } else if (subCount > 0) {
    setSelectedSubIndex(prev => (prev >= subCount - 1 ? 0 : prev + 1));
  } else {
    setSelectedIndex(prev => (prev >= suggestions.length - 1 ? 0 : prev + 1));
    setSelectedSubIndex(0);
  }
};

interface HandleDropdownKeysOptions {
  e: React.KeyboardEvent<HTMLInputElement>;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  selectedSubIndex: number;
  setSelectedIndex: (idx: number) => void;
  setSelectedSubIndex: React.Dispatch<React.SetStateAction<number>>;
  setCommandInput: (val: string) => void;
  setIsDropdownOpen: (open: boolean) => void;
}

const handleEnterDropdownKey = (
  activeItem: SuggestionItem | undefined,
  selectedSubIndex: number,
  setCommandInput: (val: string) => void,
  setIsDropdownOpen: (open: boolean) => void
) => {
  if (activeItem) {
    if (activeItem.subItems && activeItem.subItems.length > 0) {
      const podName = activeItem.subItems[selectedSubIndex] || activeItem.subItems[0];
      setCommandInput(`kubectl logs ${podName}`);
    } else {
      setCommandInput(activeItem.value);
    }
    setIsDropdownOpen(false);
  }
};

const handleDropdownKeys = (opts: HandleDropdownKeysOptions): boolean => {
  const {
    e,
    suggestions,
    selectedIndex,
    selectedSubIndex,
    setSelectedIndex,
    setSelectedSubIndex,
    setCommandInput,
    setIsDropdownOpen,
  } = opts;

  const activeIndex = Math.max(0, selectedIndex);
  const activeItem = suggestions[activeIndex];
  const subCount = activeItem?.subItems?.length || 0;

  if (e.key === 'ArrowLeft' && subCount > 0) {
    e.preventDefault();
    setSelectedSubIndex(prev => (prev <= 0 ? subCount - 1 : prev - 1));
    return true;
  }
  if (e.key === 'ArrowRight' && subCount > 0) {
    e.preventDefault();
    setSelectedSubIndex(prev => (prev >= subCount - 1 ? 0 : prev + 1));
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const nextIdx = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
    setSelectedIndex(nextIdx);
    setSelectedSubIndex(0);
    return true;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = selectedIndex >= suggestions.length - 1 ? 0 : selectedIndex + 1;
    setSelectedIndex(nextIdx);
    setSelectedSubIndex(0);
    return true;
  }
  if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    handleEnterDropdownKey(activeItem, selectedSubIndex, setCommandInput, setIsDropdownOpen);
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    setIsDropdownOpen(false);
    return true;
  }
  return false;
};

const handleHistoryKeys = (opts: HandleTerminalKeyDownOptions) => {
  const { e, commandHistory, historyIndex, setHistoryIndex, setCommandInput, setIsDropdownOpen, setIsNavigatingHistory } = opts;
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.length === 0) return;
    setIsNavigatingHistory?.(true);
    setIsDropdownOpen?.(false);
    const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(nextIndex);
    setCommandInput(commandHistory[nextIndex]);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex === -1) return;
    setIsNavigatingHistory?.(true);
    setIsDropdownOpen?.(false);
    if (historyIndex === commandHistory.length - 1) {
      setHistoryIndex(-1);
      setCommandInput('');
    } else {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCommandInput(commandHistory[nextIndex]);
    }
  }
};

export const handleTerminalKeyDown = (opts: HandleTerminalKeyDownOptions) => {
  const {
    e,
    suggestions = [],
    selectedIndex = -1,
    setSelectedIndex = () => {},
    selectedSubIndex = 0,
    setSelectedSubIndex = () => {},
    setCommandInput,
    isDropdownOpen = false,
    setIsDropdownOpen = () => {},
  } = opts;

  if (e.key === 'Tab') {
    e.preventDefault();
    handleTabKey({
      e,
      isDropdownOpen,
      suggestions,
      selectedIndex,
      selectedSubIndex,
      setSelectedIndex,
      setSelectedSubIndex,
      setIsDropdownOpen,
    });
    return;
  }

  if (isDropdownOpen && suggestions.length > 0) {
    const handled = handleDropdownKeys({
      e,
      suggestions,
      selectedIndex,
      selectedSubIndex,
      setSelectedIndex,
      setSelectedSubIndex,
      setCommandInput,
      setIsDropdownOpen,
    });
    if (handled) return;
  }

  handleHistoryKeys(opts);
};
