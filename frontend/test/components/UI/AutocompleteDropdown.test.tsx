import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { AutocompleteDropdown, AutocompleteSuggestion } from '@/components/UI/AutocompleteDropdown';
import * as autocompleteUtils from '@/lib/autocompleteUtils';

describe('AutocompleteDropdown component', () => {
  const mockSuggestions: AutocompleteSuggestion[] = [
    {
      label: 'pods',
      value: 'pods',
      category: 'RBAC',
      description: 'Kubernetes Pods resource',
    },
    {
      label: 'services',
      value: 'services',
      category: 'add to canvas',
      description: 'Kubernetes Services resource',
    },
    {
      label: 'deployments',
      value: 'deployments',
      subItems: ['pod-1', 'pod-2'],
    },
  ];

  it('returns null when suggestions list is empty', () => {
    const { container } = render(
      <AutocompleteDropdown
        suggestions={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders suggestions list with labels, category badges, and optional icons', () => {
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
        showIcon={true}
        colorMode="dark"
      />
    );

    expect(screen.getByText('pods')).toBeInTheDocument();
    expect(screen.getByText('services')).toBeInTheDocument();
    expect(screen.getByText('add to canvas')).toBeInTheDocument();
  });

  it('handles item selection on mouse down', () => {
    const onSelectMock = vi.fn();
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={onSelectMock}
      />
    );

    const firstItem = screen.getByText('pods');
    fireEvent.mouseDown(firstItem);

    expect(onSelectMock).toHaveBeenCalledWith(mockSuggestions[0]);
  });

  it('renders accordion sub-items when provided and handles sub-item click', () => {
    const onSelectMock = vi.fn();
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={2}
        selectedSubIndex={0}
        onSelect={onSelectMock}
      />
    );

    expect(screen.getByText('pod-1')).toBeInTheDocument();
    expect(screen.getByText('pod-2')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('pod-1'));
    expect(onSelectMock).toHaveBeenCalledWith(mockSuggestions[2], 'pod-1');
  });

  it('toggles detailed description accordion open and closed on info button click and tests info button selected style in dark and light modes', () => {
    const { rerender } = render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
        colorMode="dark"
      />
    );

    const infoBtns = screen.getAllByTitle('Toggle detailed description');
    expect(infoBtns.length).toBeGreaterThan(0);

    // Selected item's info button should have selected class
    expect(infoBtns[0].className).toContain('hover:bg-indigo-700');

    // Toggle open in dark mode
    fireEvent.mouseDown(infoBtns[0]);
    expect(screen.getByText('Detailed Information')).toBeInTheDocument();

    // Rerender in light mode while open to cover light mode branch
    rerender(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
        colorMode="light"
      />
    );
    expect(screen.getByText('Detailed Information')).toBeInTheDocument();

    // Toggle closed
    fireEvent.mouseDown(infoBtns[0]);
    expect(screen.queryByText('Detailed Information')).not.toBeInTheDocument();
  });

  it('does not render detailed information accordion if isMeaningful is false even if activeInfoIndex matches', () => {
    const meaningfulSuggestions: AutocompleteSuggestion[] = [
      {
        label: 'pods',
        value: 'pods',
        description: 'Kubernetes Pods resource',
      },
    ];

    const unmeaningfulSuggestions: AutocompleteSuggestion[] = [
      {
        label: 'pods',
        value: 'pods',
        description: 'pods', // checkMeaningfulDescription returns false
      },
    ];

    const { rerender } = render(
      <AutocompleteDropdown
        suggestions={meaningfulSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    // Click info button to set activeInfoIndex = 0 (isInfoOpen = true)
    const infoBtn = screen.getByTitle('Toggle detailed description');
    fireEvent.mouseDown(infoBtn);
    expect(screen.getByText('Detailed Information')).toBeInTheDocument();

    // Rerender with unmeaningful suggestion while activeInfoIndex is still 0
    rerender(
      <AutocompleteDropdown
        suggestions={unmeaningfulSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Toggle detailed description')).toBeNull();
    expect(screen.queryByText('Detailed Information')).not.toBeInTheDocument();
  });

  it('renders selected sub-item styling when item and sub-item are selected', () => {
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={2}
        selectedSubIndex={0}
        onSelect={vi.fn()}
      />
    );

    const subItem = screen.getByText('pod-1');
    expect(subItem.className).toContain('bg-indigo-600');
  });

  it('supports light mode styling and upward positioning class', () => {
    const { container } = render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
        colorMode="light"
        openUpward={true}
      />
    );

    const dropdown = container.firstChild as HTMLElement;
    expect(dropdown.className).toContain('bottom-full');
    expect(dropdown.className).toContain('bg-white');
  });

  it('triggers onHoverIndex when mouse enters an item and handles mouse enter when onHoverIndex is omitted', () => {
    const onHoverMock = vi.fn();
    const { rerender } = render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
        onHoverIndex={onHoverMock}
      />
    );

    const secondItemRow = screen.getByText('services').closest('.group') as HTMLElement;
    fireEvent.mouseEnter(secondItemRow);

    expect(onHoverMock).toHaveBeenCalledWith(1);

    // Test mouse enter when onHoverIndex prop is omitted / undefined
    rerender(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );
    expect(() => fireEvent.mouseEnter(secondItemRow)).not.toThrow();
  });

  it('invokes centerDropdownItem helper on mount and when selectedIndex updates', () => {
    const centerSpy = vi.spyOn(autocompleteUtils, 'centerDropdownItem');
    const { rerender } = render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(centerSpy).toHaveBeenCalledWith(expect.anything(), 0, 3);

    rerender(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={1}
        onSelect={vi.fn()}
      />
    );

    expect(centerSpy).toHaveBeenCalledWith(expect.anything(), 1, 3);
  });
});
