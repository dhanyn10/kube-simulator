import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KeyValueConfig } from '../../../src/components/Config/KeyValueConfig';
import { Key } from 'lucide-react';

describe('KeyValueConfig', () => {
  const defaultProps = {
    title: 'Variables',
    titleIcon: <Key size={10} data-testid="title-icon" />,
    valueIcon: <Key size={10} data-testid="value-icon" />,
    configData: [] as any[],
    performUpdate: vi.fn(),
    colorMode: 'dark',
    addButtonText: 'Add Variable',
    emptyText: 'No variables configured',
    accentColor: 'teal' as const,
  };

  it('renders title and empty state in dark and light modes', () => {
    const { rerender } = render(<KeyValueConfig {...defaultProps} />);
    expect(screen.getByText('Variables')).toBeDefined();
    expect(screen.getByText('No variables configured')).toBeDefined();

    rerender(<KeyValueConfig {...defaultProps} colorMode="light" accentColor="indigo" />);
    expect(screen.getByText('No variables configured')).toBeDefined();
  });

  it('calls performUpdate with new entry when Add button is clicked', () => {
    render(<KeyValueConfig {...defaultProps} />);
    const addButton = screen.getByRole('button', { name: /Add Variable/i });
    fireEvent.click(addButton);
    expect(defaultProps.performUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        configData: [expect.objectContaining({ key: '', value: '' })],
      })
    );
  });

  it('renders existing configData and handles input updates for items without ID in light mode', () => {
    const configDataWithoutId = [{ key: 'MY_KEY', value: 'MY_VALUE' }];
    const performUpdate = vi.fn();
    render(
      <KeyValueConfig
        {...defaultProps}
        configData={configDataWithoutId as any}
        performUpdate={performUpdate}
        colorMode="light"
        accentColor="indigo"
      />
    );

    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('Value');

    expect(keyInput).toBeDefined();
    expect(valueInput).toBeDefined();

    fireEvent.change(keyInput, { target: { value: 'UPDATED_KEY' } });
    expect(performUpdate).toHaveBeenCalledWith({
      configData: [expect.objectContaining({ key: 'UPDATED_KEY', value: 'MY_VALUE', id: expect.any(String) })],
    });

    fireEvent.change(valueInput, { target: { value: 'UPDATED_VALUE' } });
    expect(performUpdate).toHaveBeenCalledWith({
      configData: [expect.objectContaining({ key: 'MY_KEY', value: 'UPDATED_VALUE', id: expect.any(String) })],
    });
  });

  it('calls performUpdate with item removed when Delete button is clicked', () => {
    const configData = [{ id: '1', key: 'MY_KEY', value: 'MY_VALUE' }];
    const performUpdate = vi.fn();
    render(<KeyValueConfig {...defaultProps} configData={configData} performUpdate={performUpdate} />);

    const deleteButton = screen.getByRole('button', { name: '' });
    fireEvent.click(deleteButton);

    expect(performUpdate).toHaveBeenCalledWith({ configData: [] });
  });

  it('supports visibility, YAML toggle controls, and disabled fieldset when YAML is disabled', () => {
    const configData = [{ id: '1', key: 'MY_KEY', value: 'MY_VALUE' }];
    const onToggle = vi.fn();
    const onYamlToggle = vi.fn();

    const { rerender } = render(
      <KeyValueConfig
        {...defaultProps}
        configData={configData}
        isVisible={true}
        onToggle={onToggle}
        isYamlEnabled={true}
        onYamlToggle={onYamlToggle}
      />
    );

    const visibilityBtn = screen.getByTitle('Show/Hide on Card');
    fireEvent.click(visibilityBtn);
    expect(onToggle).toHaveBeenCalled();

    const yamlBtn = screen.getByTitle('Include in YAML');
    fireEvent.click(yamlBtn);
    expect(onYamlToggle).toHaveBeenCalled();

    // Fieldset disabled when isYamlEnabled === false
    rerender(
      <KeyValueConfig
        {...defaultProps}
        configData={configData}
        isYamlEnabled={false}
        onYamlToggle={onYamlToggle}
      />
    );

    const fieldset = screen.getByRole('group', { hidden: true });
    expect(fieldset).toBeDisabled();
  });
});
