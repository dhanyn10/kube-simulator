import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecretImportDataDropdown } from '@/components/Modals/SecretImportDataDropdown';

describe('SecretImportDataDropdown', () => {
  const dummyRef = { current: null };
  const sampleSecrets = [
    { id: 'sec-1', name: 'app-secret', secretData: [{ key: 'API_KEY', value: 'secret123' }, { key: 'TOKEN', value: 'tok456' }] },
    { id: 'sec-2', name: 'db-pass', secretData: [{ key: 'PASSWORD', value: 'root' }] },
  ];

  it('returns null when existingSecrets is empty', () => {
    const { container } = render(
      <SecretImportDataDropdown
        isOpen={false}
        onToggleOpen={vi.fn()}
        existingSecrets={[]}
        onImport={vi.fn()}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders trigger button and opens menu on toggle in dark mode', () => {
    const onToggleOpen = vi.fn();
    const onImport = vi.fn();

    const { rerender } = render(
      <SecretImportDataDropdown
        isOpen={false}
        onToggleOpen={onToggleOpen}
        existingSecrets={sampleSecrets}
        onImport={onImport}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );

    const btn = screen.getByTestId('btn-add-from-existing-sec');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-slate-900');
    fireEvent.click(btn);
    expect(onToggleOpen).toHaveBeenCalled();

    rerender(
      <SecretImportDataDropdown
        isOpen={true}
        onToggleOpen={onToggleOpen}
        existingSecrets={sampleSecrets}
        onImport={onImport}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );

    expect(screen.getByTestId('import-existing-sec-menu')).toBeInTheDocument();
    expect(screen.getByTestId('import-option-app-secret')).toHaveTextContent('app-secret');
    expect(screen.getByTestId('import-option-app-secret')).toHaveTextContent('2 keys');
    expect(screen.getByTestId('import-option-db-pass')).toHaveTextContent('db-pass');
    expect(screen.getByTestId('import-option-db-pass')).toHaveTextContent('1 key');

    fireEvent.click(screen.getByTestId('import-option-app-secret'));
    expect(onImport).toHaveBeenCalledWith(sampleSecrets[0]);
  });

  it('renders correctly in light mode (isDark = false) with menu opened', () => {
    const onImport = vi.fn();
    render(
      <SecretImportDataDropdown
        isOpen={true}
        onToggleOpen={vi.fn()}
        existingSecrets={sampleSecrets}
        onImport={onImport}
        isDark={false}
        dropdownRef={dummyRef}
      />
    );

    const btn = screen.getByTestId('btn-add-from-existing-sec');
    expect(btn).toHaveClass('bg-white');

    const menu = screen.getByTestId('import-existing-sec-menu');
    expect(menu).toHaveClass('bg-white');

    const option = screen.getByTestId('import-option-app-secret');
    expect(option).toHaveClass('hover:bg-slate-100');

    fireEvent.click(option);
    expect(onImport).toHaveBeenCalledWith(sampleSecrets[0]);
  });

  it('falls back to id when name is missing and handles undefined secretData', () => {
    const secretsWithFallback = [
      { id: 'sec-fallback-1', name: '', secretData: undefined as any },
    ];
    render(
      <SecretImportDataDropdown
        isOpen={true}
        onToggleOpen={vi.fn()}
        existingSecrets={secretsWithFallback}
        onImport={vi.fn()}
        isDark={true}
        dropdownRef={dummyRef}
      />
    );
    expect(screen.getByTestId('import-option-sec-fallback-1')).toBeInTheDocument();
    expect(screen.getByTestId('import-option-sec-fallback-1')).toHaveTextContent('sec-fallback-1');
    expect(screen.getByTestId('import-option-sec-fallback-1')).toHaveTextContent('0 keys');
  });
});
