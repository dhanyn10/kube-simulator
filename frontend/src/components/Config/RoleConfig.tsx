import { Shield, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { K8sNodeData, K8sRoleRule } from '@/types';
import {
  AVAILABLE_VERBS,
  getVerbButtonStyles,
  useRoleConfigHandler
} from '@/activity/config';

interface RoleConfigProps {
  data: K8sNodeData;
  nodeId: string;
}

export const RoleConfig = ({ data, nodeId }: RoleConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const rules: K8sRoleRule[] = data.rules || [];

  const {
    handleDisconnectResource,
    handleAddRule,
    handleRemoveRule,
    handleToggleVerb
  } = useRoleConfigHandler(nodeId, rules);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-indigo-400" />
          <h3 className={cn("text-xs font-bold uppercase tracking-wider", colorMode === 'dark' ? "text-slate-200" : "text-slate-700")}>
            RBAC Role Rules
          </h3>
        </div>
        <button
          type="button"
          onClick={handleAddRule}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <Plus size={10} /> Add Rule
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule, ruleIdx) => {
          const ruleKey = `role-rule-${rule.apiGroups?.join('_') || 'core'}-${rule.resources?.join('_') || 'empty'}-${rule.verbs?.join('_') || 'none'}`;
          return (
            <div
              key={ruleKey}
              className={cn(
                "p-2.5 rounded-lg border space-y-2 relative group",
                colorMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-indigo-400 font-mono">
                  Rule #{ruleIdx + 1}
                </span>
                {rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(ruleIdx)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Remove rule"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("block text-[9px] font-semibold", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>
                    Target Resources:
                  </span>
                  <span className="text-[8px] text-slate-500 italic">
                    (Click badge to disconnect edge)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rule.resources && rule.resources.length > 0 ? (
                    rule.resources.map((res) => (
                      <button
                        key={`res-item-${res}`}
                        type="button"
                        onClick={() => handleDisconnectResource(res)}
                        title="Click to disconnect resource"
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 transition-colors cursor-pointer"
                      >
                        {res} ×
                      </button>
                    ))
                  ) : (
                    <span className="text-[9px] text-amber-400/80 italic">
                      No target resources connected. Connect Role to a workload card on canvas.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className={cn("block text-[9px] font-semibold mb-1", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>
                  Allowed Verbs:
                </span>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_VERBS.map((verb) => {
                    const isSelected = rule.verbs?.includes(verb);
                    return (
                      <button
                        key={`verb-item-${verb}`}
                        type="button"
                        onClick={() => handleToggleVerb(ruleIdx, verb)}
                        className={cn(
                          "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                          getVerbButtonStyles(isSelected, colorMode)
                        )}
                      >
                        {verb}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {rules.length === 0 && (
          <div className="text-center py-4 text-slate-500 text-[10px]">
            No RBAC rules defined. Click "Add Rule" to start.
          </div>
        )}
      </div>
    </div>
  );
};
