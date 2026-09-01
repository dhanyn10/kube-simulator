import { Shield, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sRoleRule, K8sResourceType } from '../../types';

interface RoleConfigProps {
  data: K8sNodeData;
  nodeId: string;
}

const AVAILABLE_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'];
const AVAILABLE_RESOURCES = ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'persistentvolumeclaims'];

const RESOURCE_TYPE_MAP: Record<string, K8sResourceType> = {
  pods: 'Pod',
  deployments: 'Deployment',
  services: 'Service',
  configmaps: 'ConfigMap',
  secrets: 'Secret',
  persistentvolumeclaims: 'PVC',
};

export const RoleConfig = ({ data, nodeId }: RoleConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const rules: K8sRoleRule[] = data.rules || [];

  const handleAddRule = () => {
    const newRules = [
      ...rules,
      {
        apiGroups: [''],
        resources: ['pods'],
        verbs: ['get', 'list']
      }
    ];
    updateNodeData(nodeId, { rules: newRules });
  };

  const handleRemoveRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    updateNodeData(nodeId, { rules: newRules });
  };

  const handleToggleVerb = (ruleIndex: number, verb: string) => {
    const newRules = [...rules];
    const currentVerbs = newRules[ruleIndex].verbs || [];
    if (currentVerbs.includes(verb)) {
      newRules[ruleIndex].verbs = currentVerbs.filter(v => v !== verb);
    } else {
      newRules[ruleIndex].verbs = [...currentVerbs, verb];
    }
    updateNodeData(nodeId, { rules: newRules });
  };


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
        {rules.map((rule, ruleIdx) => (
          <div
            key={`role-rule-${ruleIdx}`}
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
                <label className={cn("block text-[9px] font-semibold", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>
                  Target Resources:
                </label>
                <span className="text-[8px] text-slate-500 italic">
                  (Auto-synced from connected canvas nodes)
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {rule.resources && rule.resources.length > 0 ? (
                  rule.resources.map((res) => (
                    <span
                      key={`res-${ruleIdx}-${res}`}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold"
                    >
                      {res}
                    </span>
                  ))
                ) : (
                  <span className="text-[9px] text-amber-400/80 italic">
                    Connect Role to a target node on canvas (e.g. Deployment, Service, Pod)
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className={cn("block text-[9px] font-semibold mb-1", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>
                Allowed Verbs:
              </label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VERBS.map((verb) => {
                  const isSelected = rule.verbs?.includes(verb);
                  return (
                    <button
                      key={`verb-${ruleIdx}-${verb}`}
                      type="button"
                      onClick={() => handleToggleVerb(ruleIdx, verb)}
                      className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold"
                          : colorMode === 'dark' ? "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600" : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
                      )}
                    >
                      {verb}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="text-center py-4 text-slate-500 text-[10px]">
            No RBAC rules defined. Click "Add Rule" to start.
          </div>
        )}
      </div>
    </div>
  );
};
