import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Plus, Trash2, HelpCircle, TerminalSquare, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import { ConfigMapListView } from './ConfigMapListView';
import { ConfigMapPrecedenceView } from './ConfigMapPrecedenceView';
import { K8sConfigMapItem } from '@/types';
import { cn, safeRandom } from '@/lib/utils';
import { useConfigMapModal, findActiveKeyInfo, buildConfigMapItem } from '@/activities/modals';
import { centerDropdownItem } from '@/lib/autocompleteUtils';
import { useFlowStore } from '@/store';
import { getActiveProfileName } from '@/store/useFlowStore';
import {
  OverviewItem,
  extractAllOverviewItems,
  filterOverviewItems,
} from '@/activities/modals/attachedResourceOverviewHelpers';
import { removeConfigMapFromLocal, persistConfigMapItem } from '@/activities/modals/configMapStorageHelpers';
import { ConfigMapComponentSection, ComponentOption } from './ConfigMapComponentSection';
import { ConfigMapImportDataDropdown } from './ConfigMapImportDataDropdown';

export type ConfigMapModalMode = 'form' | 'list' | 'profile';

export interface ConfigMapModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly targetNodeLabel?: string;
  readonly initialConfigMap?: K8sConfigMapItem | null;
  readonly initialViewMode?: 'form' | 'list';
  readonly onSave: (configMapItem: K8sConfigMapItem) => void;
}

interface AutocompleteOptionItemProps {
  readonly testId: string;
  readonly primaryText: string;
  readonly secondaryText?: string;
  readonly badgeText?: string;
  readonly isDark: boolean;
  readonly index: number;
  readonly onHover?: () => void;
  readonly onSelect: () => void;
}

const AutocompleteOptionItem: React.FC<AutocompleteOptionItemProps> = ({
  testId,
  primaryText,
  secondaryText,
  badgeText,
  isDark,
  index,
  onHover,
  onSelect,
}) => (
  <button
    type="button"
    data-testid={testId}
    data-item-index={index}
    onMouseEnter={onHover}
    onMouseDown={(e) => {
      e.preventDefault();
      onSelect();
    }}
    className={cn(
      "w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer",
      isDark ? "hover:bg-slate-800/80 text-slate-200" : "hover:bg-blue-50 text-slate-800"
    )}
  >
    <div className="flex items-center gap-2 overflow-hidden">
      <TerminalSquare size={12} className="text-teal-400 shrink-0" />
      <span className="font-semibold text-[11px]">{primaryText}</span>
    </div>
    {badgeText && (
      <span className={cn(
        "text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider",
        isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
      )}>
        {badgeText}
      </span>
    )}
    {secondaryText && (
      <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
        {secondaryText}
      </span>
    )}
  </button>
);

export function findAllAttachedComponents(
  cmId: string | undefined,
  cmName: string | undefined,
  nodes: any[],
  resourceName?: string
): ComponentOption[] {
  const results: ComponentOption[] = [];
  const foundNodeIds = new Set<string>();

  if (cmId || cmName) {
    nodes.forEach((node) => {
      const nodeLabel = (node.data?.label as string) || node.id;
      const isAttachedInNode =
        Array.isArray(node.data?.configMaps) &&
        node.data.configMaps.some((c: any) => (cmId && c.id === cmId) || (cmName && c.name === cmName));
      const isNamedResource = Boolean(resourceName && (nodeLabel === resourceName || node.id === resourceName));

      if ((isAttachedInNode || isNamedResource) && !foundNodeIds.has(node.id)) {
        foundNodeIds.add(node.id);
        results.push({
          id: node.id,
          label: nodeLabel,
          type: node.type || 'Node',
        });
      }
    });
  }

  return results;
}

function getModalTitle(
  mode: ConfigMapModalMode,
  hasExistingItem: boolean,
  selectedProfile?: string | null
): string {
  if (mode === 'list') {
    return 'Cluster ConfigMaps Overview';
  }
  if (mode === 'profile') {
    return `ConfigMap Profile — ${selectedProfile || 'Canvas Profile'}`;
  }
  if (hasExistingItem) {
    return 'Edit ConfigMap';
  }
  return 'Attach ConfigMap';
}

