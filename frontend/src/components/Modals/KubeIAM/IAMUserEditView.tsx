import React, { useState } from 'react';
import { Edit3, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { KubeIAMPolicy, KubeIAMUser } from '@/types';
import { DEFAULT_POLICIES, IAMStep, IAMAccessType } from '@/activity/modals';
import {
  IAMStepper,
  IAMStep1Details,
  IAMStep2Permissions,
  IAMStep3Review,
  IAMWizardFooter,
} from './IAMWizardComponents';

export interface IAMUserEditViewProps {
  readonly user: KubeIAMUser;
  readonly isDark: boolean;
  readonly onCancel: () => void;
  readonly onFinish: (username: string, policies: KubeIAMPolicy[]) => void;
}

export const IAMUserEditView: React.FC<IAMUserEditViewProps> = ({
  user,
  isDark,
  onCancel,
  onFinish,
}) => {
  const iamUsers = useFlowStore((state) => state.iamUsers);

  const [editStep, setEditStep] = useState<IAMStep>(1);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editPolicies, setEditPolicies] = useState<string[]>(user.policies?.map((p) => p.name) || ['AdministratorAccess']);
  const [editPolicySearch, setEditPolicySearch] = useState('');
  const [editUsernameError, setEditUsernameError] = useState('');

  const handleEditNextStep1 = () => {
    if (!editUsername.trim()) {
      setEditUsernameError('Username is required');
      return;
    }
    const exists = iamUsers.some((u) => u.id !== user.id && u.username.toLowerCase() === editUsername.trim().toLowerCase());
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

  const filteredEditPolicies = DEFAULT_POLICIES.filter((p) =>
    p.name.toLowerCase().includes(editPolicySearch.toLowerCase()) ||
    p.description.toLowerCase().includes(editPolicySearch.toLowerCase())
  );

  const editComputedAccessType: IAMAccessType = isEditAdminSelected ? 'Full Access' : 'Managed Access';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/50">
        <div>
          <h3 className={cn('text-sm font-bold flex items-center gap-2', isDark ? 'text-slate-100' : 'text-slate-800')}>
            <Edit3 size={16} className="text-indigo-400" />
            Edit User Profile ({user.username})
          </h3>
          <p className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Modify user credentials and permission policy assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer',
            isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
          )}
        >
          <X size={14} />
          Cancel Editing
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <IAMStepper
          currentStep={editStep}
          colorMode={isDark ? 'dark' : 'light'}
          isEditMode={true}
          onReset={onCancel}
        />

        <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
          {editStep === 1 && (
            <IAMStep1Details
              username={editUsername}
              usernameError={editUsernameError}
              colorMode={isDark ? 'dark' : 'light'}
              onUsernameChange={(val) => {
                setEditUsername(val);
                if (editUsernameError) setEditUsernameError('');
              }}
            />
          )}

          {editStep === 2 && (
            <IAMStep2Permissions
              username={editUsername}
              selectedPolicies={editPolicies}
              policySearch={editPolicySearch}
              filteredPolicies={filteredEditPolicies}
              isAdminSelected={isEditAdminSelected}
              isOtherSelected={isEditOtherSelected}
              colorMode={isDark ? 'dark' : 'light'}
              onPolicySearchChange={setEditPolicySearch}
              onTogglePolicy={toggleEditPolicy}
            />
          )}

          {editStep === 3 && (
            <IAMStep3Review
              username={editUsername}
              computedAccessType={editComputedAccessType}
              selectedPolicies={editPolicies}
              colorMode={isDark ? 'dark' : 'light'}
              isEditMode={true}
            />
          )}

          <IAMWizardFooter
            currentStep={editStep}
            colorMode={isDark ? 'dark' : 'light'}
            isEditMode={true}
            onPrevious={() => setEditStep((prev) => (prev - 1) as 1 | 2)}
            onNext={editStep === 1 ? handleEditNextStep1 : () => { if (editPolicies.length > 0) setEditStep(3); }}
            onFinish={handleFinishEdit}
          />
        </div>
      </div>
    </div>
  );
};
