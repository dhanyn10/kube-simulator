import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { handleTerminalKeyDown } from '../../../src/activity/terminal/terminalKeyDown';
import { SuggestionItem } from '../../../src/activity/terminal/terminalAutocomplete';

const createKeyboardEvent = (key: string, shiftKey = false) => {
  const preventDefault = vi.fn();
  return {
    key,
    shiftKey,
    preventDefault,
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
};

describe('terminalKeyDown', () => {
  const suggestionsWithSubItems: SuggestionItem[] = [
    {
      value: 'kubectl logs',
      label: 'kubectl logs',
      category: 'logs',
      subItems: ['pod-alpha', 'pod-beta'],
    },
    {
      value: 'kubectl get pods',
      label: 'kubectl get pods',
      category: 'get',
    },
  ];

  const suggestionsSimple: SuggestionItem[] = [
    { value: 'kubectl get pods', label: 'kubectl get pods', category: 'get' },
    { value: 'kubectl get svc', label: 'kubectl get svc', category: 'get' },
  ];

  it('handles default parameter fallbacks when options are omitted', () => {
    const e = createKeyboardEvent('Tab');
    handleTerminalKeyDown({
      e,
      commandHistory: [],
      historyIndex: -1,
      setHistoryIndex: vi.fn(),
      setCommandInput: vi.fn(),
    });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  describe('Tab Key Handling', () => {
    it('returns early if suggestions is empty on Tab', () => {
      const e = createKeyboardEvent('Tab');
      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: [],
      });
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('opens dropdown if Tab is pressed when closed', () => {
      const e = createKeyboardEvent('Tab');
      const setIsDropdownOpen = vi.fn();
      const setSelectedIndex = vi.fn();
      const setSelectedSubIndex = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        isDropdownOpen: false,
        setIsDropdownOpen,
        setSelectedIndex,
        setSelectedSubIndex,
      });

      expect(setIsDropdownOpen).toHaveBeenCalledWith(true);
      expect(setSelectedIndex).toHaveBeenCalledWith(0);
      expect(setSelectedSubIndex).toHaveBeenCalledWith(0);
    });

    it('cycles forward through subItems with Tab when item has subItems', () => {
      const e = createKeyboardEvent('Tab');
      let capturedStateSetter: any;
      const setSelectedSubIndex = vi.fn((fn) => {
        capturedStateSetter = fn;
      });

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsWithSubItems,
        selectedIndex: 0,
        selectedSubIndex: 0,
        isDropdownOpen: true,
        setSelectedSubIndex,
      });

      expect(setSelectedSubIndex).toHaveBeenCalled();
      // subCount = 2 (0 -> 1, 1 -> 0)
      expect(capturedStateSetter(0)).toBe(1);
      expect(capturedStateSetter(1)).toBe(0);
    });

    it('cycles forward through main items with Tab when no subItems', () => {
      const e = createKeyboardEvent('Tab');
      let capturedStateSetter: any;
      const setSelectedIndex = vi.fn((fn) => {
        capturedStateSetter = fn;
      });

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setSelectedIndex,
      });

      expect(setSelectedIndex).toHaveBeenCalled();
      // length = 2 (0 -> 1, 1 -> 0)
      expect(capturedStateSetter(0)).toBe(1);
      expect(capturedStateSetter(1)).toBe(0);
    });

    it('cycles backward with Shift+Tab on subItems', () => {
      const e = createKeyboardEvent('Tab', true);
      let capturedSubSetter: any;
      const setSelectedSubIndex = vi.fn((fn) => {
        capturedSubSetter = fn;
      });

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsWithSubItems,
        selectedIndex: 0,
        selectedSubIndex: 1,
        isDropdownOpen: true,
        setSelectedSubIndex,
      });

      expect(setSelectedSubIndex).toHaveBeenCalled();
      expect(capturedSubSetter(1)).toBe(0);
      expect(capturedSubSetter(0)).toBe(1);
    });

    it('cycles backward with Shift+Tab on main items', () => {
      const e = createKeyboardEvent('Tab', true);
      let capturedMainSetter: any;
      const setSelectedIndex = vi.fn((fn) => {
        capturedMainSetter = fn;
      });

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 1,
        isDropdownOpen: true,
        setSelectedIndex,
      });

      expect(setSelectedIndex).toHaveBeenCalled();
      expect(capturedMainSetter(1)).toBe(0);
      expect(capturedMainSetter(0)).toBe(1);
    });
  });

  describe('Dropdown Arrow & Enter Keys', () => {
    it('navigates left and right through subItems with ArrowLeft and ArrowRight', () => {
      const eLeft = createKeyboardEvent('ArrowLeft');
      let capturedSubSetter: any;
      const setSelectedSubIndex = vi.fn((fn) => {
        capturedSubSetter = fn;
      });

      handleTerminalKeyDown({
        e: eLeft,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsWithSubItems,
        selectedIndex: 0,
        selectedSubIndex: 1,
        isDropdownOpen: true,
        setSelectedSubIndex,
      });

      expect(eLeft.preventDefault).toHaveBeenCalled();
      expect(capturedSubSetter(1)).toBe(0);
      expect(capturedSubSetter(0)).toBe(1);

      const eRight = createKeyboardEvent('ArrowRight');
      handleTerminalKeyDown({
        e: eRight,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsWithSubItems,
        selectedIndex: 0,
        selectedSubIndex: 0,
        isDropdownOpen: true,
        setSelectedSubIndex,
      });

      expect(eRight.preventDefault).toHaveBeenCalled();
      expect(capturedSubSetter(0)).toBe(1);
      expect(capturedSubSetter(1)).toBe(0);
    });

    it('navigates up and down through main suggestions with ArrowUp and ArrowDown', () => {
      const eUp = createKeyboardEvent('ArrowUp');
      const setSelectedIndex = vi.fn();
      const setSelectedSubIndex = vi.fn();

      handleTerminalKeyDown({
        e: eUp,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setSelectedIndex,
        setSelectedSubIndex,
      });

      expect(eUp.preventDefault).toHaveBeenCalled();
      expect(setSelectedIndex).toHaveBeenCalledWith(1); // 0 -> length-1

      const eDown = createKeyboardEvent('ArrowDown');
      handleTerminalKeyDown({
        e: eDown,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 1,
        isDropdownOpen: true,
        setSelectedIndex,
        setSelectedSubIndex,
      });

      expect(eDown.preventDefault).toHaveBeenCalled();
      expect(setSelectedIndex).toHaveBeenCalledWith(0); // 1 -> 0
    });

    it('navigates up and down when selectedIndex is in middle', () => {
      const eUp = createKeyboardEvent('ArrowUp');
      const setSelectedIndex = vi.fn();

      handleTerminalKeyDown({
        e: eUp,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 1,
        isDropdownOpen: true,
        setSelectedIndex,
      });

      expect(setSelectedIndex).toHaveBeenCalledWith(0);

      const eDown = createKeyboardEvent('ArrowDown');
      handleTerminalKeyDown({
        e: eDown,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setSelectedIndex,
      });

      expect(setSelectedIndex).toHaveBeenCalledWith(1);
    });

    it('handles Enter key on subItem suggestion', () => {
      const e = createKeyboardEvent('Enter');
      const setCommandInput = vi.fn();
      const setIsDropdownOpen = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsWithSubItems,
        selectedIndex: 0,
        selectedSubIndex: 1,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setCommandInput).toHaveBeenCalledWith('kubectl logs pod-beta');
      expect(setIsDropdownOpen).toHaveBeenCalledWith(false);
    });

    it('handles Enter key on subItem suggestion with fallback when index out of bounds', () => {
      const e = createKeyboardEvent('Enter');
      const setCommandInput = vi.fn();
      const setIsDropdownOpen = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsWithSubItems,
        selectedIndex: 0,
        selectedSubIndex: 99, // Out of bounds
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(setCommandInput).toHaveBeenCalledWith('kubectl logs pod-alpha');
    });

    it('handles Enter key when activeItem is undefined', () => {
      const e = createKeyboardEvent('Enter');
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsSimple,
        selectedIndex: 99, // Out of bounds, activeItem is undefined
        isDropdownOpen: true,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setCommandInput).not.toHaveBeenCalled();
    });

    it('handles Enter key on simple suggestion without subItems', () => {
      const e = createKeyboardEvent('Enter');
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
      });

      expect(setCommandInput).toHaveBeenCalledWith('kubectl get pods');
    });

    it('handles Escape key to close dropdown', () => {
      const e = createKeyboardEvent('Escape');
      const setIsDropdownOpen = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setIsDropdownOpen).toHaveBeenCalledWith(false);
    });

    it('falls through on unhandled keys in dropdown mode', () => {
      const e = createKeyboardEvent('KeyA');
      const setIsDropdownOpen = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1'],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: vi.fn(),
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('History Traversal Keys', () => {
    it('handles ArrowUp to navigate backward in history when optional callbacks are omitted', () => {
      const e = createKeyboardEvent('ArrowUp');
      const setHistoryIndex = vi.fn();
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1', 'cmd2', 'cmd3'],
        historyIndex: -1,
        setHistoryIndex,
        setCommandInput,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setHistoryIndex).toHaveBeenCalledWith(2);
      expect(setCommandInput).toHaveBeenCalledWith('cmd3');
    });

    it('handles ArrowUp when historyIndex is already pointing to an item', () => {
      const e = createKeyboardEvent('ArrowUp');
      const setHistoryIndex = vi.fn();
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1', 'cmd2', 'cmd3'],
        historyIndex: 2,
        setHistoryIndex,
        setCommandInput,
      });

      expect(setHistoryIndex).toHaveBeenCalledWith(1);
      expect(setCommandInput).toHaveBeenCalledWith('cmd2');
    });

    it('does nothing on ArrowUp when commandHistory is empty', () => {
      const e = createKeyboardEvent('ArrowUp');
      const setHistoryIndex = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex,
        setCommandInput: vi.fn(),
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setHistoryIndex).not.toHaveBeenCalled();
    });

    it('handles ArrowDown when navigating history forward', () => {
      const e = createKeyboardEvent('ArrowDown');
      const setHistoryIndex = vi.fn();
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1', 'cmd2'],
        historyIndex: 0,
        setHistoryIndex,
        setCommandInput,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setHistoryIndex).toHaveBeenCalledWith(1);
      expect(setCommandInput).toHaveBeenCalledWith('cmd2');
    });

    it('handles ArrowDown when at the latest history item to reset input', () => {
      const e = createKeyboardEvent('ArrowDown');
      const setHistoryIndex = vi.fn();
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1', 'cmd2'],
        historyIndex: 1,
        setHistoryIndex,
        setCommandInput,
      });

      expect(setHistoryIndex).toHaveBeenCalledWith(-1);
      expect(setCommandInput).toHaveBeenCalledWith('');
    });

    it('does nothing on ArrowDown when historyIndex is -1', () => {
      const e = createKeyboardEvent('ArrowDown');
      const setHistoryIndex = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1'],
        historyIndex: -1,
        setHistoryIndex,
        setCommandInput: vi.fn(),
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setHistoryIndex).not.toHaveBeenCalled();
    });
  });
});
