import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { KubeIAMUser } from '../../types';
import { useKubeIamWizard, getAttachedRolesForUser } from '../../activities/modals';
import {
  IAMUserDetailView,
  IAMUserListView,
  IAMStepper,
  IAMStep1Details,
  IAMStep2Permissions,
  IAMStep3Review,
  IAMWizardFooter,
} from './KubeIAM';

export const KubeIAMModal: React.FC = () => {
  const {
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
  } = useKubeIamWizard();

  const [selectedUserDetail, setSelectedUserDetail] = useState<KubeIAMUser | null>(null);
  const nodes = useFlowStore((state) => state.nodes);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const setActiveIdentity = useFlowStore((state) => state.setActiveIdentity);
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const setKubeIamModalOpen = useFlowStore((state) => state.setKubeIamModalOpen);

  const handleNavigateToRole = (nodeId: string, nodeLabel: string) => {
    setKubeIamModalOpen(false);
    setRoleModalTargetNode({ id: nodeId, label: nodeLabel });
  };

  const renderBodyContent = () => {
    if (selectedUserDetail) {
      return (
        <IAMUserDetailView
          user={selectedUserDetail}
          isActive={activeIdentity === selectedUserDetail.username}
          isDark={colorMode === 'dark'}
          attachedRoles={getAttachedRolesForUser(nodes, selectedUserDetail.username)}
          onBack={() => setSelectedUserDetail(null)}
          onSelectActive={setActiveIdentity}
          onDeleteUser={deleteIamUser}
          onNavigateToRole={handleNavigateToRole}
        />
      );
    }

    if (!isCreatingUser) {
      return (
        <IAMUserListView
          iamUsers={iamUsers}
          filteredUsers={filteredUsers}
          searchFilter={searchFilter}
          colorMode={colorMode}
          onSearchChange={setSearchFilter}
          onStartCreate={handleStartCreate}
          onSelectUser={(u) => setSelectedUserDetail(u)}
          onDeleteUser={deleteIamUser}
        />
      );
    }

    return (
      <div className="flex flex-1 gap-6 overflow-hidden">
        <IAMStepper
          currentStep={currentStep}
          colorMode={colorMode}
          onReset={resetWizard}
        />

        <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
          {currentStep === 1 && (
            <IAMStep1Details
              username={username}
              usernameError={usernameError}
              colorMode={colorMode}
              onUsernameChange={handleUsernameChange}
            />
          )}

          {currentStep === 2 && (
            <IAMStep2Permissions
              username={username}
              selectedPolicies={selectedPolicies}
              policySearch={policySearch}
              filteredPolicies={filteredPolicies}
              isAdminSelected={isAdminSelected}
              isOtherSelected={isOtherSelected}
              colorMode={colorMode}
              onPolicySearchChange={setPolicySearch}
              onTogglePolicy={togglePolicy}
            />
          )}

          {currentStep === 3 && (
            <IAMStep3Review
              username={username}
              computedAccessType={computedAccessType}
              selectedPolicies={selectedPolicies}
              colorMode={colorMode}
            />
          )}

          <IAMWizardFooter
            currentStep={currentStep}
            colorMode={colorMode}
            onPrevious={() => setCurrentStep((prev) => (prev - 1) as 1 | 2)}
            onNext={currentStep === 1 ? handleNextStep1 : handleNextStep2}
            onFinish={handleFinishCreate}
          />
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setSelectedUserDetail(null);
        onClose();
      }}
      title="Kube IAM Management"
      icon={UserCheck}
      iconColorClass="text-emerald-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="max-h-[85vh] h-[70vh]"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {renderBodyContent()}
      </div>
    </Modal>
  );
};
