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

  return (
    <div className="space-y-2 pt-3 border-t border-slate-700/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield size={13} className="text-indigo-400" />
          <h3 className={cn("text-[11px] font-bold uppercase tracking-wider", colorMode === 'dark' ? "text-slate-300" : "text-slate-700")}>
            Attached Roles
          </h3>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.2 rounded-full", colorMode === 'dark' ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-700")}>
            {roles.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
        >
          <Plus size={11} /> Add Role
        </button>
      </div>

      <div className="divide-y divide-slate-700/30 rounded-lg border border-slate-700/40 overflow-hidden bg-slate-900/40">
        {roles.map((role) => {
          const totalResources = role.rules?.reduce((acc, r) => acc + (r.resources?.length || 0), 0) || 0;
          const totalVerbs = role.rules?.reduce((acc, r) => acc + (r.verbs?.length || 0), 0) || 0;

          return (
            <div
              key={`attached-role-${role.id}`}
              className={cn(
                "px-2.5 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-slate-800/50",
                colorMode === 'dark' ? "text-slate-200" : "text-slate-800 bg-white"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400 font-mono text-[10px] font-bold uppercase">
                  {role.name.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold truncate leading-none mb-1">
                    {role.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                    <span>{totalResources} res</span>
                    <span>•</span>
                    <span>{totalVerbs} verbs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(role)}
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                  title="Edit Role"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                  title="Remove Role"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}

        {roles.length === 0 && (
          <div className="px-3 py-3 text-center text-slate-500 text-[10px] italic">
            No roles attached. Drag Role from sidebar or click "+ Add Role".
          </div>
        )}
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
