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
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const addNode = useFlowStore((state) => state.addNode);
  const onConnect = useFlowStore((state) => state.onConnect);
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

  const handleToggleResource = (ruleIndex: number, res: string) => {
    const newRules = [...rules];
    const currentRes = newRules[ruleIndex].resources || [];

    if (currentRes.includes(res)) {
      newRules[ruleIndex].resources = currentRes.filter((r) => r !== res);
      updateNodeData(nodeId, { rules: newRules });
      return;
    }

    // Adding resource: Auto-spawn & connect if needed
    const k8sKind = RESOURCE_TYPE_MAP[res];
    if (k8sKind) {
      const roleNode = nodes.find((n) => n.id === nodeId);
      const rolePos = roleNode?.position || { x: 100, y: 100 };

      // Find if target node of this type is already connected
      const existingConnectedNode = nodes.find((n) => {
        if (n.type !== k8sKind) return false;
        return edges.some(
          (e) => (e.source === nodeId && e.target === n.id) || (e.target === nodeId && e.source === n.id)
        );
      });

      if (!existingConnectedNode) {
        const existingNodeOfKind = nodes.find((n) => n.type === k8sKind && !n.parentId);
        if (existingNodeOfKind) {
          // Connect Role to existing node
          onConnect({
            source: nodeId,
            target: existingNodeOfKind.id,
            sourceHandle: 'right-s',
            targetHandle: 'left-t',
          });
        } else {
          // Auto-spawn new node & connect
          const spawnPos = { x: rolePos.x + 300, y: rolePos.y };
          addNode(k8sKind, spawnPos);
          // Get the newly added node ID after state update
          setTimeout(() => {
            const currentNodes = useFlowStore.getState().nodes;
            const newSpawned = currentNodes.find((n) => n.type === k8sKind && !n.parentId);
            if (newSpawned) {
              useFlowStore.getState().onConnect({
                source: nodeId,
                target: newSpawned.id,
                sourceHandle: 'right-s',
                targetHandle: 'left-t',
              });
            }
          }, 50);
        }
      }
    }

    newRules[ruleIndex].resources = [...currentRes, res];
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
              <label className={cn("block text-[9px] font-semibold mb-1", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>
                Resources:
              </label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_RESOURCES.map((res) => {
                  const isSelected = rule.resources?.includes(res);
                  return (
                    <button
                      key={`res-${ruleIdx}-${res}`}
                      type="button"
                      onClick={() => handleToggleResource(ruleIdx, res)}
                      className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                        isSelected
                          ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold"
                          : colorMode === 'dark' ? "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600" : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
                      )}
                    >
                      {res}
                    </button>
                  );
                })}
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
