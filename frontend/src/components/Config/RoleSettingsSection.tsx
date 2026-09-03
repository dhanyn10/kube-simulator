import React, { useState } from 'react';
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sRoleItem } from '../../types';
import { RoleModal } from '../Modals/RoleModal';

interface RoleSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const RoleSettingsSection: React.FC<RoleSettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingRole, setEditingRole] = useState<K8sRoleItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roles: K8sRoleItem[] = data.roles || [];

  const handleOpenAdd = () => {
    setEditingRole(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: K8sRoleItem) => {
    setEditingRole(role);
    setIsModalOpen(true);
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
    setIsModalOpen(false);
  };

  const displayLimit = 12;
  const visibleRoles = roles.slice(0, displayLimit);
  const overflowCount = roles.length - displayLimit;

  return (
    <div className="space-y-2.5 pt-3 border-t border-slate-700/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={cn("text-sm font-bold tracking-tight flex items-center gap-1.5", colorMode === 'dark' ? "text-slate-100" : "text-slate-900")}>
            Attached Roles
          </h3>
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full font-mono", colorMode === 'dark' ? "bg-slate-800 text-slate-300 border border-slate-700" : "bg-slate-200 text-slate-700")}>
            {roles.length}
          </span>
        </div>
      </div>

      {/* Circular Avatar Grid / Wrap (GitHub Contributors style) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {visibleRoles.map((role) => (
          <div key={`avatar-role-${role.id}`} className="relative group">
            <button
              type="button"
              onClick={() => handleOpenEdit(role)}
              className={cn(
                "w-9 h-9 rounded-full border-2 flex items-center justify-center font-mono text-xs font-black uppercase transition-all transform hover:scale-110 shadow-sm cursor-pointer relative overflow-hidden",
                colorMode === 'dark'
                  ? "bg-indigo-950/80 border-indigo-500/60 text-indigo-300 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-400/30"
                  : "bg-indigo-100 border-indigo-300 text-indigo-800 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20"
              )}
              title={`Role: ${role.name} (Click to edit)`}
            >
              <span>{role.name.substring(0, 2)}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRole(role.id, role.name);
              }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer hover:bg-red-500"
              title={`Delete role ${role.name}`}
            >
              <Trash2 size={9} />
            </button>
          </div>
        ))}

        {/* Circular Add Role Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className={cn(
            "w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center transition-all transform hover:scale-105 cursor-pointer shadow-sm",
            colorMode === 'dark'
              ? "border-slate-700 hover:border-indigo-400 text-slate-400 hover:text-indigo-300 bg-slate-900/50"
              : "border-slate-300 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 bg-slate-50"
          )}
          title="Add new role"
        >
          <Plus size={16} />
        </button>
      </div>

      {overflowCount > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            + {overflowCount} more roles
          </button>
        </div>
      )}

      {roles.length === 0 && (
        <div className="text-[11px] text-slate-500 italic pt-0.5">
          No roles attached. Click <span className="font-semibold text-indigo-400">+</span> or drag Role from sidebar.
        </div>
      )}

      <RoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialRole={editingRole}
        onSave={handleSaveRole}
      />
    </div>
  );
};
