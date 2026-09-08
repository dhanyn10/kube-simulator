import { useState } from 'react';
import { useFlowStore } from '../../store';
import { KubeIAMPolicy } from '../../types';

export type IAMStep = 1 | 2 | 3;
export type IAMAccessType = 'Full Access' | 'Managed Access';

export const DEFAULT_POLICIES: KubeIAMPolicy[] = [
  {
    name: 'AdministratorAccess',
    type: 'Default',
    description: 'Provides full access to Kube resources and cluster management.'
  },
  {
    name: 'ReadOnlyAccess',
    type: 'Default',
    description: 'Provides read-only access to view workloads, services, and configs.'
  },
  {
    name: 'PowerUserAccess',
    type: 'Default',
    description: 'Provides full access to application workloads without security admin controls.'
  },
  {
    name: 'ContainerDeveloperPolicy',
    type: 'Default',
    description: 'Allows managing deployments, pods, and service connections.'
  },
  {
    name: 'NetworkingAdminPolicy',
    type: 'Default',
    description: 'Allows configuring services, ingresses, and external traffic routing.'
  },
  {
    name: 'StorageAdminPolicy',
    type: 'Default',
    description: 'Provides full access to PVCs and storage configuration.'
  }
];

export const useKubeIamWizard = () => {
  const isOpen = useFlowStore((state) => state.isKubeIamModalOpen);
  const colorMode = useFlowStore((state) => state.colorMode);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const addIamUser = useFlowStore((state) => state.addIamUser);
  const deleteIamUser = useFlowStore((state) => state.deleteIamUser);

  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [currentStep, setCurrentStep] = useState<IAMStep>(1);
  const [searchFilter, setSearchFilter] = useState('');

  // Wizard state
  const [username, setUsername] = useState('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(['AdministratorAccess']);
  const [policySearch, setPolicySearch] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const computedAccessType: IAMAccessType = selectedPolicies.includes('AdministratorAccess')
    ? 'Full Access'
    : 'Managed Access';

  const resetWizard = () => {
    setIsCreatingUser(false);
    setCurrentStep(1);
    setUsername('');
    setSelectedPolicies(['AdministratorAccess']);
    setPolicySearch('');
    setUsernameError('');
  };

  const onClose = () => {
    useFlowStore.getState().setKubeIamModalOpen(false);
    resetWizard();
  };

  const handleStartCreate = () => {
    setIsCreatingUser(true);
    setCurrentStep(1);
  };

  const handleNextStep1 = () => {
    if (!username.trim()) {
      setUsernameError('Username is required');
      return;
    }
    const exists = iamUsers.some((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      setUsernameError('Username already exists');
      return;
    }
    setUsernameError('');
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    if (selectedPolicies.length === 0) {
      return;
    }
    setCurrentStep(3);
  };

  const handleFinishCreate = () => {
    const finalPolicies = DEFAULT_POLICIES.filter((p) => selectedPolicies.includes(p.name));

    addIamUser({
      username: username.trim(),
      accessType: computedAccessType,
      policies: finalPolicies,
    });

    resetWizard();
  };

  const isAdminSelected = selectedPolicies.includes('AdministratorAccess');
  const isOtherSelected = selectedPolicies.some((p) => p !== 'AdministratorAccess');

  const togglePolicy = (policyName: string) => {
    if (policyName === 'AdministratorAccess') {
      setSelectedPolicies(isAdminSelected ? [] : ['AdministratorAccess']);
      return;
    }

    setSelectedPolicies((prev) => {
      const withoutAdmin = prev.filter((p) => p !== 'AdministratorAccess');
      return withoutAdmin.includes(policyName)
        ? withoutAdmin.filter((p) => p !== policyName)
        : [...withoutAdmin, policyName];
    });
  };

  const filteredUsers = iamUsers.filter((u) =>
    u.username.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredPolicies = DEFAULT_POLICIES.filter((p) =>
    p.name.toLowerCase().includes(policySearch.toLowerCase()) ||
    p.description.toLowerCase().includes(policySearch.toLowerCase())
  );

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (usernameError) setUsernameError('');
  };

  return {
    isOpen,
    colorMode,
    iamUsers,
    deleteIamUser,
    isCreatingUser,
    currentStep,
    setCurrentStep,
    searchFilter,
    setSearchFilter,
    username,
    selectedPolicies,
    policySearch,
    setPolicySearch,
    usernameError,
    computedAccessType,
    resetWizard,
    onClose,
    handleStartCreate,
    handleNextStep1,
    handleNextStep2,
    handleFinishCreate,
    isAdminSelected,
    isOtherSelected,
    togglePolicy,
    filteredUsers,
    filteredPolicies,
    handleUsernameChange,
  };
};
