import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutocompleteItem } from '@/components/Terminal/AutocompleteItem';
import { SuggestionItem } from '@/activities/terminal/terminalAutocomplete';
import { useFlowStore } from '@/store';
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

  const samplePodItem: SuggestionItem = {
    value: 'kubectl describe pod api-pod',
    label: 'api-pod',
    category: 'Pod',
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

  it('renders disabled item in dark mode and prevents clicks', () => {
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

  it('renders disabled item in light mode with appropriate theme classes', () => {
    const onSelectSuggestion = vi.fn();
    const { container } = render(
      <AutocompleteItem
        item={sampleDisabledItem}
        index={0}
        isSelected={false}
        isDark={false}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const itemWrapper = container.firstChild as HTMLElement;
    expect(itemWrapper.className).toContain('text-slate-400');
    expect(itemWrapper.className).toContain('border-slate-100');

    const badge = screen.getByText('Subcommand');
    expect(badge.className).toContain('bg-slate-100 text-slate-400');
  });

  it('renders unselected item in light mode with hover and info toggle classes', () => {
    const onSelectSuggestion = vi.fn();
    const onHoverIndex = vi.fn();
    const { container } = render(
      <AutocompleteItem
        item={sampleItemWithDesc}
        index={2}
        isSelected={false}
        isDark={false}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
        onHoverIndex={onHoverIndex}
      />
    );

    const itemWrapper = container.firstChild as HTMLElement;
    expect(itemWrapper.className).toContain('hover:bg-slate-50');
    expect(itemWrapper.className).toContain('text-slate-700');

    const badge = screen.getByText('Command');
    expect(badge.className).toContain('bg-slate-100 text-slate-500');

    fireEvent.mouseEnter(itemWrapper);
    expect(onHoverIndex).toHaveBeenCalledWith(2);

    const infoBtn = screen.getByTestId('autocomplete-info-btn-2');
    expect(infoBtn.className).toContain('hover:bg-slate-200');

    fireEvent.click(infoBtn);
    const accordion = screen.getByTestId('autocomplete-description-accordion-2');
    expect(accordion.className).toContain('bg-slate-100/90 text-slate-700 border-slate-200');
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

  it('handles item with subItems when selectedSubIndex is out of bounds', () => {
    const onSelectSuggestion = vi.fn();
    render(
      <AutocompleteItem
        item={sampleItemWithSubItems}
        index={1}
        isSelected={true}
        isDark={true}
        selectedSubIndex={99}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    expect(screen.getByTestId('autocomplete-subitems-accordion-1')).toBeInTheDocument();
  });

  it('renders sub-items accordion in light mode and handles sub-item hover events', () => {
    const onSelectSuggestion = vi.fn();
    render(
      <AutocompleteItem
        item={sampleItemWithSubItems}
        index={3}
        isSelected={true}
        isDark={false}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const subAlpha = screen.getByTestId('autocomplete-subitem-0');
    const subBeta = screen.getByTestId('autocomplete-subitem-1');

    expect(subAlpha.className).toContain('bg-blue-600 text-white');
    expect(subBeta.className).toContain('bg-white text-slate-700');

    fireEvent.mouseEnter(subBeta);
    expect(useFlowStore.getState().hoveredAutocompletePodName).toBe('pod-beta');

    fireEvent.mouseLeave(subBeta);
  });

  it('handles item with category Pod and sets hovered pod name', () => {
    const onSelectSuggestion = vi.fn();
    const onHoverIndex = vi.fn();
    const { container } = render(
      <AutocompleteItem
        item={samplePodItem}
        index={4}
        isSelected={true}
        isDark={true}
        selectedSubIndex={-1}
        onSelectSuggestion={onSelectSuggestion}
        onHoverIndex={onHoverIndex}
      />
    );

    expect(useFlowStore.getState().hoveredAutocompletePodName).toBe('api-pod');

    const itemWrapper = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(itemWrapper);
    expect(onHoverIndex).toHaveBeenCalledWith(4);
    expect(useFlowStore.getState().hoveredAutocompletePodName).toBe('api-pod');

    fireEvent.mouseLeave(itemWrapper);
    expect(useFlowStore.getState().hoveredAutocompletePodName).toBeNull();
  });

  it('renders item without description when info accordion is toggled', () => {
    const onSelectSuggestion = vi.fn();
    render(
      <AutocompleteItem
        item={samplePodItem}
        index={5}
        isSelected={false}
        isDark={true}
        selectedSubIndex={0}
        onSelectSuggestion={onSelectSuggestion}
      />
    );

    const infoBtn = screen.getByTestId('autocomplete-info-btn-5');
    fireEvent.click(infoBtn);

    expect(screen.getByTestId('autocomplete-description-accordion-5')).toBeInTheDocument();
    expect(screen.getByText('Full Command')).toBeInTheDocument();
    expect(screen.queryByText('Detailed Information')).not.toBeInTheDocument();
  });
});