function getModalSubtitle(
  mode: ConfigMapModalMode,
  filteredCount: number,
  targetNodeLabel?: string,
  selectedProfile?: string | null
): string {
  if (mode === 'list') {
    const plural = filteredCount === 1 ? '' : 's';
    return `${filteredCount} ConfigMap${plural} available across cluster`;
  }
  if (mode === 'profile') {
    return `Canvas Profile: ${selectedProfile || 'Active'} • Evaluation Precedence Order`;
  }
  if (targetNodeLabel) {
    return `Target card: ${targetNodeLabel}`;
  }
  return 'Configure Key-Value Data';
}

function removeConfigMapFromNodeOrStore(
  item: OverviewItem,
  nodes: any[],
  updateNodeData: (id: string, data: any) => void,
  deleteSavedConfigMap: (id: string) => void,
  addLog: (level: 'info' | 'warn' | 'error', message: string, category?: string) => void
): void {
  if (item.ownerNode.id !== 'cluster-storage') {
    const owner = nodes.find((n) => n.id === item.ownerNode.id);
    if (owner) {
      const currentList: any[] = owner.data?.configMaps || [];
      const updatedList = currentList.filter((x) => x.id !== item.rawItem.id);
      updateNodeData(item.ownerNode.id, { configMaps: updatedList });
      addLog(
        'info',
        `[Attached Resource] Removed ConfigMap '${item.name}' from ${item.ownerNode.label}`,
        'UI'
      );
    }
  }
  void removeConfigMapFromLocal(item.rawItem.id);
  deleteSavedConfigMap(item.rawItem.id);
}

interface ConfigMapModalFooterProps {
  readonly mode: ConfigMapModalMode;
  readonly isDark: boolean;
  readonly hasExistingItem: boolean;
  readonly onAddNewFromList: () => void;
  readonly onClose: () => void;
  readonly onBackToMode: () => void;
  readonly onSave: () => void;
}

const ConfigMapModalFooter: React.FC<ConfigMapModalFooterProps> = ({
  mode,
  isDark,
  hasExistingItem,
  onAddNewFromList,
  onClose,
  onBackToMode,
  onSave,
}) => {
  if (mode === 'list') {
    return (
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          onClick={onAddNewFromList}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>+ Add ConfigMap</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
            isDark
              ? "border-slate-700 hover:bg-slate-800 text-slate-300"
              : "border-slate-300 hover:bg-slate-100 text-slate-700"
          )}
        >
          Close
        </button>
      </div>
    );
  }

  if (mode === 'profile') {
    return (
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          data-testid="configmap-footer-back-button"
          onClick={onBackToMode}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
            isDark
              ? "border-slate-700 hover:bg-slate-800 text-teal-400"
              : "border-slate-300 hover:bg-slate-100 text-teal-600"
          )}
        >
          <ArrowLeft size={13} />
          <span>Back to List</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddNewFromList}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Add ConfigMap</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
              isDark
                ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                : "border-slate-300 hover:bg-slate-100 text-slate-700"
            )}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        data-testid="configmap-back-button"
        onClick={onBackToMode}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
          isDark
            ? "border-slate-700 hover:bg-slate-800 text-teal-400"
            : "border-slate-300 hover:bg-slate-100 text-teal-600"
        )}
      >
        <ArrowLeft size={13} />
        <span>Back</span>
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
            isDark
              ? "border-slate-700 hover:bg-slate-800 text-slate-300"
              : "border-slate-300 hover:bg-slate-100 text-slate-700"
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-all cursor-pointer"
        >
          {hasExistingItem ? 'Update ConfigMap' : 'Attach ConfigMap'}
        </button>
      </div>
    </div>
  );
};

