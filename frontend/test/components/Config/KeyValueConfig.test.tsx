import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders title and empty state', () => {
    render(<KeyValueConfig {...defaultProps} />);
    expect(screen.getByText('Variables')).toBeDefined();
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

  it('renders existing configData and handles input updates', () => {
    const configData = [{ id: '1', key: 'MY_KEY', value: 'MY_VALUE' }];
    const performUpdate = vi.fn();
    render(<KeyValueConfig {...defaultProps} configData={configData} performUpdate={performUpdate} />);

    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('Value');

    expect(keyInput).toBeDefined();
    expect(valueInput).toBeDefined();

    fireEvent.change(keyInput, { target: { value: 'UPDATED_KEY' } });
    expect(performUpdate).toHaveBeenCalledWith({
      configData: [{ id: '1', key: 'UPDATED_KEY', value: 'MY_VALUE' }],
    });

    fireEvent.change(valueInput, { target: { value: 'UPDATED_VALUE' } });
    expect(performUpdate).toHaveBeenCalledWith({
      configData: [{ id: '1', key: 'MY_KEY', value: 'UPDATED_VALUE' }],
    });
  });

  it('calls performUpdate with item removed when Delete button is clicked', () => {
    const configData = [{ id: '1', key: 'MY_KEY', value: 'MY_VALUE' }];
    const performUpdate = vi.fn();
    render(<KeyValueConfig {...defaultProps} configData={configData} performUpdate={performUpdate} />);

    const deleteButton = screen.getByRole('button', { name: '' }); // Delete button has no text but icon
    fireEvent.click(deleteButton);

    expect(performUpdate).toHaveBeenCalledWith({ configData: [] });
  });

  it('supports visibility and YAML toggle controls', () => {
    const configData = [{ id: '1', key: 'MY_KEY', value: 'MY_VALUE' }];
    const onToggle = vi.fn();
    const onYamlToggle = vi.fn();

    render(
      <KeyValueConfig
        {...defaultProps}
        configData={configData}
        isVisible={true}
        onToggle={onToggle}
        isYamlEnabled={true}
        onYamlToggle={onYamlToggle}
      />
    );

    // Verify buttons are there or trigger onToggle
    const visibilityBtn = screen.getByTitle('Show/Hide on Card');
    fireEvent.click(visibilityBtn);
    expect(onToggle).toHaveBeenCalled();

    const yamlBtn = screen.getByTitle('Include in YAML');
    fireEvent.click(yamlBtn);
    expect(onYamlToggle).toHaveBeenCalled();
  });
});
