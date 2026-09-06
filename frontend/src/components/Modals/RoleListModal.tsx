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
      title="Attached RBAC Roles"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached roles'}
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
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold">User: {role.assignedUser || 'admin-user'}</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {role.accessLevel || 'Full'} Access
            </span>
          </div>
          {role.rules && role.rules.length > 0 ? (
            <div>
              {role.rules.length} rule{role.rules.length > 1 ? 's' : ''} (
              {role.rules.map((r) => r.resources.join(', ')).join('; ')})
            </div>
          ) : (
            <div>No rules defined</div>
          )}
        </div>
      )}
      onEditItem={onEditRole}
      onDeleteItem={onDeleteRole}
      onAddNewItem={onAddNewRole}
    />
  );
};
