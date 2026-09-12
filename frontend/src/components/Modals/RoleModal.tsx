import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { K8sRoleItem } from '@/types';
import { cn } from '@/lib/utils';
import { useRoleModal } from '@/activities/modals';
import {
  RoleModalHeaderHint,
  RoleSubjectsSection,
  RoleRulesSection,
} from './RoleModal/index';

export interface RoleModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly targetNodeLabel?: string;
  readonly initialRole?: K8sRoleItem | null;
  readonly onSave: (roleItem: K8sRoleItem) => void;
}

/**
 * RoleModal component for attaching and editing Kubernetes RBAC Roles & RoleBindings.
 *
 * @param props RoleModalProps
 * @returns JSX Element | null
 */
export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialRole,
  onSave,
}) => {
  const {
    colorMode,
    roleName,
    setRoleName,
    assignedUsers,
    userSearchQuery,
    setUserSearchQuery,
    isUserDropdownOpen,
    setIsUserDropdownOpen,
    userDropdownRef,
    rules,
    iamUsers,
    filteredAvailableUsers,
    handleAddRule,
    handleRemoveRule,
    handleUpdateRuleTags,
    toggleUserAssignment,
    handleOpenIamModal,
    handleSave,
  } = useRoleModal({
    isOpen,
    targetNodeId,
    initialRole,
    onClose,
    onSave,
  });

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          colorMode === 'dark'
            ? "border-slate-700 hover:bg-slate-800 text-slate-300"
            : "border-slate-300 hover:bg-slate-100 text-slate-700"
        )}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all cursor-pointer"
      >
        {initialRole ? 'Update Role' : 'Attach Role'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRole ? 'Edit Role & RoleBinding' : 'Attach RBAC Role & RoleBinding'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Role Permissions & RoleBinding Assignments'}
      icon={ShieldCheck}
      iconColorClass="text-indigo-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <RoleModalHeaderHint colorMode={colorMode} />

      <div className="space-y-4">
        <div>
          <label
            htmlFor="role-name-input"
            className={cn(
              "block text-xs font-semibold mb-1",
              colorMode === 'dark' ? "text-slate-300" : "text-slate-800"
            )}
          >
            Role Name
          </label>
          <input
            id="role-name-input"
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. app-reader-role"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 transition-all",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-100 focus:ring-slate-400"
                : "bg-white border-slate-300 text-slate-900 focus:ring-slate-800"
            )}
          />
        </div>

        <RoleSubjectsSection
          iamUsers={iamUsers}
          assignedUsers={assignedUsers}
          userSearchQuery={userSearchQuery}
          isUserDropdownOpen={isUserDropdownOpen}
          colorMode={colorMode}
          filteredAvailableUsers={filteredAvailableUsers}
          userDropdownRef={userDropdownRef}
          onOpenIamModal={handleOpenIamModal}
          onSearchChange={setUserSearchQuery}
          onDropdownOpenChange={setIsUserDropdownOpen}
          onToggleAssignment={toggleUserAssignment}
        />

        <RoleRulesSection
          rules={rules}
          colorMode={colorMode}
          onAddRule={handleAddRule}
          onRemoveRule={handleRemoveRule}
          onUpdateRuleTags={handleUpdateRuleTags}
        />
      </div>
    </Modal>
  );
};
