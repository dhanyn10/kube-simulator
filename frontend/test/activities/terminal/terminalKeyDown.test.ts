import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { handleTerminalKeyDown } from '@/activities/terminal/terminalKeyDown';
import { SuggestionItem } from '@/activities/terminal/terminalAutocomplete';

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
      value: 'kubectl logs pod-alpha',
      label: 'kubectl logs',
      category: 'Subcommand',
      subItems: ['pod-alpha', 'pod-beta'],
    },
    {
      value: 'kubectl get pods',
      label: 'kubectl get pods',
      category: 'Command',
    },
  ];

  const suggestionsSimple: SuggestionItem[] = [
    { value: 'kubectl get pods', label: 'get pods', category: 'Command' },
    { value: 'kubectl get svc', label: 'get svc', category: 'Command' },
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
      const setCommandInput = vi.fn();
      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: [],
      });
      expect(e.preventDefault).toHaveBeenCalled();
      expect(setCommandInput).not.toHaveBeenCalled();
    });

    it('completes top suggestion on Tab key press', () => {
      const e = createKeyboardEvent('Tab');
      const setCommandInput = vi.fn();
      const setIsDropdownOpen = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setCommandInput).toHaveBeenCalledWith('kubectl get pods');
      expect(setIsDropdownOpen).toHaveBeenCalledWith(false);
    });

    it('completes selected suggestion on Tab key press when navigated', () => {
      const e = createKeyboardEvent('Tab');
      const setCommandInput = vi.fn();
      const setIsDropdownOpen = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsSimple,
        selectedIndex: 1,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setCommandInput).toHaveBeenCalledWith('kubectl get svc');
      expect(setIsDropdownOpen).toHaveBeenCalledWith(false);
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
      expect(setSelectedIndex).toHaveBeenCalledWith(1);

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
      expect(setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('handles Enter key on subItem suggestion and simple suggestion', () => {
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

      // Simple item without subItems on Enter
      const eSimple = createKeyboardEvent('Enter');
      const setCommandInputSimple = vi.fn();
      handleTerminalKeyDown({
        e: eSimple,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput: setCommandInputSimple,
        suggestions: suggestionsSimple,
        selectedIndex: 0,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });
      expect(setCommandInputSimple).toHaveBeenCalledWith('kubectl get pods');
    });

    it('handles Tab key on suggestion with subItems', () => {
      const e = createKeyboardEvent('Tab');
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
        selectedSubIndex: 0,
        isDropdownOpen: true,
        setIsDropdownOpen,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setCommandInput).toHaveBeenCalledWith('kubectl logs pod-alpha');
      expect(setIsDropdownOpen).toHaveBeenCalledWith(false);
    });

    it('ignores Enter when selectedIndex is negative', () => {
      const e = createKeyboardEvent('Enter');
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: [],
        historyIndex: -1,
        setHistoryIndex: vi.fn(),
        setCommandInput,
        suggestions: suggestionsSimple,
        selectedIndex: -1,
        isDropdownOpen: true,
      });

      expect(setCommandInput).not.toHaveBeenCalled();
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
  });

  describe('History Traversal Keys', () => {
    it('handles ArrowUp to navigate backward in history', () => {
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

    it('handles ArrowDown when navigating history forward and resetting at boundary', () => {
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

      // Boundary reset when historyIndex is at last item
      const eEnd = createKeyboardEvent('ArrowDown');
      const setHistoryIndexEnd = vi.fn();
      const setCommandInputEnd = vi.fn();

      handleTerminalKeyDown({
        e: eEnd,
        commandHistory: ['cmd1', 'cmd2'],
        historyIndex: 1,
        setHistoryIndex: setHistoryIndexEnd,
        setCommandInput: setCommandInputEnd,
      });

      expect(setHistoryIndexEnd).toHaveBeenCalledWith(-1);
      expect(setCommandInputEnd).toHaveBeenCalledWith('');
    });

    it('returns early on ArrowDown when historyIndex is -1', () => {
      const e = createKeyboardEvent('ArrowDown');
      const setHistoryIndex = vi.fn();
      const setCommandInput = vi.fn();

      handleTerminalKeyDown({
        e,
        commandHistory: ['cmd1'],
        historyIndex: -1,
        setHistoryIndex,
        setCommandInput,
      });

      expect(e.preventDefault).toHaveBeenCalled();
      expect(setHistoryIndex).not.toHaveBeenCalled();
      expect(setCommandInput).not.toHaveBeenCalled();
    });

    it('returns early on ArrowUp when commandHistory is empty', () => {
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
  });
});
