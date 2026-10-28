import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigMapImportDataDropdown } from '@/components/Modals/ConfigMapImportDataDropdown';

describe('ConfigMapImportDataDropdown', () => {
  const dummyRef = { current: null };
  const sampleConfigMaps = [
    { id: 'cm-1', name: 'app-env', configData: [{ key: 'ENV', value: 'production' }, { key: 'DEBUG', value: 'false' }] },
    { id: 'cm-2', name: 'db-config', configData: [{ key: 'HOST', value: '127.0.0.1' }] },
  ];

  it('returns null when existingConfigMaps is empty', () => {
    const { container } = render(
      <ConfigMapImportDataDropdown
        isOpen={false}
        onToggleOpen={vi.fn()}
        existingConfigMaps={[]}
        onImport={vi.fn()}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders trigger button and opens menu on toggle', () => {
    const onToggleOpen = vi.fn();
    const onImport = vi.fn();

    const { rerender } = render(
      <ConfigMapImportDataDropdown
        isOpen={false}
        onToggleOpen={onToggleOpen}
        existingConfigMaps={sampleConfigMaps}
        onImport={onImport}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );

    const btn = screen.getByTestId('btn-add-from-existing-cm');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onToggleOpen).toHaveBeenCalled();

    // Rerender as open
    rerender(
      <ConfigMapImportDataDropdown
        isOpen={true}
        onToggleOpen={onToggleOpen}
        existingConfigMaps={sampleConfigMaps}
        onImport={onImport}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );

    expect(screen.getByTestId('import-existing-cm-menu')).toBeInTheDocument();
    expect(screen.getByTestId('import-option-app-env')).toHaveTextContent('app-env');
    expect(screen.getByTestId('import-option-db-config')).toHaveTextContent('db-config');

    // Click option
    fireEvent.click(screen.getByTestId('import-option-app-env'));
    expect(onImport).toHaveBeenCalledWith(sampleConfigMaps[0]);
  });
});
