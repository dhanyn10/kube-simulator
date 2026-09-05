import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import '@testing-library/jest-dom';

describe('SelectorGroup', () => {
  const mockOnSelect = vi.fn();

  it('renders options with value and triggers onSelect', () => {
    const options = [
      { label: 'Option A', value: 'opt-a' },
      { label: 'Option B', value: 'opt-b' },
    ];

    render(
      <SelectorGroup
        options={options}
        currentValue="opt-a"
        onSelect={mockOnSelect}
        colorMode="dark"
      />
    );

    const btnB = screen.getByText('Option B').closest('button')!;
    fireEvent.click(btnB);
    expect(mockOnSelect).toHaveBeenCalledWith('opt-b');
  });

  it('handles fallback id when value is undefined and validateOption in dark/light modes', () => {
    const options = [
      { label: 'Option 1', id: 'id-1' },
      { label: 'Option 2', id: 'id-2' },
    ];

    const validateOption = (val: string) => val === 'id-2';

    const { rerender } = render(
      <SelectorGroup
        options={options}
        currentValue="id-1"
        onSelect={mockOnSelect}
        colorMode="dark"
        validateOption={validateOption}
      />
    );

    expect(screen.getByText('Option 1')).toBeDefined();

    rerender(
      <SelectorGroup
        options={options}
        currentValue="id-1"
        onSelect={mockOnSelect}
        colorMode="light"
        validateOption={validateOption}
      />
    );

    expect(screen.getByText('Option 2')).toBeDefined();
  });

  it('renders column layout with descriptions', () => {
    const options = [
      { label: 'Col 1', value: 'c1', desc: 'Description 1' },
      { label: 'Col 2', value: 'c2', desc: 'Description 2' },
    ];

    render(
      <SelectorGroup
        options={options}
        currentValue="c1"
        onSelect={mockOnSelect}
        colorMode="dark"
        layout="column"
      />
    );

    expect(screen.getByText('Description 1')).toBeDefined();
    expect(screen.getByText('Description 2')).toBeDefined();
  });

  it('renders grid layout', () => {
    const options = [
      { label: 'Grid 1', value: 'g1' },
      { label: 'Grid 2', value: 'g2' },
    ];

    render(
      <SelectorGroup
        options={options}
        currentValue="g1"
        onSelect={mockOnSelect}
        colorMode="light"
        layout="grid"
      />
    );

    expect(screen.getByText('Grid 1')).toBeDefined();
  });
});
