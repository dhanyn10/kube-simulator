import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sRoleItem } from '../../types';
import { RoleModal } from '../Modals/RoleModal';
import { RoleListModal } from '../Modals/RoleListModal';

interface RoleSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const RoleSettingsSection: React.FC<RoleSettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingRole, setEditingRole] = useState<K8sRoleItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const roles: K8sRoleItem[] = data.roles || [];

  const handleOpenEdit = (role: K8sRoleItem) => {
    setEditingRole(role);
    setIsEditModalOpen(true);
  };

  const handleAddNewRole = () => {
    setEditingRole(null);
    setIsEditModalOpen(true);
  };

  const handleDeleteRole = (roleId: string, roleName: string) => {
    const updated = roles.filter((r) => r.id !== roleId);
    updateNodeData(nodeId, { roles: updated });
    addLog('info', `[Role Removed] Removed role "${roleName}" from node`, 'UI');
  };

  const handleSaveRole = (roleItem: K8sRoleItem) => {
    const existingIndex = roles.findIndex((r) => r.id === roleItem.id);
    let updated: K8sRoleItem[];
    if (existingIndex >= 0) {
      updated = [...roles];
      updated[existingIndex] = roleItem;
    } else {
      updated = [...roles, roleItem];
    }
    updateNodeData(nodeId, { roles: updated });
    addLog('info', `[Role Saved] Updated role "${roleItem.name}"`, 'UI');
    setIsEditModalOpen(false);
  };

  if (roles.length === 0) return null;

  return (
    <>
      {/* Single Role Hero Item Icon with Notification Count Badge */}
      <div className="relative group inline-block">
        <button
          type="button"
          onClick={() => setIsListModalOpen(true)}
          className={cn(
            "p-2 rounded-md border flex items-center justify-center transition-all cursor-pointer relative shadow-sm hover:scale-105",
            colorMode === 'dark'
              ? "bg-slate-900/80 border-indigo-500/50 text-indigo-400 hover:border-indigo-400"
              : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:border-indigo-400"
          )}
          title={`Attached Roles (${roles.length})`}
        >
          <ShieldCheck size={18} />

          {/* Notification Badge with Number (Only rendered when count > 1) */}
          {roles.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-md border border-slate-900 animate-in zoom-in-75 duration-150">
              {roles.length}
            </span>
          )}
        </button>
      </div>

      {/* Role List Modal replacing dropdown popover */}
      <RoleListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        targetNodeLabel={data.label || nodeId}
        roles={roles}
        onEditRole={handleOpenEdit}
        onDeleteRole={handleDeleteRole}
        onAddNewRole={handleAddNewRole}
      />

      {/* Role Config & Edit Modal */}
      <RoleModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialRole={editingRole}
        onSave={handleSaveRole}
      />
    </>
  );
};
