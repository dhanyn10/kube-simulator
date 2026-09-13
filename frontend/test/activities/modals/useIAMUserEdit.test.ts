import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import { useIAMUserEdit } from '@/activities/modals/useIAMUserEdit';
import { KubeIAMUser } from '@/types';

describe('useIAMUserEdit', () => {
  const dummyUser: KubeIAMUser = {
    id: 'user-1',
    username: 'john_doe',
    policies: [
      { name: 'AdministratorAccess', description: 'Full access' },
    ],
    createdAt: Date.now(),
  };

  beforeEach(() => {
    useFlowStore.setState({
      iamUsers: [
        dummyUser,
        { id: 'user-2', username: 'jane_doe', policies: [], createdAt: Date.now() },
      ],
    });
  });

  it('initializes state with user properties', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish }));

    expect(result.current.editStep).toBe(1);
    expect(result.current.editUsername).toBe('john_doe');
    expect(result.current.editPolicies).toEqual(['AdministratorAccess']);
    expect(result.current.isEditAdminSelected).toBe(true);
    expect(result.current.editComputedAccessType).toBe('Full Access');
  });

  it('handles empty policies fallback on init', () => {
    const userNoPolicies: KubeIAMUser = {
      id: 'user-3',
      username: 'bob',
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useIAMUserEdit({ user: userNoPolicies, onFinish: vi.fn() }));
    expect(result.current.editPolicies).toEqual(['AdministratorAccess']);
  });

  it.each([
    { inputUsername: '  ', expectedError: 'Username is required', expectedStep: 1 },
    { inputUsername: 'jane_doe', expectedError: 'Username already exists', expectedStep: 1 },
    { inputUsername: 'john_doe_updated', expectedError: '', expectedStep: 2 },
  ])(
    'handles step 1 username validation for input "$inputUsername"',
    ({ inputUsername, expectedError, expectedStep }) => {
      const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish: vi.fn() }));

      act(() => {
        result.current.handleUsernameChange(inputUsername);
      });

      act(() => {
        result.current.handleEditNextStep1();
      });

      expect(result.current.editUsernameError).toBe(expectedError);
      expect(result.current.editStep).toBe(expectedStep);
    }
  );

  it('toggles policies correctly', () => {
    const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish: vi.fn() }));

    // Toggle off AdministratorAccess
    act(() => {
      result.current.toggleEditPolicy('AdministratorAccess');
    });
    expect(result.current.editPolicies).toEqual([]);
    expect(result.current.isEditAdminSelected).toBe(false);
    expect(result.current.editComputedAccessType).toBe('Managed Access');

    // Add ReadOnlyAccess
    act(() => {
      result.current.toggleEditPolicy('ReadOnlyAccess');
    });
    expect(result.current.editPolicies).toEqual(['ReadOnlyAccess']);
    expect(result.current.isEditOtherSelected).toBe(true);

    // Toggle ReadOnlyAccess off
    act(() => {
      result.current.toggleEditPolicy('ReadOnlyAccess');
    });
    expect(result.current.editPolicies).toEqual([]);

    // Toggle AdministratorAccess back on clears other policies
    act(() => {
      result.current.toggleEditPolicy('ReadOnlyAccess');
      result.current.toggleEditPolicy('AdministratorAccess');
    });
    expect(result.current.editPolicies).toEqual(['AdministratorAccess']);
  });

  it('filters policies based on search query', () => {
    const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish: vi.fn() }));

    act(() => {
      result.current.setEditPolicySearch('read');
    });

    expect(result.current.filteredEditPolicies.some((p) => p.name === 'ReadOnlyAccess')).toBe(true);
  });

  it('handles step 2 next and previous navigation', () => {
    const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish: vi.fn() }));

    act(() => {
      result.current.setEditStep(2);
    });

    act(() => {
      result.current.handleNextFromStep2();
    });

    expect(result.current.editStep).toBe(3);

    act(() => {
      result.current.handlePreviousStep();
    });

    expect(result.current.editStep).toBe(2);
  });

  it('does not proceed to step 3 from step 2 if no policies selected', () => {
    const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish: vi.fn() }));

    act(() => {
      result.current.setEditStep(2);
      result.current.toggleEditPolicy('AdministratorAccess'); // clear policies
    });

    act(() => {
      result.current.handleNextFromStep2();
    });

    expect(result.current.editStep).toBe(2);
  });

  it('finishes editing user profile', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useIAMUserEdit({ user: dummyUser, onFinish }));

    act(() => {
      result.current.handleFinishEdit();
    });

    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith(
      'john_doe',
      expect.arrayContaining([expect.objectContaining({ name: 'AdministratorAccess' })])
    );
  });
});
