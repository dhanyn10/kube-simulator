import React, { useState, useMemo } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '@/store';
import { cn, getPodQoSClass } from '@/lib/utils';
import { K8sConfigMapItem, K8sNodeData, K8sResourceType, K8sSecretItem } from '@/types';
import {
  OverviewItem,
  extractAllOverviewItems,
  filterOverviewItems,
  getResourceOverviewMeta,
} from '@/activities/modals/attachedResourceOverviewHelpers';
import { removeConfigMapFromLocal } from '@/activities/modals/configMapStorageHelpers';
import { removeSecretFromLocal } from '@/activities/modals/secretStorageHelpers';

export interface AttachedResourceOverviewModalProps {
  readonly type: K8sResourceType | null;
  readonly onClose: () => void;
}

const ConfigMapDetails: React.FC<{ readonly item: any; readonly isDark: boolean }> = ({ item, isDark }) => {
  const dataList = Array.isArray(item.configData) ? item.configData : [];
  if (dataList.length === 0) {
    return <span className="text-[10px] text-slate-500 italic">No variables defined</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {dataList.slice(0, 5).map((entry, idx) => (
        <span
          key={`cm-var-${entry.key}-${idx}`}
          className={cn(
            "inline-flex items-center text-[10px] font-mono badge-chip max-w-[200px] truncate",
            isDark
              ? "bg-teal-500/10 text-teal-300 border-teal-500/20"
              : "bg-teal-50 text-teal-700 border-teal-200"
          )}
        >
          <span className={cn("font-semibold mr-1", isDark ? "text-teal-400" : "text-teal-600")}>{entry.key}:</span>
          <span className={cn("truncate", isDark ? "text-slate-300" : "text-slate-700")}>{String(entry.value)}</span>
        </span>
      ))}
      {dataList.length > 5 && (
        <span className="text-[9px] text-slate-500 italic self-center">
          +{dataList.length - 5} more
        </span>
      )}
    </div>
  );
};

const SecretDetails: React.FC<{ readonly item: any; readonly isDark: boolean }> = ({ item, isDark }) => {
  const dataList = Array.isArray(item.secretData) ? item.secretData : [];
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className={cn(
        "text-[9px] uppercase font-bold tracking-wider badge-chip",
        isDark
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "bg-amber-50 text-amber-700 border-amber-200"
      )}>
        {item.type || 'Opaque'}
      </span>
      {dataList.map((entry, idx) => (
        <span
          key={`sec-key-${entry.key}-${idx}`}
          className={cn(
            "text-[10px] font-mono badge-chip",
            isDark
              ? "bg-slate-800 text-slate-300 border-slate-700"
              : "bg-slate-100 text-slate-700 border-slate-200"
          )}
        >
          {entry.key}
        </span>
      ))}
      {dataList.length === 0 && (
        <span className="text-[10px] text-slate-500 italic">No secret keys</span>
      )}
    </div>
  );
};

const RoleDetails: React.FC<{ readonly item: any; readonly isDark: boolean }> = ({ item, isDark }) => {
  const rules = Array.isArray(item.rules) ? item.rules : [];
  const assignedUsers = Array.isArray(item.assignedUsers) ? item.assignedUsers : [];
  return (
    <div className="space-y-0.5 mt-1 text-[11px] font-mono">
      <div className={isDark ? "text-slate-400" : "text-slate-600"}>
        {rules.length > 0 ? (
          <span>
            {rules.length} rule{rules.length > 1 ? 's' : ''} (
            {rules.map((r: any) => (r.resources || []).join(', ')).join('; ')})
          </span>
        ) : (
          <span className="italic text-slate-500">No rules</span>
        )}
      </div>
      {assignedUsers.length > 0 && (
        <div className={cn("text-[10px] font-sans", isDark ? "text-emerald-400" : "text-emerald-600")}>
          Bound Users: {assignedUsers.join(', ')}
        </div>
      )}
    </div>
  );
};

