import { useState, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { cn, sanitizeSlug } from '@/lib/utils';
import { isDuplicateResourceName, resolveTargetInfo } from '@/store/handlers/nodeUtils';
import { Type, Terminal, Shuffle, AlertCircle } from 'lucide-react';
import { ConfigInput, ConfigLabel } from '@/components/UI/ConfigUI';
import {
  WorkloadConfig,
  ServiceConfig,
  IngressConfig,
  HPAConfig,
  InternetConfig,
  PVCConfig,
  DataResourceConfig,
  RoleConfig
} from './';
import { RoleSettingsSection } from './RoleSettingsSection';
import { ConfigMapSettingsSection } from './ConfigMapSettingsSection';
import { SecretSettingsSection } from './SecretSettingsSection';
import { HPASettingsSection } from './HPASettingsSection';
import { ResourceLimitSettingsSection } from './ResourceLimitSettingsSection';
import { useNodeConfigHandler } from '@/activities/config';

interface NodeNameInputProps {
  nodeId: string;
  value: string;
  placeholder: string;
  className?: string;
  colorMode: string;
  onUpdate: (val: string) => void;
  targetType?: string;
  targetParentId?: string;
  excludeNodeId?: string;
}

export { resolveTargetInfo };

export const NodeNameInput = ({
  nodeId,
  value,
  placeholder,
  className = 'font-mono flex-1 min-w-0',
  colorMode,
  onUpdate,
  targetType,
  targetParentId,
  excludeNodeId,
}: NodeNameInputProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const [localVal, setLocalVal] = useState(value || '');
  const [validationState, setValidationState] = useState<'idle' | 'match_error'>('idle');
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    setLocalVal(value || '');
    setValidationState('idle');
    setValidationMessage('');
  }, [nodeId, value]);

  const checkCandidate = (raw: string): { clean: string; isDup: boolean; type: string } => {
    const clean = sanitizeSlug(raw);
    if (!clean) return { clean: '', isDup: false, type: '' };

    const { type, parentId, excludeId } = resolveTargetInfo(nodeId, nodes, targetType, targetParentId, excludeNodeId);
    const isDup = isDuplicateResourceName(clean, type, parentId, nodes, excludeId);
    return { clean, isDup, type };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);

    const { clean, isDup, type } = checkCandidate(raw);
    if (isDup) {
      setValidationState('match_error');
      setValidationMessage(type === 'Namespace' ? 'Namespace already exists' : 'Name already exists');
      return;
    }

    setValidationState('idle');
    setValidationMessage('');

    if (!raw.endsWith('-') && !raw.endsWith(' ') && clean !== value) {
      onUpdate(clean);
    }
  };

  const handleBlur = () => {
    const { clean, isDup } = checkCandidate(localVal);
    if (!clean) {
      setLocalVal(value || '');
      setValidationState('idle');
      setValidationMessage('');
      return;
    }

    if (isDup) {
      // Like web password input: keep user's typed input, stay in error state, do NOT commit to store
      return;
    }

    setValidationState('idle');
    setValidationMessage('');

    if (clean !== value) {
      onUpdate(clean);
      setLocalVal(clean);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setLocalVal(value || '');
      setValidationState('idle');
      setValidationMessage('');
    }
  };

  const isMatchError = validationState === 'match_error';

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <ConfigInput
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={63}
        colorMode={colorMode}
        className={cn(
          className,
          isMatchError && "!border-rose-500 focus:!border-rose-500 text-rose-500 dark:text-rose-400"
        )}
      />
      {isMatchError && (
        <span
          data-testid="duplicate-name-error"
          className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-1 leading-tight flex items-center gap-1"
        >
          <AlertCircle size={11} className="shrink-0" />
          <span>{validationMessage}</span>
        </span>
      )}
    </div>
  );
};

interface NodeConfigProps {
  selectedNode: any;
}