interface ConfigMapRowItemProps {
  readonly row: { id: string; key: string; value: string };
  readonly index: number;
  readonly isDark: boolean;
  readonly onFocusOrChange: (target: HTMLElement, rowId: string, field: 'key' | 'value', value?: string) => void;
  readonly onRemove: (rowId: string) => void;
}

const ConfigMapRowItem: React.FC<ConfigMapRowItemProps> = ({
  row,
  index,
  isDark,
  onFocusOrChange,
  onRemove,
}) => {
  const matchedKeyInfo = findActiveKeyInfo(row.key);

  return (
    <div
      className={cn(
        "p-2 rounded-lg border space-y-2 transition-all",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          data-testid={`cm-row-id-${row.id}`}
          className="w-8 text-center text-xs font-mono font-bold text-slate-500 shrink-0 select-none"
        >
          #{index + 1}
        </span>
        <div className="flex-1">
          <input
            id={`cm-key-input-${row.id}`}
            aria-label="Key"
            type="text"
            value={row.key}
            onFocus={(e) => onFocusOrChange(e.currentTarget, row.id, 'key')}
            onChange={(e) => onFocusOrChange(e.currentTarget, row.id, 'key', e.target.value)}
            placeholder="e.g. PORT, LOG_LEVEL"
            className={cn(
              "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
              isDark
                ? "bg-slate-950 border-slate-700 text-slate-200"
                : "bg-slate-50 border-slate-300 text-slate-800"
            )}
          />
        </div>

        <div className="flex-1">
          <input
            id={`cm-val-input-${row.id}`}
            aria-label="Value"
            type="text"
            value={row.value}
            onFocus={(e) => onFocusOrChange(e.currentTarget, row.id, 'value')}
            onChange={(e) => onFocusOrChange(e.currentTarget, row.id, 'value', e.target.value)}
            placeholder="e.g. 80, INFO, enabled"
            className={cn(
              "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
              isDark
                ? "bg-slate-950 border-slate-700 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer shrink-0"
          title="Remove row"
          aria-label="Remove row"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {matchedKeyInfo?.hint && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-1">
          <HelpCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>{matchedKeyInfo.hint}</span>
        </div>
      )}
    </div>
  );
};

interface ConfigMapAutocompletePortalProps {
  readonly activeDropdown: { rowId: string; field: 'key' | 'value' } | null;
  readonly dropdownPos: { top: number; left: number; width: number } | null;
  readonly activeRowId: string | null;
  readonly isDark: boolean;
  readonly filteredKeys: Array<{ key: string; description?: string }>;
  readonly filteredValues: Array<{ value: string; description?: string }>;
  readonly portalContainerRef: React.RefObject<HTMLDivElement | null>;
  readonly setPortalSelectedIndex: (index: number) => void;
  readonly onSelectKey: (key: string) => void;
  readonly onSelectValue: (val: string) => void;
}

const ConfigMapAutocompletePortal: React.FC<ConfigMapAutocompletePortalProps> = ({
  activeDropdown,
  dropdownPos,
  activeRowId,
  isDark,
  filteredKeys,
  filteredValues,
  portalContainerRef,
  setPortalSelectedIndex,
  onSelectKey,
  onSelectValue,
}) => {
  if (!activeDropdown || !dropdownPos || !activeRowId || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={portalContainerRef}
      id="configmap-autocomplete-portal"
      data-testid="configmap-autocomplete-portal"
      style={{
        position: 'fixed',
        top: `${dropdownPos.top}px`,
        left: `${dropdownPos.left}px`,
        width: `${dropdownPos.width}px`,
        zIndex: 9999,
      }}
      className={cn(
        "max-h-48 overflow-y-auto rounded-md shadow-2xl border font-mono text-[11px] divide-y custom-scrollbar animate-in fade-in-50 duration-100",
        isDark
          ? "bg-slate-900 border-slate-700 text-slate-200 divide-slate-800"
          : "bg-white border-slate-200 text-slate-800 divide-slate-100"
      )}
    >
      {activeDropdown.field === 'key' && filteredKeys.map((item, index) => (
        <AutocompleteOptionItem
          key={`portal-key-${item.key}`}
          testId={`key-option-${item.key}`}
          primaryText={item.key}
          badgeText="KEY"
          isDark={isDark}
          index={index}
          onHover={() => setPortalSelectedIndex(index)}
          onSelect={() => onSelectKey(item.key)}
        />
      ))}

      {activeDropdown.field === 'value' && filteredValues.map((opt, index) => (
        <AutocompleteOptionItem
          key={`portal-val-${opt.value}`}
          testId={`val-option-${opt.value}`}
          primaryText={opt.value}
          secondaryText={opt.description}
          isDark={isDark}
          index={index}
          onHover={() => setPortalSelectedIndex(index)}
          onSelect={() => onSelectValue(opt.value)}
        />
      ))}
    </div>,
    document.body
  );
};

export const ConfigMapModal: React.FC<ConfigMapModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialConfigMap,
  initialViewMode,
  onSave,
}) => {
  const [mode, setMode] = useState<ConfigMapModalMode>('form');
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const nodes = useFlowStore((state) => state.nodes);
  const currentProject = useFlowStore((state) => state.currentProject);
  const savedConfigMaps = useFlowStore((state) => state.savedConfigMaps);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const deleteSavedConfigMap = useFlowStore((state) => state.deleteSavedConfigMap);
  const addLog = useFlowStore((state) => state.addLog);

  const {
    isDark,
    cmName,
    setCmName,
    rows,
    activeItem,
    setActiveItem,
    loadConfigMap,
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    activeRow,
    filteredKeys,
    filteredValues,
    handleAddRow,
    handleAddMultipleRows,
    handleRemoveRow,
    handleRowChange,
    handleInputFocusOrChange,
  } = useConfigMapModal({
    isOpen,
    onClose,
    targetNodeId,
    initialConfigMap,
    onSave,
  });

  const [attachedComponents, setAttachedComponents] = useState<ComponentOption[]>([]);
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  const portalContainerRef = useRef<HTMLDivElement>(null);
  const [portalSelectedIndex, setPortalSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    if (initialViewMode === 'list') {
      setMode('list');
    } else {
      setMode('form');
    }
  }, [isOpen, initialViewMode, initialConfigMap?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const initialCmId = initialConfigMap?.id || activeItem?.id;
    const initialCmName = initialConfigMap?.name || activeItem?.name;
    const resName = initialConfigMap?.resourceName || activeItem?.resourceName;
    const initialComps = findAllAttachedComponents(
      initialCmId,
      initialCmName,
      nodes,
      resName
    );
    setAttachedComponents(initialComps);
  }, [isOpen, initialConfigMap?.id, initialConfigMap?.name, initialConfigMap?.resourceName, activeItem?.id, activeItem?.name, activeItem?.resourceName, nodes]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) {
        setIsImportDropdownOpen(false);
      }
    };
    if (isImportDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isImportDropdownOpen]);

  useEffect(() => {
    setPortalSelectedIndex(0);
  }, [activeDropdown?.rowId, activeDropdown?.field]);

  useEffect(() => {
    if (portalContainerRef.current) {
      const total = activeDropdown?.field === 'key' ? filteredKeys.length : filteredValues.length;
      centerDropdownItem(portalContainerRef.current, portalSelectedIndex, total);
    }
  }, [portalSelectedIndex, activeDropdown?.field, filteredKeys.length, filteredValues.length]);

  const currentProfileName = getActiveProfileName(currentProject);
  const allItems = useMemo(
    () => extractAllOverviewItems(nodes, 'ConfigMap', savedConfigMaps, currentProfileName),
    [nodes, savedConfigMaps, currentProfileName]
  );
  const filteredItems = useMemo(
    () => filterOverviewItems(allItems, search, 'ConfigMap'),
    [allItems, search]
  );

  const profileItems = useMemo(() => {
    if (!selectedProfile) return [];
    const seen = new Set<string>();
    return allItems.filter((item) => {
      const itemProfile =
        item.profileName && item.profileName !== 'Default Profile'
          ? item.profileName
          : getCurrentSessionAutosaveKey();
      if (itemProfile !== selectedProfile) return false;
      const dedupeKey = `${item.id}::${item.ownerNode.label}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  }, [allItems, selectedProfile]);

  const availableComponents = useMemo(() => {
    return nodes
      .filter((n) =>
        ['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Service', 'Ingress'].includes(n.type || '')
      )
      .map((n) => ({
        id: n.id,
        label: (n.data?.label as string) || n.id,
        type: n.type || 'Node',
      }));
  }, [nodes]);

  const existingConfigMapsWithData = useMemo(() => {
    const list: K8sConfigMapItem[] = [];
    const seen = new Set<string>();
    const currentId = activeItem?.id || initialConfigMap?.id;
    allItems.forEach((item) => {
      const raw = item.rawItem as K8sConfigMapItem;
      if (
        raw &&
        Array.isArray(raw.configData) &&
        raw.configData.length > 0 &&
        raw.id !== currentId &&
        !seen.has(raw.name)
      ) {
        seen.add(raw.name);
        list.push(raw);
      }
    });
    return list;
  }, [allItems, activeItem?.id, initialConfigMap?.id]);

  if (!isOpen) return null;

  const handleEditFromList = (item: OverviewItem) => {
    loadConfigMap(item.rawItem);
    const comps = findAllAttachedComponents(
      item.rawItem.id,
      item.rawItem.name,
      nodes,
      item.rawItem.resourceName || (item.ownerNode.id !== 'cluster-storage' ? item.ownerNode.label : undefined)
    );
    setAttachedComponents(comps);
    setMode('form');
  };

  const handleAddNewFromList = () => {
    loadConfigMap(null);
    setAttachedComponents([]);
    setMode('form');
  };

  const handleDeleteFromList = (item: OverviewItem) => {
    removeConfigMapFromNodeOrStore(item, nodes, updateNodeData, deleteSavedConfigMap, addLog);
  };

  const handleRemoveComponent = (componentId: string) => {
    const owner = nodes.find((n) => n.id === componentId);
    const targetCmId = activeItem?.id || initialConfigMap?.id;
    if (owner) {
      const currentList: K8sConfigMapItem[] = owner.data?.configMaps || [];
      const updatedList = currentList.filter(
        (c) => c.id !== targetCmId && c.name !== cmName
      );
      updateNodeData(owner.id, { configMaps: updatedList });
      addLog(
        'info',
        `[ConfigMap] Removed attached component '${owner.data?.label || owner.id}' from ConfigMap '${cmName}'`,
        'UI'
      );
    }

    const remaining = attachedComponents.filter((c) => c.id !== componentId);
    setAttachedComponents(remaining);

    const targetId = targetCmId || `cm-${Date.now()}`;
    const updatedRaw: K8sConfigMapItem = {
      ...activeItem,
      id: targetId,
      name: cmName,
      configData: rows.map((r) => ({ key: r.key, value: r.value })),
      profileName: activeItem?.profileName || currentProfileName,
      resourceName: remaining.length > 0 ? remaining.map((r) => r.label).join(', ') : undefined,
      resourceType: remaining.length > 0 ? remaining[0].type : undefined,
    };
    useFlowStore.getState().addOrUpdateSavedConfigMap(updatedRaw);
    void persistConfigMapItem(updatedRaw);

    if (activeItem) {
      setActiveItem({
        ...activeItem,
        resourceName: updatedRaw.resourceName,
        resourceType: updatedRaw.resourceType,
      });
    }
  };

  const handleAttachComponent = (comp: ComponentOption) => {
    const targetNode = nodes.find((n) => n.id === comp.id);
    if (!targetNode) return;

    const targetLabel = (targetNode.data?.label as string) || targetNode.id;
    const targetType = targetNode.type || 'Node';

    const targetId = activeItem?.id || initialConfigMap?.id || `cm-${Date.now()}`;
    const updatedCm: K8sConfigMapItem = {
      ...activeItem,
      id: targetId,
      name: cmName,
      configData: rows.map((r) => ({ key: r.key, value: r.value })),
      profileName: activeItem?.profileName || currentProfileName,
      resourceName: targetLabel,
      resourceType: targetType,
    };

    const currentCMs: K8sConfigMapItem[] = targetNode.data?.configMaps || [];
    const exists = currentCMs.some((c) => c.id === targetId || c.name === cmName);
    const updatedCMs = exists
      ? currentCMs.map((c) => (c.id === targetId || c.name === cmName ? updatedCm : c))
      : [...currentCMs, updatedCm];
    updateNodeData(targetNode.id, { configMaps: updatedCMs });

    useFlowStore.getState().addOrUpdateSavedConfigMap(updatedCm);
    void persistConfigMapItem(updatedCm);
    if (!activeItem) setActiveItem(updatedCm);

    const nextAttached = [...attachedComponents.filter((c) => c.id !== comp.id), comp];
    setAttachedComponents(nextAttached);
    addLog(
      'info',
      `[ConfigMap] Attached ConfigMap '${cmName}' to component '${targetLabel}'`,
      'UI'
    );
  };

  const handleImportFromConfigMap = (sourceCm: K8sConfigMapItem) => {
    if (!Array.isArray(sourceCm.configData) || sourceCm.configData.length === 0) return;

    const importedRows = sourceCm.configData.map((entry, idx) => ({
      id: `imported-${Date.now()}-${idx}-${safeRandom().toString(36).slice(2, 7)}`,
      key: entry.key,
      value: entry.value,
    }));

    handleAddMultipleRows(importedRows);
    setIsImportDropdownOpen(false);
    addLog(
      'info',
      `[ConfigMap Data] Added ${importedRows.length} key-value pair(s) from ConfigMap '${sourceCm.name}'`,
      'UI'
    );
  };

  const handleSaveModal = () => {
    const validRows = rows
      .filter((r) => r.key.trim() !== '')
      .map((r) => ({ key: r.key.trim(), value: r.value }));
    const targetId = activeItem?.id || initialConfigMap?.id;
    const baseItem = buildConfigMapItem(targetId, cmName, validRows);

    const hasAttached = attachedComponents.length > 0;
    const targetResName = hasAttached ? attachedComponents.map((c) => c.label).join(', ') : undefined;
    const targetResType = hasAttached ? attachedComponents[0].type : undefined;
    const resolvedProfile = selectedProfile || activeItem?.profileName;

    const configMapItem: K8sConfigMapItem = {
      ...activeItem,
      ...baseItem,
      ...(resolvedProfile ? { profileName: resolvedProfile } : undefined),
      ...(targetResName ? { resourceName: targetResName } : undefined),
      ...(targetResType ? { resourceType: targetResType } : undefined),
    };

    onSave(configMapItem);
    setActiveItem(null);
    setAttachedComponents([]);
    setMode('list');
  };

  const hasExistingItem = Boolean(activeItem || initialConfigMap);
  const modalTitle = getModalTitle(mode, hasExistingItem, selectedProfile);
  const modalSubtitle = getModalSubtitle(mode, filteredItems.length, targetNodeLabel, selectedProfile);

  const footer = (
    <ConfigMapModalFooter
      mode={mode}
      isDark={isDark}
      hasExistingItem={hasExistingItem}
      onAddNewFromList={handleAddNewFromList}
      onClose={onClose}
      onBackToMode={() => setMode('list')}
      onSave={handleSaveModal}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      icon={Settings}
      iconColorClass="text-teal-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
      footer={footer}
    >
      {mode === 'list' && (
        <ConfigMapListView
          search={search}
          onSearchChange={setSearch}
          items={filteredItems}
          isDark={isDark}
          onEditItem={handleEditFromList}
          onDeleteItem={handleDeleteFromList}
          onSelectProfile={(pName) => {
            setSelectedProfile(pName);
            setMode('profile');
          }}
        />
      )}

      {mode === 'profile' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/40">
            <button
              type="button"
              data-testid="configmap-profile-back-button"
              onClick={() => setMode('list')}
              className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to ConfigMap list</span>
            </button>
            <span className="text-[11px] text-slate-400 font-mono">
              Profile: <strong className="text-teal-400">{selectedProfile}</strong>
            </span>
          </div>

          <ConfigMapPrecedenceView
            profileName={selectedProfile || currentProfileName}
            items={profileItems}
            isDark={isDark}
            onEditItem={handleEditFromList}
            onDeleteItem={handleDeleteFromList}
            onAddNewConfigMap={handleAddNewFromList}
          />
        </div>
      )}

      {mode === 'form' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/40">
            <button
              type="button"
              data-testid="configmap-header-back-button"
              onClick={() => setMode('list')}
              className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to ConfigMap list</span>
            </button>
            {targetNodeLabel && (
              <span className="text-[11px] text-slate-400 font-mono">
                Card: <strong className="text-slate-200">{targetNodeLabel}</strong>
              </span>
            )}
          </div>

          {/* Tagify Related Component Section */}
          <ConfigMapComponentSection
            attachedComponents={attachedComponents}
            availableComponents={availableComponents}
            onRemoveComponent={handleRemoveComponent}
            onAttachComponent={handleAttachComponent}
            isDark={isDark}
          />

          {/* ConfigMap Name */}
          <div>
            <label htmlFor="configmap-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
              ConfigMap Name
            </label>
            <input
              id="configmap-name-input"
              type="text"
              value={cmName}
              onChange={(e) => setCmName(e.target.value)}
              placeholder="e.g. app-config"
              maxLength={63}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
                isDark
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            />
          </div>

          {/* Postman-style Key-Value Table */}
          <div className="space-y-3 pt-2 border-t border-slate-800/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-300">Data (Key-Value)</p>
                <p className="text-[11px] text-slate-400">Type text or choose suggestions from dropdown for simulation parameters.</p>
              </div>
              <div className="flex items-center gap-2">
                <ConfigMapImportDataDropdown
                  isOpen={isImportDropdownOpen}
                  onToggleOpen={() => setIsImportDropdownOpen((prev) => !prev)}
                  existingConfigMaps={existingConfigMapsWithData}
                  onImport={handleImportFromConfigMap}
                  isDark={isDark}
                  dropdownRef={importDropdownRef}
                />
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600/30 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>
            </div>

            {/* Rows Container */}
            {rows.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg border-slate-800 text-slate-500 text-xs">
                No key-value pairs added. Click "Add Row" to begin.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 select-none">
                  <span className="w-8 text-center">ID</span>
                  <span className="flex-1">Key</span>
                  <span className="flex-1">Value</span>
                  <span className="w-7 text-right"></span>
                </div>
                {rows.map((row, idx) => (
                  <ConfigMapRowItem
                    key={row.id}
                    row={row}
                    index={idx}
                    isDark={isDark}
                    onFocusOrChange={handleInputFocusOrChange}
                    onRemove={handleRemoveRow}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Viewport Fixed Autocomplete Portal */}
          <ConfigMapAutocompletePortal
            activeDropdown={activeDropdown}
            dropdownPos={dropdownPos}
            activeRowId={activeRow?.id || null}
            isDark={isDark}
            filteredKeys={filteredKeys}
            filteredValues={filteredValues}
            portalContainerRef={portalContainerRef}
            setPortalSelectedIndex={setPortalSelectedIndex}
            onSelectKey={(key) => {
              if (activeRow) {
                handleRowChange(activeRow.id, 'key', key);
                setActiveDropdown(null);
              }
            }}
            onSelectValue={(value) => {
              if (activeRow) {
                handleRowChange(activeRow.id, 'value', value);
                setActiveDropdown(null);
              }
            }}
          />
        </div>
      )}
    </Modal>
  );
};
