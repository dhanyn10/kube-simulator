import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { useRef } from 'react';
import {
  ResourceModalFooter,
} from '@/components/Modals/ResourceModalFooter';
import { useOutsideMouseDown } from '@/hooks/useOutsideMouseDown';
import { getInitialResourceColumnVisibility } from '@/components/Modals/ResourceListView';

const HookTestComponent: React.FC<{
  active: boolean;
  onOutsideClick: () => void;
}> = ({ active, onOutsideClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideMouseDown(ref, active, onOutsideClick);

  return (
    <div>
      <div ref={ref} data-testid="inside-element">
        Inside
      </div>
      <div data-testid="outside-element">Outside</div>
    </div>
  );
};

describe('ResourceModalFooter & Shared Helpers', () => {
  it('renders list mode footer and responds to clicks', () => {
    const mockAddNew = vi.fn();
    const mockClose = vi.fn();

    render(
      <ResourceModalFooter
        mode="list"
        isDark={true}
        onAddNewFromList={mockAddNew}
        onClose={mockClose}
        onBackToMode={vi.fn()}
        onSave={vi.fn()}
        addNewButtonLabel="+ Add Secret"
        saveButtonLabel="Attach Secret"
        accentColor="rose"
        closeButtonTestId="test-close-btn"
      />
    );

    const addBtn = screen.getByRole('button', { name: /\+ Add Secret/i });
    fireEvent.click(addBtn);
    expect(mockAddNew).toHaveBeenCalled();

    const closeBtn = screen.getByTestId('test-close-btn');
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders profile mode footer and responds to clicks', () => {
    const mockBack = vi.fn();
    const mockAddNew = vi.fn();
    const mockClose = vi.fn();

    render(
      <ResourceModalFooter
        mode="profile"
        isDark={false}
        onAddNewFromList={mockAddNew}
        onClose={mockClose}
        onBackToMode={mockBack}
        onSave={vi.fn()}
        addNewButtonLabel="+ Add ConfigMap"
        saveButtonLabel="Update ConfigMap"
        accentColor="teal"
        profileBackButtonTestId="test-profile-back-btn"
      />
    );

    const backBtn = screen.getByTestId('test-profile-back-btn');
    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalled();

    const addBtn = screen.getByRole('button', { name: /\+ Add ConfigMap/i });
    fireEvent.click(addBtn);
    expect(mockAddNew).toHaveBeenCalled();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders form mode footer and responds to clicks', () => {
    const mockBack = vi.fn();
    const mockClose = vi.fn();
    const mockSave = vi.fn();

    render(
      <ResourceModalFooter
        mode="form"
        isDark={true}
        onAddNewFromList={vi.fn()}
        onClose={mockClose}
        onBackToMode={mockBack}
        onSave={mockSave}
        addNewButtonLabel="+ Add Secret"
        saveButtonLabel="Update Secret"
        accentColor="rose"
        backButtonTestId="test-back-btn"
        closeButtonTestId="test-cancel-btn"
      />
    );

    const backBtn = screen.getByTestId('test-back-btn');
    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalled();

    const cancelBtn = screen.getByTestId('test-cancel-btn');
    fireEvent.click(cancelBtn);
    expect(mockClose).toHaveBeenCalled();

    const saveBtn = screen.getByRole('button', { name: 'Update Secret' });
    fireEvent.click(saveBtn);
    expect(mockSave).toHaveBeenCalled();
  });

  it('useOutsideMouseDown triggers only when clicking outside while active', () => {
    const mockOutside = vi.fn();
    const { rerender } = render(
      <HookTestComponent active={true} onOutsideClick={mockOutside} />
    );

    fireEvent.mouseDown(screen.getByTestId('inside-element'));
    expect(mockOutside).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    expect(mockOutside).toHaveBeenCalledTimes(1);

    // Inactive hook
    rerender(<HookTestComponent active={false} onOutsideClick={mockOutside} />);
    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    expect(mockOutside).toHaveBeenCalledTimes(1);
  });

  it('getInitialResourceColumnVisibility correctly parses storage and handles invalid JSON', () => {
    globalThis.localStorage.clear();
    expect(getInitialResourceColumnVisibility('test_key')).toEqual({ profile: true, component: true });

    globalThis.localStorage.setItem('test_key', JSON.stringify({ profile: false, component: false }));
    expect(getInitialResourceColumnVisibility('test_key')).toEqual({ profile: false, component: false });

    globalThis.localStorage.setItem('test_key', 'invalid-json');
    expect(getInitialResourceColumnVisibility('test_key')).toEqual({ profile: true, component: true });
  });
});
