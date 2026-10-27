import React, { useState, useMemo } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { K8sResourceType } from '@/types';
import {
  OverviewItem,
  extractAllOverviewItems,
  filterOverviewItems,
  getResourceOverviewMeta,
} from '@/activities/modals/attachedResourceOverviewHelpers';
import { removeConfigMapFromLocal } from '@/activities/modals/configMapStorageHelpers';

export interface AttachedResourceOverviewModalProps {
  readonly type: K8sResourceType | null;
  readonly onClose: () => void;
}

const ConfigMapDetails: React.FC<{ readonly item: any }> = ({ item }) => {
  const dataList = Array.isArray(item.configData) ? item.configData : [];
  if (dataList.length === 0) {
    return <span className="text-[10px] text-slate-500 italic">No variables defined</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {dataList.slice(0, 5).map((entry, idx) => (
        <span
          key={`cm-var-${entry.key}-${idx}`}
          className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 max-w-[200px] truncate"
        >
          <span className="font-semibold text-teal-400 mr-1">{entry.key}:</span>
          <span className="text-slate-300 truncate">{String(entry.value)}</span>
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

const SecretDetails: React.FC<{ readonly item: any }> = ({ item }) => {
  const dataList = Array.isArray(item.secretData) ? item.secretData : [];
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
        {item.type || 'Opaque'}
      </span>
      {dataList.map((entry, idx) => (
        <span
          key={`sec-key-${entry.key}-${idx}`}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
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

const RoleDetails: React.FC<{ readonly item: any }> = ({ item }) => {
  const rules = Array.isArray(item.rules) ? item.rules : [];
  const assignedUsers = Array.isArray(item.assignedUsers) ? item.assignedUsers : [];
  return (
    <div className="space-y-0.5 mt-1 text-[11px] font-mono">
      <div className="text-slate-400">
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
        <div className="text-[10px] text-emerald-400 font-sans">
          Bound Users: {assignedUsers.join(', ')}
        </div>
      )}
    </div>
  );
};

const HpaDetails: React.FC<{ readonly item: any }> = ({ item }) => (
  <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-purple-300">
    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
      Min: {item.minReplicas ?? 1}
    </span>
    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
      Max: {item.maxReplicas ?? 10}
    </span>
    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
      Target CPU: {item.targetCPU ?? 80}%
    </span>
  </div>
);

const ResourceLimitDetails: React.FC<{ readonly item: any }> = ({ item }) => {
  const reqCpu = item.cpuRequest || item.requestCpu || 'none';
  const limCpu = item.cpuLimit || item.limitCpu || 'none';
  const reqMem = item.memoryRequest || item.requestMemory || 'none';
  const limMem = item.memoryLimit || item.limitMemory || 'none';

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-blue-300">
      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
        CPU: {reqCpu} req / {limCpu} limit
      </span>
      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
        Mem: {reqMem} req / {limMem} limit
      </span>
    </div>
  );
};

const ItemDetailSection: React.FC<{ readonly type: K8sResourceType; readonly item: any }> = ({ type, item }) => {
  if (type === 'ConfigMap') return <ConfigMapDetails item={item} />;
  if (type === 'Secret') return <SecretDetails item={item} />;
  if (type === 'Role') return <RoleDetails item={item} />;
  if (type === 'HPA') return <HpaDetails item={item} />;
  return <ResourceLimitDetails item={item} />;
};

export const AttachedResourceOverviewModal: React.FC<AttachedResourceOverviewModalProps> = ({
  type,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);
  const savedConfigMaps = useFlowStore((state) => state.savedConfigMaps);
  const deleteSavedConfigMap = useFlowStore((state) => state.deleteSavedConfigMap);

  const setConfigMapModalTargetNode = useFlowStore((state) => state.setConfigMapModalTargetNode);
  const setSecretModalTargetNode = useFlowStore((state) => state.setSecretModalTargetNode);
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const setHpaModalTargetNode = useFlowStore((state) => state.setHpaModalTargetNode);
  const setResourceLimitModalTargetNode = useFlowStore((state) => state.setResourceLimitModalTargetNode);

  const allItems = useMemo(() => (type ? extractAllOverviewItems(nodes, type, savedConfigMaps) : []), [nodes, type, savedConfigMaps]);
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
        const currentList: any[] = owner.data?.[meta.resourceKey] || [];
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
    }
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <span className="text-[11px] text-slate-400 font-mono">
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
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                    <span className="font-semibold text-xs text-slate-200 truncate">
                      {item.name}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded border font-medium",
                        meta.badgeBgColorClass
                      )}
                    >
                      Attached to: {item.ownerNode.label} ({item.ownerNode.type})
                    </span>
                  </div>
                  <ItemDetailSection type={type} item={item.rawItem} />
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
