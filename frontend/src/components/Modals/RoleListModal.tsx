import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { AttachedResourceListModal } from './AttachedResourceListModal';
import { K8sRoleItem } from '../../types';

interface RoleListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeLabel?: string;
  roles: K8sRoleItem[];
  onEditRole: (role: K8sRoleItem) => void;
  onDeleteRole: (roleId: string, roleName: string) => void;
  onAddNewRole: () => void;
}

export const RoleListModal: React.FC<RoleListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  roles,
  onEditRole,
  onDeleteRole,
  onAddNewRole,
}) => {
  return (
    <AttachedResourceListModal<K8sRoleItem>
      isOpen={isOpen}
      onClose={onClose}
      title="Attached RBAC Roles & RoleBindings"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached roles & RoleBindings'}
      icon={ShieldCheck}
      iconColorClass="text-indigo-400"
      buttonBgColorClass="bg-indigo-600 hover:bg-indigo-500"
      hoverIconColorClass="hover:text-indigo-300 hover:bg-indigo-500/10"
      items={roles}
      emptyText="No roles attached to this node."
      addLabel="Add Role"
      itemTypeName="Role"
      renderItemDetails={(role) => (
        <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
          <div>
            {role.rules && role.rules.length > 0 ? (
              <span>
                {role.rules.length} rule{role.rules.length > 1 ? 's' : ''} (
                {role.rules.map((r) => r.resources.join(', ')).join('; ')})
              </span>
            ) : (
              <span>No rules defined</span>
            )}
          </div>
          {role.assignedUsers && role.assignedUsers.length > 0 && (
            <div className="text-emerald-400 font-sans font-medium text-[10px]">
              Bound Subjects (RoleBinding): {role.assignedUsers.join(', ')}
            </div>
          )}
        </div>
      )}
      onEditItem={onEditRole}
      onDeleteItem={onDeleteRole}
      onAddNewItem={onAddNewRole}
    />
  );
};
