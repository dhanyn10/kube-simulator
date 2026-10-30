import React from 'react';
import { Shield, Settings, Lock, Activity, Layers } from 'lucide-react';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';

export interface AttachedResourcesFooterProps {
  readonly data: K8sNodeData;
  readonly nodeId?: string;
}

interface ConfigMapBadgeProps {
  readonly configMaps?: readonly any[];
  readonly nodeId?: string;
  readonly nodeLabel: string;
}

const ConfigMapBadge: React.FC<ConfigMapBadgeProps> = ({ configMaps, nodeId, nodeLabel }) => {
  const setConfigMapModalTargetNode = useFlowStore((state) => state.setConfigMapModalTargetNode);

  if (!configMaps || configMaps.length === 0) return null;

  const count = configMaps.length;
  const isMultiple = count > 1;
  const firstCm = configMaps[0];
  const title = isMultiple
    ? `ConfigMaps (${count}): ${configMaps.map((cm) => cm.name || cm.id || 'Unnamed').join(', ')}`
    : `ConfigMap: ${firstCm.name || firstCm.id || 'Unnamed'}`;
  const ariaLabel = isMultiple
    ? `Inspect ConfigMaps (${count})`
    : `Inspect ConfigMap ${firstCm.name || firstCm.id || 'Unnamed'}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nodeId) return;
    setConfigMapModalTargetNode({
      id: nodeId,
      label: nodeLabel,
      initialItem: firstCm,
      ...(isMultiple ? { initialViewMode: 'list' as const } : {}),
    });
  };

  return (
    <button
      type="button"
      className="node-attached-badge-configmap relative border-0 outline-none flex items-center justify-center cursor-pointer"
      title={title}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      <Settings size={11} />
      {isMultiple && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[13px] h-[13px] px-0.5 rounded-full bg-slate-900 text-teal-300 text-[8px] font-bold font-mono flex items-center justify-center shadow border border-teal-500/70 leading-none pointer-events-none"
          data-testid="configmap-count-badge"
        >
          {count}
        </span>
      )}
    </button>
  );
};

/**
 * Reusable Card Footer component for rendering attached resources
 * (Roles, ConfigMaps, Secrets, HPAs, ResourceLimits) on canvas nodes.
 * Allows direct 1-click inspection and editing of attached configurations.
 */
export const AttachedResourcesFooter: React.FC<AttachedResourcesFooterProps> = ({ data, nodeId }) => {
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const setSecretModalTargetNode = useFlowStore((state) => state.setSecretModalTargetNode);
  const setHpaModalTargetNode = useFlowStore((state) => state.setHpaModalTargetNode);
  const setResourceLimitModalTargetNode = useFlowStore((state) => state.setResourceLimitModalTargetNode);

  const hasAttached = Boolean(
    (data.roles && data.roles.length > 0) ||
    (data.configMaps && data.configMaps.length > 0) ||
    (data.secrets && data.secrets.length > 0) ||
    (data.hpas && data.hpas.length > 0) ||
    (data.resourceLimits && data.resourceLimits.length > 0)
  );

  if (!hasAttached) return null;

  const nodeLabel = (data.label as string) || nodeId || '';

  return (
    <div className="node-attached-footer" data-testid="node-attached-footer">
      {data.roles?.map((role: any) => {
        const usersText = role.assignedUsers && role.assignedUsers.length > 0
          ? ` (Users: ${role.assignedUsers.join(', ')})`
          : '';
        return (
          <button
            type="button"
            key={role.id || role.name}
            className="node-attached-badge-role border-0 outline-none flex items-center justify-center cursor-pointer"
            title={`Role: ${role.name}${usersText}`}
            aria-label={`Inspect Role ${role.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) {
                setRoleModalTargetNode({ id: nodeId, label: nodeLabel, initialItem: role });
              }
            }}
          >
            <Shield size={11} />
          </button>
        );
      })}
      <ConfigMapBadge
        configMaps={data.configMaps}
        nodeId={nodeId}
        nodeLabel={nodeLabel}
      />
      {data.secrets?.map((sec: any) => (
        <button
          type="button"
          key={sec.id || sec.name}
          className="node-attached-badge-secret border-0 outline-none flex items-center justify-center cursor-pointer"
          title={`Secret: ${sec.name || sec.id || 'Unnamed'}`}
          aria-label={`Inspect Secret ${sec.name || sec.id || 'Unnamed'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (nodeId) {
              setSecretModalTargetNode({ id: nodeId, label: nodeLabel, initialItem: sec });
            }
          }}
        >
          <Lock size={11} />
        </button>
      ))}
      {data.resourceLimits?.map((res: any) => {
        const details = ` (CPU: ${res.cpuRequest || '500m'} / ${res.cpuLimit || '1000m'} | Mem: ${res.memoryRequest || '256Mi'} / ${res.memoryLimit || '512Mi'})`;
        return (
          <button
            type="button"
            key={res.id || res.name}
            className="node-attached-badge-resource-limit border-0 outline-none flex items-center justify-center cursor-pointer"
            title={`Resource Limit: ${res.name}${details}`}
            aria-label={`Inspect Resource Limit ${res.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) {
                setResourceLimitModalTargetNode({ id: nodeId, label: nodeLabel, initialItem: res });
              }
            }}
          >
            <Layers size={11} />
          </button>
        );
      })}
      {data.hpas?.map((hpa: any) => {
        const details = (hpa.minReplicas !== undefined && hpa.maxReplicas !== undefined && hpa.targetCPU !== undefined)
          ? ` (Min: ${hpa.minReplicas}, Max: ${hpa.maxReplicas}, CPU: ${hpa.targetCPU}%)`
          : '';
        return (
          <button
            type="button"
            key={hpa.id || hpa.name}
            className="node-attached-badge-hpa border-0 outline-none flex items-center justify-center cursor-pointer"
            title={`HPA: ${hpa.name}${details}`}
            aria-label={`Inspect HPA ${hpa.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) {
                setHpaModalTargetNode({ id: nodeId, label: nodeLabel, initialItem: hpa });
              }
            }}
          >
            <Activity size={11} />
          </button>
        );
      })}
    </div>
  );
};
