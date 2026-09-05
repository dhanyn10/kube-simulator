import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { AutocompleteDropdown, AutocompleteSuggestion } from '@/components/UI/AutocompleteDropdown';

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

  it('toggles detailed description accordion on info button click', () => {
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    const infoBtns = screen.getAllByTitle('Toggle detailed description');
    expect(infoBtns.length).toBeGreaterThan(0);

    fireEvent.mouseDown(infoBtns[0]);
    expect(screen.getByText('Detailed Information')).toBeInTheDocument();
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

  it('triggers onHoverIndex when mouse enters an item', () => {
    const onHoverMock = vi.fn();
    render(
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
  });
});
