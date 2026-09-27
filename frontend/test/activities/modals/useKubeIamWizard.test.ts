import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import { useKubeIamWizard, DEFAULT_POLICIES } from '@/activities/modals/useKubeIamWizard';

describe('useKubeIamWizard', () => {
  beforeEach(() => {
    useFlowStore.setState({
      isKubeIamModalOpen: true,
      colorMode: 'dark',
      iamUsers: [
        {
          username: 'admin-user',
          accessType: 'Full Access',
          policies: DEFAULT_POLICIES,
        },
      ],
    });
  });

  it('initializes default state and filters users and policies', () => {
    const { result } = renderHook(() => useKubeIamWizard());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.colorMode).toBe('dark');
    expect(result.current.iamUsers).toHaveLength(1);
    expect(result.current.isCreatingUser).toBe(false);
    expect(result.current.currentStep).toBe(1);
    expect(result.current.computedAccessType).toBe('Full Access');

    // Test search filters
    act(() => {
      result.current.setSearchFilter('admin');
      result.current.setPolicySearch('Container');
    });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredPolicies).toHaveLength(1);
    expect(result.current.filteredPolicies[0].name).toBe('ContainerDeveloperPolicy');
  });

  it('handles onClose and resets wizard state', () => {
    const { result } = renderHook(() => useKubeIamWizard());

    act(() => {
      result.current.handleStartCreate();
      result.current.handleUsernameChange('tempuser');
    });

    expect(result.current.isCreatingUser).toBe(true);

    act(() => {
      result.current.onClose();
    });

    expect(useFlowStore.getState().isKubeIamModalOpen).toBe(false);
    expect(result.current.isCreatingUser).toBe(false);
    expect(result.current.username).toBe('');
  });

  it('validates step 1 username input (required error, duplicate error, and error clearing)', () => {
    const { result } = renderHook(() => useKubeIamWizard());

    act(() => {
      result.current.handleStartCreate();
    });

    // Empty username validation
    act(() => {
      result.current.handleNextStep1();
    });

    expect(result.current.usernameError).toBe('Username is required');
    expect(result.current.currentStep).toBe(1);

    // Duplicate username validation
    act(() => {
      result.current.handleUsernameChange('ADMIN-USER');
    });
    expect(result.current.usernameError).toBe(''); // Cleared on change

    act(() => {
      result.current.handleNextStep1();
    });
    expect(result.current.usernameError).toBe('Username already exists');
    expect(result.current.currentStep).toBe(1);

    // Valid unique username
    act(() => {
      result.current.handleUsernameChange('new-dev');
    });
    act(() => {
      result.current.handleNextStep1();
    });

    expect(result.current.usernameError).toBe('');
    expect(result.current.currentStep).toBe(2);
  });

  it('handles step 2 policy selection, toggle policies, empty policy validation, and creation completion', () => {
    const { result } = renderHook(() => useKubeIamWizard());

    act(() => {
      result.current.handleStartCreate();
      result.current.handleUsernameChange('developer1');
    });

    act(() => {
      result.current.handleNextStep1();
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.isAdminSelected).toBe(true);

    // Toggle AdministratorAccess OFF (clears all selected policies)
    act(() => {
      result.current.togglePolicy('AdministratorAccess');
    });

    expect(result.current.selectedPolicies).toEqual([]);
    expect(result.current.isAdminSelected).toBe(false);
    expect(result.current.computedAccessType).toBe('Managed Access');

    // Attempt handleNextStep2 when selectedPolicies is empty (returns early, stays on step 2)
    act(() => {
      result.current.handleNextStep2();
    });

    expect(result.current.currentStep).toBe(2);

    // Toggle ContainerDeveloperPolicy ON
    act(() => {
      result.current.togglePolicy('ContainerDeveloperPolicy');
    });

    expect(result.current.selectedPolicies).toEqual(['ContainerDeveloperPolicy']);
    expect(result.current.isOtherSelected).toBe(true);

    // Toggle NetworkingAdminPolicy ON
    act(() => {
      result.current.togglePolicy('NetworkingAdminPolicy');
    });
    expect(result.current.selectedPolicies).toEqual(['ContainerDeveloperPolicy', 'NetworkingAdminPolicy']);

    // Toggle ContainerDeveloperPolicy OFF
    act(() => {
      result.current.togglePolicy('ContainerDeveloperPolicy');
    });
    expect(result.current.selectedPolicies).toEqual(['NetworkingAdminPolicy']);

    // Toggle AdministratorAccess ON (replaces custom policies with AdministratorAccess)
    act(() => {
      result.current.togglePolicy('AdministratorAccess');
    });
    expect(result.current.selectedPolicies).toEqual(['AdministratorAccess']);

    // Proceed to Step 3
    act(() => {
      result.current.handleNextStep2();
    });

    expect(result.current.currentStep).toBe(3);

    // Finish creation
    act(() => {
      result.current.handleFinishCreate();
    });

    expect(useFlowStore.getState().iamUsers).toHaveLength(2);
    expect(useFlowStore.getState().iamUsers[1].username).toBe('developer1');
    expect(result.current.isCreatingUser).toBe(false);
  });
});