const HpaDetails: React.FC<{ readonly item: any; readonly isDark: boolean }> = ({ item, isDark }) => (
  <div className={cn("flex items-center gap-2 mt-1 text-[11px] font-mono", isDark ? "text-purple-300" : "text-purple-700")}>
    <span className={cn("badge-chip", isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200")}>
      Min: {item.minReplicas ?? 1}
    </span>
    <span className={cn("badge-chip", isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200")}>
      Max: {item.maxReplicas ?? 10}
    </span>
    <span className={cn("badge-chip", isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200")}>
      Target CPU: {item.targetCPU ?? 80}%
    </span>
  </div>
);

const ResourceLimitDetails: React.FC<{ readonly item: any; readonly isDark: boolean }> = ({ item, isDark }) => {
  const reqCpu = item.cpuRequest || item.requestCpu || 'none';
  const limCpu = item.cpuLimit || item.limitCpu || 'none';
  const reqMem = item.memoryRequest || item.requestMemory || 'none';
  const limMem = item.memoryLimit || item.limitMemory || 'none';
  const qos = getPodQoSClass({
    cpuRequest: item.cpuRequest || item.requestCpu,
    cpuLimit: item.cpuLimit || item.limitCpu,
    memoryRequest: item.memoryRequest || item.requestMemory,
    memoryLimit: item.memoryLimit || item.limitMemory,
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono", isDark ? "text-blue-300" : "text-blue-700")}>
      <span className={cn("badge-chip", isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200")}>
        CPU: {reqCpu} req / {limCpu} limit
      </span>
      <span className={cn("badge-chip", isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200")}>
        Mem: {reqMem} req / {limMem} limit
      </span>
      <span className={cn("text-[9px] badge-chip uppercase font-sans font-semibold", isDark ? "border-purple-500/30 text-purple-300 bg-purple-500/10" : "border-purple-200 text-purple-700 bg-purple-50")}>
        {qos}
      </span>
    </div>
  );
};

const ItemDetailSection: React.FC<{ readonly type: K8sResourceType; readonly item: any; readonly isDark: boolean }> = ({ type, item, isDark }) => {
  if (type === 'ConfigMap') return <ConfigMapDetails item={item} isDark={isDark} />;
  if (type === 'Secret') return <SecretDetails item={item} isDark={isDark} />;
  if (type === 'Role') return <RoleDetails item={item} isDark={isDark} />;
  if (type === 'HPA') return <HpaDetails item={item} isDark={isDark} />;
  return <ResourceLimitDetails item={item} isDark={isDark} />;
};

export const AttachedResourceOverviewModal: React.FC<AttachedResourceOverviewModalProps> = ({
  type,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const isDark = colorMode === 'dark';
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);
  const savedConfigMaps = useFlowStore((state) => state.savedConfigMaps);
  const deleteSavedConfigMap = useFlowStore((state) => state.deleteSavedConfigMap);
  const savedSecrets = useFlowStore((state) => state.savedSecrets);
  const deleteSavedSecret = useFlowStore((state) => state.deleteSavedSecret);
  const savedHpas = useFlowStore((state) => state.savedHpas);
  const deleteSavedHpa = useFlowStore((state) => state.deleteSavedHpa);
  const savedResourceLimits = useFlowStore((state) => state.savedResourceLimits);
  const deleteSavedResourceLimit = useFlowStore((state) => state.deleteSavedResourceLimit);

  const setConfigMapModalTargetNode = useFlowStore((state) => state.setConfigMapModalTargetNode);
  const setSecretModalTargetNode = useFlowStore((state) => state.setSecretModalTargetNode);
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const setHpaModalTargetNode = useFlowStore((state) => state.setHpaModalTargetNode);
  const setResourceLimitModalTargetNode = useFlowStore((state) => state.setResourceLimitModalTargetNode);

  const savedResources = useMemo(() => {
    if (type === 'Secret') return savedSecrets;
    if (type === 'ConfigMap') return savedConfigMaps;
    if (type === 'HPA') return savedHpas;
    if (type === 'ResourceLimit') return savedResourceLimits;
    return [];
  }, [type, savedSecrets, savedConfigMaps, savedHpas, savedResourceLimits]);
  const allItems = useMemo(
    () => (type ? extractAllOverviewItems(nodes, type, savedResources as (K8sConfigMapItem | K8sSecretItem)[]) : []),
    [nodes, type, savedResources]
  );
  const filteredItems = useMemo(
    () => (type ? filterOverviewItems(allItems, search, type) : []),
    [allItems, search, type]
  );

  if (!type) return null;

  const meta = getResourceOverviewMeta(type, allItems.length);

  const handleEdit = (item: OverviewItem) => {
    onClose();
    const targetPayload = {
      id: item.ownerNode.id,
      label: item.ownerNode.label,
      initialItem: item.rawItem,
    };

    if (type === 'ConfigMap') setConfigMapModalTargetNode(targetPayload);
    else if (type === 'Secret') setSecretModalTargetNode(targetPayload);
    else if (type === 'Role') setRoleModalTargetNode(targetPayload);
    else if (type === 'HPA') setHpaModalTargetNode(targetPayload);
    else if (type === 'ResourceLimit') setResourceLimitModalTargetNode(targetPayload);
  };

  const handleDelete = (item: OverviewItem) => {
    if (item.ownerNode.id !== 'cluster-storage') {
      const owner = nodes.find((n) => n.id === item.ownerNode.id);
      if (owner) {
        const currentList: any[] = (owner.data as K8sNodeData)?.[meta.resourceKey] || [];
        const updatedList = currentList.filter((x) => x.id !== item.rawItem.id);
        updateNodeData(item.ownerNode.id, { [meta.resourceKey]: updatedList });
        addLog(
          'info',
          `[Attached Resource] Removed ${meta.logResourceName} '${item.name}' from ${item.ownerNode.label}`,
          'UI'
        );
      }
    }
    if (type === 'ConfigMap') {
      void removeConfigMapFromLocal(item.rawItem.id);
      deleteSavedConfigMap(item.rawItem.id);
    } else if (type === 'Secret') {
      void removeSecretFromLocal(item.rawItem.id);
      deleteSavedSecret(item.rawItem.id);
    } else if (type === 'HPA') {
      deleteSavedHpa(item.rawItem.id);
    } else if (type === 'ResourceLimit') {
      deleteSavedResourceLimit(item.rawItem.id);
    }
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <span className="mono-muted">
        Showing {filteredItems.length} of {allItems.length} {meta.logResourceName}s
      </span>
      <div className="flex items-center gap-2">
        {type === 'ConfigMap' && (
          <button
            type="button"
            onClick={() => {
              onClose();
              setConfigMapModalTargetNode({
                id: 'cluster-storage',
                label: 'Cluster ConfigMap',
              });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
          >
            + Add ConfigMap
          </button>
        )}
        {type === 'Secret' && (
          <button
            type="button"
            onClick={() => {
              onClose();
              setSecretModalTargetNode({
                id: 'cluster-storage',
                label: 'Cluster Secret',
              });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
          >
            + Add Secret
          </button>
        )}
        {type === 'HPA' && (
          <button
            type="button"
            data-testid="overview-add-hpa-btn"
            onClick={() => {
              onClose();
              setHpaModalTargetNode({
                id: 'cluster-storage',
                label: 'Cluster HPA Profile',
              });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
          >
            + Add HPA
          </button>
        )}
        {type === 'ResourceLimit' && (
          <button
            type="button"
            data-testid="overview-add-resource-limit-btn"
            onClick={() => {
              onClose();
              setResourceLimitModalTargetNode({
                id: 'cluster-storage',
                label: 'Cluster Resource Limit',
              });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
          >
            + Add Resource Limit
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "modal-outline-btn",
            colorMode === 'dark'
              ? "border-slate-700 hover:bg-slate-800 text-slate-300"
              : "border-slate-300 hover:bg-slate-100 text-slate-700"
          )}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={Boolean(type)}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      iconColorClass={meta.iconColorClass}
      widthClass="w-full max-w-2xl"
      maxHeightClass="h-[75vh]"
      footer={footer}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={14}
            className="search-input-icon"
          />
          <input
            type="text"
            placeholder={`Search ${meta.logResourceName}s by name, node, or values...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
              colorMode === 'dark'
                ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500"
            )}
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-10 px-4">
            <meta.icon size={36} className={cn("mx-auto mb-2 opacity-30", meta.iconColorClass)} />
            <p className="text-xs text-slate-400 font-medium">{meta.emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredItems.map((item) => (
              <div
                key={`overview-item-${item.ownerNode.id}-${item.id}`}
                className={cn(
                  "p-3 rounded-lg border transition-all flex items-start justify-between gap-3",
                  colorMode === 'dark'
                    ? "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-semibold text-xs truncate", isDark ? "text-slate-200" : "text-slate-800")}>
                      {item.name}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] badge-chip font-medium",
                        meta.badgeBgColorClass
                      )}
                    >
                      Attached to: {item.ownerNode.label} ({item.ownerNode.type})
                    </span>
                  </div>
                  <ItemDetailSection type={type} item={item.rawItem} isDark={isDark} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={`Edit ${meta.logResourceName} ${item.name}`}
                    onClick={() => handleEdit(item)}
                    className="p-1.5 rounded hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    title={`Delete ${meta.logResourceName} ${item.name}`}
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
