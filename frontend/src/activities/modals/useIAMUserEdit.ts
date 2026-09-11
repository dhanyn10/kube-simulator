import { useState } from 'react';
import { useFlowStore } from '@/store';
import { KubeIAMPolicy, KubeIAMUser } from '@/types';
import { DEFAULT_POLICIES, IAMStep, IAMAccessType } from '@/activities/modals';

export interface UseIAMUserEditParams {
  readonly user: KubeIAMUser;
  readonly onFinish: (username: string, policies: KubeIAMPolicy[]) => void;
}

export function useIAMUserEdit({ user, onFinish }: UseIAMUserEditParams) {
  const iamUsers = useFlowStore((state) => state.iamUsers);

  const [editStep, setEditStep] = useState<IAMStep>(1);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editPolicies, setEditPolicies] = useState<string[]>(
    user.policies?.map((p) => p.name) || ['AdministratorAccess']
  );
  const [editPolicySearch, setEditPolicySearch] = useState('');
  const [editUsernameError, setEditUsernameError] = useState('');

  const handleEditNextStep1 = () => {
    const trimmed = editUsername.trim();
    if (!trimmed) {
      setEditUsernameError('Username is required');
      return;
    }
    const exists = iamUsers.some(
      (u) => u.id !== user.id && u.username.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setEditUsernameError('Username already exists');
      return;
    }
    setEditUsernameError('');
    setEditStep(2);
  };

  const handleFinishEdit = () => {
    const finalPolicies = DEFAULT_POLICIES.filter((p) => editPolicies.includes(p.name));
    onFinish(editUsername.trim(), finalPolicies);
  };

  const isEditAdminSelected = editPolicies.includes('AdministratorAccess');
  const isEditOtherSelected = editPolicies.some((p) => p !== 'AdministratorAccess');

  const toggleEditPolicy = (policyName: string) => {
    if (policyName === 'AdministratorAccess') {
      setEditPolicies(isEditAdminSelected ? [] : ['AdministratorAccess']);
      return;
    }
    setEditPolicies((prev) => {
      const withoutAdmin = prev.filter((p) => p !== 'AdministratorAccess');
      return withoutAdmin.includes(policyName)
        ? withoutAdmin.filter((p) => p !== policyName)
        : [...withoutAdmin, policyName];
    });
  };

  const filteredEditPolicies = DEFAULT_POLICIES.filter(
    (p) =>
      p.name.toLowerCase().includes(editPolicySearch.toLowerCase()) ||
      p.description.toLowerCase().includes(editPolicySearch.toLowerCase())
  );

  const editComputedAccessType: IAMAccessType = isEditAdminSelected
    ? 'Full Access'
    : 'Managed Access';

  const handleNextFromStep2 = () => {
    if (editPolicies.length > 0) {
      setEditStep(3);
    }
  };

  const handlePreviousStep = () => {
    setEditStep((prev) => (prev - 1) as 1 | 2);
  };

  const handleUsernameChange = (val: string) => {
    setEditUsername(val);
    if (editUsernameError) {
      setEditUsernameError('');
    }
  };

  return {
    editStep,
    setEditStep,
    editUsername,
    editUsernameError,
    editPolicies,
    editPolicySearch,
    setEditPolicySearch,
    filteredEditPolicies,
    isEditAdminSelected,
    isEditOtherSelected,
    editComputedAccessType,
    handleEditNextStep1,
    handleNextFromStep2,
    handlePreviousStep,
    handleFinishEdit,
    toggleEditPolicy,
    handleUsernameChange,
  };
}
