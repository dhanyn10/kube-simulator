import React, { useState } from 'react';
import { ShieldCheck, Edit2, Trash2 } from 'lucide-react';
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
  const [showRoleList, setShowRoleList] = useState(false);

  const roles: K8sRoleItem[] = data.roles || [];

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

  if (roles.length === 0) return null;

  return (
    <div className="pt-2 border-t border-slate-700/30">
      <div className="flex flex-wrap items-center gap-3">
        {/* Single Role Hero Item Icon with Notification Count Badge */}
        <div className="relative group inline-block">
          <button
            type="button"
            onClick={() => setShowRoleList((prev) => !prev)}
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

          {/* Quick List Popover when clicking Role hero icon */}
          {showRoleList && (
            <div className={cn(
              "absolute left-0 top-full mt-2 w-64 rounded-lg border shadow-xl z-50 p-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150",
              colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
            )}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1 border-b border-slate-700/30">
                Attached Roles ({roles.length})
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5 p-0.5 custom-scrollbar">
                {roles.map((role) => (
                  <div
                    key={`role-item-${role.id}`}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono transition-colors shadow-xs",
                      colorMode === 'dark'
                        ? "bg-slate-800/90 border-slate-700 text-indigo-300 hover:border-indigo-500/50"
                        : "bg-indigo-50/80 border-indigo-200 text-indigo-800 hover:border-indigo-300"
                    )}
                  >
                    <span className="truncate max-w-[100px] font-semibold">{role.name}</span>
                    <div className="flex items-center gap-0.5 ml-0.5 border-l pl-1 border-slate-600/30">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(role)}
                        className="p-0.5 rounded text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        title="Edit Role"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="p-0.5 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Role"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
