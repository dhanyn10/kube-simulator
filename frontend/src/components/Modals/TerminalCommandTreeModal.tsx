import React, { useState, useMemo } from 'react';
import { Terminal, Search, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { Modal } from './Modal';
import {
  COMMAND_TREE_DATA,
  CommandTreeNode,
  filterCommandTree,
  getAllNodeIds
} from '@/activities/modals';

interface TreeNodeItemProps {
  readonly node: CommandTreeNode;
  readonly level: number;
  readonly expandedNodes: Set<string>;
  readonly toggleExpand: (id: string) => void;
  readonly onSelectCommand: (cmd: string) => void;
  readonly colorMode: string;
}

const TreeNodeItem = ({
  node,
  level,
  expandedNodes,
  toggleExpand,
  onSelectCommand,
  colorMode,
}: TreeNodeItemProps) => {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedNodes.has(node.id);
  const isExecutable = Boolean(node.command);

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center justify-between py-1.5 px-2.5 rounded-lg transition-colors group cursor-pointer my-0.5",
          colorMode === 'dark'
            ? "hover:bg-slate-800/70 text-slate-200"
            : "hover:bg-slate-100 text-slate-800",
          isExecutable && (colorMode === 'dark' ? "hover:bg-blue-950/40" : "hover:bg-blue-50/80")
        )}
        style={{ paddingLeft: `${level * 18 + 10}px` }}
        onClick={() => {
          if (hasChildren) {
            toggleExpand(node.id);
          } else if (node.command) {
            onSelectCommand(node.command);
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-200"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-3.5 h-3.5 inline-block shrink-0" />
          )}

          <div className="flex items-center gap-2 truncate">
            <span className={cn(
              "font-mono font-semibold text-xs",
              hasChildren ? "text-amber-300 dark:text-amber-400 font-bold" : "text-emerald-400"
            )}>
              {node.name}
            </span>

            {node.description && (
              <span className={cn(
                "text-[11px] truncate hidden sm:inline-block",
                colorMode === 'dark' ? "text-slate-400" : "text-slate-500"
              )}>
                — {node.description}
              </span>
            )}
          </div>
        </div>

        {isExecutable && node.command && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCommand(node.command!);
            }}
            className={cn(
              "flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded border transition-all shrink-0 ml-2",
              colorMode === 'dark'
                ? "bg-blue-900/40 text-blue-300 border-blue-700/50 hover:bg-blue-800/60 hover:text-white"
                : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            )}
            title={`Insert "${node.command}" into Kube Console`}
          >
            <span>Run</span>
            <ArrowRight size={10} />
          </button>
        )}
      </div>

      {hasChildren && isExpanded && node.children && (
        <div className="border-l border-slate-700/40 dark:border-slate-800 ml-4">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              onSelectCommand={onSelectCommand}
              colorMode={colorMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TerminalCommandTreeModal = () => {
  const isOpen = useFlowStore((state) => state.isTerminalCommandTreeModalOpen);
  const onClose = () => useFlowStore.getState().setTerminalCommandTreeModalOpen(false);
  const colorMode = useFlowStore((state) => state.colorMode);
  const setTerminalOpen = useFlowStore((state) => state.setTerminalOpen);
  const setTerminalActiveTab = useFlowStore((state) => state.setTerminalActiveTab);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(['kubectl', 'kubectl-get'])
  );

  const filteredTree = useMemo(() => {
    return filterCommandTree(COMMAND_TREE_DATA, searchTerm);
  }, [searchTerm]);

  const allIds = useMemo(() => getAllNodeIds(COMMAND_TREE_DATA), []);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedNodes(new Set(allIds));
  const collapseAll = () => setExpandedNodes(new Set());

  const handleSelectCommand = (cmd: string) => {
    setTerminalOpen(true);
    setTerminalActiveTab('activity');
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('terminal-insert-command', { detail: cmd }));
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terminal Commands Reference Tree"
      subtitle="Visual command hierarchy for Kube Console CLI"
      icon={Terminal}
      iconColorClass="text-emerald-500"
      widthClass="w-full max-w-4xl"
      maxHeightClass="max-h-[85vh] h-[75vh]"
    >
      <div className="flex flex-col h-full gap-3">
        {/* Search bar & tree controls */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Filter command tree (e.g. get, describe, config, rollout)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value.trim().length > 0) {
                  expandAll();
                }
              }}
              className={cn(
                "w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-medium border outline-none transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-blue-500"
                  : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
              )}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={expandAll}
              className={cn(
                "px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className={cn(
                "px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Tree Container */}
        <div
          className={cn(
            "flex-1 overflow-y-auto custom-scrollbar p-3 rounded-xl border font-mono text-xs",
            colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50/70 border-slate-200"
          )}
        >
          {filteredTree.length > 0 ? (
            filteredTree.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                level={0}
                expandedNodes={expandedNodes}
                toggleExpand={toggleExpand}
                onSelectCommand={handleSelectCommand}
                colorMode={colorMode}
              />
            ))
          ) : (
            <div className="text-center py-10 text-slate-500">
              <Terminal size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs font-sans font-medium">No matching CLI commands found</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
