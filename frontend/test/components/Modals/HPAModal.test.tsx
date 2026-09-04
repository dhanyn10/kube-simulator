import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { HPAModal } from '@/components/Modals/HPAModal';

describe('HPAModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <HPAModal
        isOpen={false}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="My Deployment"
        onSave={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open and handles save', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <HPAModal
        isOpen={true}
        onClose={onClose}
        targetNodeId="dep-1"
        targetNodeLabel="My Deployment"
        onSave={onSave}
      />
    );

    expect(screen.getByRole('heading', { name: 'Attach HPA Autoscaling' })).toBeInTheDocument();
    expect(screen.getByText('Target card: My Deployment')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Attach HPA' });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
