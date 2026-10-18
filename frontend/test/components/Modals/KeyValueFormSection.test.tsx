import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyValueFormSection, KeyValueItem } from '@/components/Modals/KeyValueFormSection';

describe('KeyValueFormSection', () => {
  const defaultItems: KeyValueItem[] = [
    { id: 'item-1', key: 'FOO', value: 'BAR' },
  ];

  it('renders with default props and handles teal accent color in light mode', () => {
    const onAddField = vi.fn();
    const onRemoveField = vi.fn();
    const onUpdateField = vi.fn();

    render(
      <KeyValueFormSection
        items={defaultItems}
        colorMode="light"
        accentColor="teal"
        onAddField={onAddField}
        onRemoveField={onRemoveField}
        onUpdateField={onUpdateField}
      />
    );

    expect(screen.getByText('Data (Key - Value Pairs)')).toBeDefined();
    const addButton = screen.getByRole('button', { name: /Add Key-Value/i });
    expect(addButton.className).toContain('text-teal-400');

    const keyInput = screen.getByPlaceholderText('KEY');
    expect(keyInput.className).toContain('focus:ring-teal-500');
    expect(keyInput.className).toContain('bg-white');

    // Single item should not show remove button
    expect(screen.queryByTitle('Remove Pair')).toBeNull();

    fireEvent.click(addButton);
    expect(onAddField).toHaveBeenCalledTimes(1);

    fireEvent.change(keyInput, { target: { value: 'NEW_KEY' } });
    expect(onUpdateField).toHaveBeenCalledWith('item-1', 'key', 'NEW_KEY');
  });

  it('renders with custom props, indigo accent color in dark mode, and handles remove', () => {
    const items: KeyValueItem[] = [
      { id: 'item-1', key: 'DB_USER', value: 'admin' },
      { id: 'item-2', key: 'DB_PASS', value: 'secret' },
    ];
    const onAddField = vi.fn();
    const onRemoveField = vi.fn();
    const onUpdateField = vi.fn();

    render(
      <KeyValueFormSection
        items={items}
        colorMode="dark"
        accentColor="indigo"
        sectionTitle="Secret Credentials"
        keyPlaceholder="Config Key"
        valuePlaceholder="Config Value"
        valueInputType="password"
        onAddField={onAddField}
        onRemoveField={onRemoveField}
        onUpdateField={onUpdateField}
      />
    );

    expect(screen.getByText('Secret Credentials')).toBeDefined();
    const addButton = screen.getByRole('button', { name: /Add Key-Value/i });
    expect(addButton.className).toContain('text-indigo-400');

    const keyInputs = screen.getAllByPlaceholderText('Config Key');
    expect(keyInputs[0].className).toContain('focus:ring-indigo-500');
    expect(keyInputs[0].className).toContain('bg-slate-900');

    const valueInputs = screen.getAllByPlaceholderText('Config Value');
    expect(valueInputs[0].getAttribute('type')).toBe('password');

    fireEvent.change(valueInputs[0], { target: { value: 'superadmin' } });
    expect(onUpdateField).toHaveBeenCalledWith('item-1', 'value', 'superadmin');

    const removeButtons = screen.getAllByTitle('Remove Pair');
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]);
    expect(onRemoveField).toHaveBeenCalledWith('item-2');
  });
});
