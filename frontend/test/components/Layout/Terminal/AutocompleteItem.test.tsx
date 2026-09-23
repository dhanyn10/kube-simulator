import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutocompleteItem } from '@/components/Layout/Terminal/AutocompleteItem';
import { SuggestionItem } from '@/activities/terminal/terminalAutocomplete';
import '@testing-library/jest-dom';

describe('AutocompleteItem', () => {
  const sampleItemWithDesc: SuggestionItem = {
    value: 'kubectl get pods',
    label: 'kubectl get pods',
    category: 'Command',
    description: 'List all pods on the active canvas',
  };

  const sampleDisabledItem: SuggestionItem = {
    value: 'kubectl scale deployment/',
    label: 'scale deployment/',
    category: 'Subcommand',
    description: 'Scale deployment replicas',
    disabled: true,
    disabledReason: '(no Deployment on canvas)',
  };

  const sampleItemWithSubItems: SuggestionItem = {
    value: 'kubectl logs',
    label: 'kubectl logs',
    category: 'Subcommand',
    subItems: ['pod-alpha', 'pod-beta'],
  };

  it('renders unselected item in dark mode and handles hover & main button click', () => {
    const onSelectSuggestion = vi.fn();
    const { container } = render(
      <AutocompleteItem
        item={sampleItemWithDesc}
        index={0}
        isSelected={false}
        isDark={true}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const mainBtn = screen.getByTestId('autocomplete-item-0');
    expect(mainBtn).toBeInTheDocument();
    expect(screen.getByText('kubectl get pods')).toBeInTheDocument();
    expect(screen.queryByText('List all pods on the active canvas')).not.toBeInTheDocument();

    const itemWrapper = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(itemWrapper);
    fireEvent.mouseLeave(itemWrapper);

    fireEvent.click(mainBtn);
    expect(onSelectSuggestion).toHaveBeenCalledWith(sampleItemWithDesc);
  });

  it('renders disabled item and prevents clicks', () => {
    const onSelectSuggestion = vi.fn();
    render(
      <AutocompleteItem
        item={sampleDisabledItem}
        index={0}
        isSelected={false}
        isDark={true}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const mainBtn = screen.getByTestId('autocomplete-item-0');
    expect(mainBtn).toBeDisabled();

    fireEvent.click(mainBtn);
    expect(onSelectSuggestion).not.toHaveBeenCalled();
  });

  it('renders selected item in light mode and handles info toggle button click', () => {
    const onSelectSuggestion = vi.fn();
    render(
      <AutocompleteItem
        item={sampleItemWithDesc}
        index={0}
        isSelected={true}
        isDark={false}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const infoBtn = screen.getByTestId('autocomplete-info-btn-0');
    expect(infoBtn).toBeInTheDocument();

    fireEvent.click(infoBtn);
    expect(screen.getByTestId('autocomplete-description-accordion-0')).toBeInTheDocument();
    expect(screen.getByText('Detailed Information')).toBeInTheDocument();

    fireEvent.click(infoBtn);
    expect(screen.queryByTestId('autocomplete-description-accordion-0')).not.toBeInTheDocument();
  });

  it('renders sub-items accordion in dark mode when item has subItems', () => {
    const onSelectSuggestion = vi.fn();
    render(
      <AutocompleteItem
        item={sampleItemWithSubItems}
        index={1}
        isSelected={true}
        isDark={true}
        selectedSubIndex={1}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    expect(screen.getByTestId('autocomplete-subitems-accordion-1')).toBeInTheDocument();
    const subAlpha = screen.getByTestId('autocomplete-subitem-0');
    const subBeta = screen.getByTestId('autocomplete-subitem-1');

    expect(subAlpha).toBeInTheDocument();
    expect(subBeta).toBeInTheDocument();

    fireEvent.click(subBeta);
    expect(onSelectSuggestion).toHaveBeenCalledWith(sampleItemWithSubItems, 'pod-beta');
  });
});
