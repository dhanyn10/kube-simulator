import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Plus, Trash2, HelpCircle, TerminalSquare, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import { ConfigMapListView } from './ConfigMapListView';
import { K8sConfigMapItem } from '@/types';
import { cn } from '@/lib/utils';
import { useConfigMapModal, findActiveKeyInfo } from '@/activities/modals';
import { centerDropdownItem } from '@/lib/autocompleteUtils';
import { useFlowStore } from '@/store';
import { getActiveProfileName } from '@/store/useFlowStore';
import {
  OverviewItem,
  extractAllOverviewItems,
  filterOverviewItems,
} from '@/activities/modals/attachedResourceOverviewHelpers';
import { removeConfigMapFromLocal } from '@/activities/modals/configMapStorageHelpers';

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

export const ConfigMapModal: React.FC<ConfigMapModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialConfigMap,
  initialViewMode,
  onSave,
}) => {
  const [mode, setMode] = useState<'form' | 'list'>('form');
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
    loadConfigMap,
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    activeRow,
    filteredKeys,
    filteredValues,
    handleAddRow,
    handleRemoveRow,
    handleRowChange,
    handleInputFocusOrChange,
    handleSave,
  } = useConfigMapModal({
    isOpen,
    onClose,
    targetNodeId,
    initialConfigMap,
    onSave,
  });

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

  if (!isOpen) return null;

  const handleEditFromList = (item: OverviewItem) => {
    loadConfigMap(item.rawItem);
    setMode('form');
  };

  const handleAddNewFromList = () => {
    loadConfigMap(null);
    setMode('form');
  };

  const handleDeleteFromList = (item: OverviewItem) => {
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
  };

  const isListMode = mode === 'list';

  const footer = isListMode ? (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={handleAddNewFromList}
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
  ) : (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        data-testid="configmap-back-button"
        onClick={() => setMode('list')}
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
          onClick={handleSave}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-all cursor-pointer"
        >
          {activeItem || initialConfigMap ? 'Update ConfigMap' : 'Attach ConfigMap'}
        </button>
      </div>
    </div>
  );

  const modalTitle = isListMode
    ? 'Cluster ConfigMaps Overview'
    : (activeItem || initialConfigMap ? 'Edit ConfigMap' : 'Attach ConfigMap');

  const modalSubtitle = isListMode
    ? `${filteredItems.length} ConfigMap${filteredItems.length === 1 ? '' : 's'} available across cluster`
    : (targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Key-Value Data');

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
      {isListMode ? (
        <ConfigMapListView
          search={search}
          onSearchChange={setSearch}
          items={filteredItems}
          isDark={isDark}
          onEditItem={handleEditFromList}
          onDeleteItem={handleDeleteFromList}
        />
      ) : (
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
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600/30 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            {/* Rows Container */}
            {rows.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg border-slate-800 text-slate-500 text-xs">
                No key-value pairs added. Click "Add Row" to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => {
                  const matchedKeyInfo = findActiveKeyInfo(row.key);

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "p-2 rounded-lg border space-y-2 transition-all",
                        isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {/* Key Field with Fixed Portal Dropdown */}
                        <div className="w-1/2">
                          <input
                            id={`cm-key-input-${row.id}`}
                            aria-label="Key"
                            type="text"
                            value={row.key}
                            onFocus={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'key')}
                            onChange={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'key', e.target.value)}
                            placeholder="e.g. PORT, LOG_LEVEL"
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
                              isDark
                                ? "bg-slate-950 border-slate-700 text-slate-200"
                                : "bg-slate-50 border-slate-300 text-slate-800"
                            )}
                          />
                        </div>

                        {/* Value Field with Fixed Portal Dropdown */}
                        <div className="w-1/2">
                          <input
                            id={`cm-val-input-${row.id}`}
                            aria-label="Value"
                            type="text"
                            value={row.value}
                            onFocus={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'value')}
                            onChange={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'value', e.target.value)}
                            placeholder="e.g. 80, INFO, enabled"
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
                              isDark
                                ? "bg-slate-950 border-slate-700 text-slate-100"
                                : "bg-slate-50 border-slate-300 text-slate-900"
                            )}
                          />
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer shrink-0"
                          title="Remove row"
                          aria-label="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Educational Hint */}
                      {matchedKeyInfo?.hint && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-1">
                          <HelpCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span>{matchedKeyInfo.hint}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Viewport Fixed Autocomplete Portal */}
          {activeDropdown && dropdownPos && activeRow && typeof document !== 'undefined' && createPortal(
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
                  onSelect={() => {
                    handleRowChange(activeRow.id, 'key', item.key);
                    setActiveDropdown(null);
                  }}
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
                  onSelect={() => {
                    handleRowChange(activeRow.id, 'value', opt.value);
                    setActiveDropdown(null);
                  }}
                />
              ))}
            </div>,
            document.body
          )}
        </div>
      )}
    </Modal>
  );
};
