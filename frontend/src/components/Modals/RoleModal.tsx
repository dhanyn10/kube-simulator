import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { Modal } from './Modal';
import { K8sRoleItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialRole?: K8sRoleItem | null;
  onSave: (roleItem: K8sRoleItem) => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialRole,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const setIamModalOpen = useFlowStore((state) => state.setIamModalOpen);

  const [roleName, setRoleName] = useState<string>('app-reader-role');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (iamUsers.length > 0 && assignedUsers.length === 0) {
      setAssignedUsers([iamUsers[0].username]);
    }
  }, [iamUsers, assignedUsers]);

  useEffect(() => {
    if (initialRole) {
      setRoleName(initialRole.name || 'app-reader-role');
      const initialUsers = initialRole.assignedUsers && initialRole.assignedUsers.length > 0
        ? initialRole.assignedUsers
        : (initialRole.assignedUser ? [initialRole.assignedUser] : (iamUsers[0] ? [iamUsers[0].username] : ['admin-user']));
      setAssignedUsers(initialUsers);
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setRoleName(`role-${randomSuffix}`);
      setAssignedUsers(iamUsers.length > 0 ? [iamUsers[0].username] : ['admin-user']);
    }
  }, [initialRole, isOpen, targetNodeId, iamUsers]);

  const toggleUserSelection = (uname: string) => {
    setAssignedUsers((prev) =>
      prev.includes(uname) ? prev.filter((u) => u !== uname) : [...prev, uname]
    );
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const finalUsers = assignedUsers.length > 0 ? assignedUsers : [iamUsers[0]?.username || 'admin-user'];

    // Derive rule scope from first user's accessType
    const firstUserObj = iamUsers.find((u) => u.username === finalUsers[0]);
    const userAccess = firstUserObj?.accessType || 'Full';

    const rules = userAccess === 'Full'
      ? [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }]
      : userAccess === 'Read-Only'
      ? [{ apiGroups: ['apps', ''], resources: ['deployments', 'pods', 'services'], verbs: ['get', 'list', 'watch'] }]
      : [{ apiGroups: ['apps', ''], resources: ['deployments', 'pods'], verbs: ['get', 'list', 'watch'] }];

    const roleItem: K8sRoleItem = {
      id: initialRole?.id || `role-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(roleName) || 'unnamed-role',
      assignedUser: finalUsers[0],
      assignedUsers: finalUsers,
      accessLevel: userAccess,
      rules,
    };
    onSave(roleItem);
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
      >
        {initialRole ? 'Update Role' : 'Attach Role'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRole ? 'Edit Role' : 'Attach RBAC Role'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Assign IAM Accounts to Role'}
      icon={ShieldCheck}
      iconColorClass="text-indigo-400"
      widthClass="w-full max-w-xl"
      maxHeightClass="h-[55vh]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Role Name */}
        <div>
          <label htmlFor="role-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
            Role Name *
          </label>
          <input
            id="role-name-input"
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. app-reader-role"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        {/* Assigned IAM Accounts */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Assigned IAM Account(s) *
            </label>
            <button
              type="button"
              onClick={() => setIamModalOpen(true)}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              + Manage Kube IAM Users
            </button>
          </div>

          <div
            className={cn(
              "p-3 rounded-xl border min-h-[50px] flex flex-wrap items-center gap-1.5 transition-all",
              colorMode === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-300"
            )}
          >
            {iamUsers.map((u) => {
              const isSelected = assignedUsers.includes(u.username);
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => toggleUserSelection(u.username)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border transition-all cursor-pointer",
                    isSelected
                      ? "bg-blue-600/30 text-blue-200 border-blue-500 shadow-sm"
                      : colorMode === 'dark'
                      ? "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span>{u.username}</span>
                  <span className="text-[10px] opacity-70">({u.accessType || 'Full'} Access)</span>
                  {isSelected && <X size={12} className="text-blue-400 hover:text-blue-200" />}
                </button>
              );
            })}

            {iamUsers.length === 0 && (
              <span className="text-xs text-slate-500 font-mono italic">
                No IAM Users created yet. Click "+ Manage Kube IAM Users" to create accounts.
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