export const NodeConfig = ({ selectedNode }: NodeConfigProps) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const colorMode = useFlowStore((state) => state.colorMode);

  const {
    data,
    podHash,
    podBaseName,
    updatePodBaseName,
    toggleVisibility,
    toggleYaml,
    performUpdate,
    randomizePodHash
  } = useNodeConfigHandler(selectedNode);

  const renderConfig = () => {
    const props = { selectedNode, performUpdate, toggleVisibility, toggleYaml };

    switch (selectedNode.type) {
      case 'Pod':
      case 'Deployment':
      case 'StatefulSet':
        return <WorkloadConfig {...props} />;
      case 'Service':
        return <ServiceConfig {...props} />;
      case 'Ingress':
        return <IngressConfig {...props} />;
      case 'HPA':
        return <HPAConfig {...props} />;
      case 'Internet':
        return <InternetConfig {...props} />;
      case 'PVC':
        return <PVCConfig {...props} />;
      case 'ConfigMap':
      case 'Secret':
        return <DataResourceConfig {...props} />;
      case 'Role':
        return <RoleConfig data={data} nodeId={selectedNode.id} />;
      default:
        return null;
    }
  };

  const isWorkload = selectedNode.type === 'Pod' || selectedNode.type === 'Deployment' || selectedNode.type === 'StatefulSet' || selectedNode.type === 'ReplicaSet';
  const isConfiguredWorkload = isWorkload
    ? data.status === 'ready' && !!data.image
    : true;

  const isReady = isConfiguredWorkload && (
    data.status === 'ready' ||
    ['Deployment', 'StatefulSet', 'Service', 'Ingress', 'HPA', 'Internet', 'Namespace', 'PVC', 'ConfigMap', 'Secret', 'Role'].includes(selectedNode.type)
  );

  return (
    <div className="space-y-4">
      {/* Basic Node Configuration */}
      {selectedNode.type === 'Pod' ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <ConfigLabel>
              <Type size={10} /> Name (Base)
            </ConfigLabel>
            <NodeNameInput
              nodeId={selectedNode.id}
              value={podBaseName}
              placeholder="pod-name"
              colorMode={colorMode}
              className="font-mono w-full"
              onUpdate={updatePodBaseName}
            />
          </div>

          <div className="space-y-1.5">
            <ConfigLabel>
              <Shuffle size={10} /> Suffix (Read-Only)
            </ConfigLabel>
            <div className="flex items-center gap-1.5">
              <ConfigInput
                value={podHash}
                readOnly
                placeholder="suffix"
                colorMode={colorMode}
                className="font-mono flex-1 min-w-0 opacity-80 cursor-not-allowed"
                data-testid="pod-suffix-input"
              />
              <button
                type="button"
                title="Randomize Pod Hash"
                data-testid="randomize-pod-hash-btn"
                onClick={randomizePodHash}
                className={cn(
                  "p-2 rounded border transition-colors flex items-center justify-center shrink-0",
                  colorMode === 'dark'
                    ? "bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300"
                    : "bg-slate-100 border-slate-200 text-cyan-600 hover:bg-slate-200 hover:text-cyan-700"
                )}
              >
                <Shuffle size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <ConfigLabel>
            <Type size={10} /> Name
          </ConfigLabel>
          <div className="flex items-center gap-1.5">
            <NodeNameInput
              nodeId={selectedNode.id}
              value={data.label || ''}
              placeholder="node-name"
              colorMode={colorMode}
              className="font-mono flex-1 min-w-0"
              onUpdate={(newLabel) => updateNodeData(selectedNode.id, { label: newLabel })}
            />
          </div>
        </div>
      )}

      {renderConfig()}

      {((data.roles && data.roles.length > 0) || (data.configMaps && data.configMaps.length > 0) || (data.secrets && data.secrets.length > 0) || (data.hpas && data.hpas.length > 0) || (data.resourceLimits && data.resourceLimits.length > 0)) && (
        <div className="pt-2 border-t border-slate-700/30 flex flex-wrap items-center gap-2">
          {selectedNode.type !== 'Role' && (
            <RoleSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          {selectedNode.type !== 'ConfigMap' && selectedNode.type !== 'Role' && (
            <ConfigMapSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          {selectedNode.type !== 'Secret' && selectedNode.type !== 'Role' && (
            <SecretSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          <ResourceLimitSettingsSection data={data} nodeId={selectedNode.id} />

          <HPASettingsSection data={data} nodeId={selectedNode.id} />
        </div>
      )}

      {['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet'].includes(selectedNode.type) && (
        <button
          type="button"
          onClick={() => {
            const setTerminalOpen = useFlowStore.getState().setTerminalOpen;
            const setTerminalActiveTab = useFlowStore.getState().setTerminalActiveTab;
            const setTerminalSelectedResourceId = useFlowStore.getState().setTerminalSelectedResourceId;

            setTerminalSelectedResourceId(selectedNode.id);
            setTerminalActiveTab('logs');
            setTerminalOpen(true);
          }}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 px-4 rounded text-xs font-bold transition-all border shadow-sm mt-4",
            colorMode === 'dark'
              ? "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300"
              : "bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200 hover:text-emerald-700"
          )}
        >
          <Terminal size={13} />
          View Logs (kubectl logs)
        </button>
      )}

      <div className={cn(
        "mt-6 pt-4 border-t text-center",
        isReady ? "text-emerald-500" : "text-red-500"
      )}>
        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
          Status: {isReady ? 'Ready to Deploy' : 'Configuration Required'}
        </span>
      </div>
    </div>
  );
};
