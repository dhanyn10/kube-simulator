import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFlowStore } from '@/store';
import { sanitizeSlug } from '@/lib/utils';
import { isDuplicateResourceName, resolveTargetInfo } from '@/store/handlers/nodeUtils';

export interface UseNodeRenameOptions {
  nodeId?: string;
  type?: string;
  parentId?: string;
}

export const useNodeRename = (
  initialLabel: string,
  onRename?: (newName: string) => void,
  options?: UseNodeRenameOptions
) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useFlowStore((state) => state.nodes);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(initialLabel);
    }
  }, [initialLabel, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const { isDuplicate, errorMessage } = useMemo(() => {
    if (!isEditing || !options?.nodeId) return { isDuplicate: false, errorMessage: '' };
    const clean = sanitizeSlug(editValue.trim());
    if (!clean || clean.toLowerCase() === initialLabel.toLowerCase()) {
      return { isDuplicate: false, errorMessage: '' };
    }

    const { type, parentId, excludeId } = resolveTargetInfo(
      options.nodeId,
      nodes,
      options.type,
      options.parentId
    );
    const isDup = isDuplicateResourceName(clean, type, parentId, nodes, excludeId);
    if (isDup) {
      return {
        isDuplicate: true,
        errorMessage: type === 'Namespace' ? 'Namespace already exists' : 'Name already exists'
      };
    }
    return { isDuplicate: false, errorMessage: '' };
  }, [isEditing, options?.nodeId, options?.type, options?.parentId, editValue, initialLabel, nodes]);

  const handleRename = useCallback(() => {
    if (isDuplicate) {
      return;
    }
    setIsEditing(false);
    const cleanValue = sanitizeSlug(editValue.trim());
    if (cleanValue && cleanValue !== initialLabel) {
      onRename?.(cleanValue);
    } else {
      setEditValue(initialLabel);
    }
  }, [editValue, initialLabel, onRename, isDuplicate]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(initialLabel);
    }
  }, [handleRename, initialLabel]);

  return {
    isEditing,
    setIsEditing,
    editValue,
    setEditValue,
    inputRef,
    handleRename,
    onKeyDown,
    isDuplicate,
    errorMessage
  };
};

export const useNodeResize = (id: string, type: string) => {
  const onNodeResize = useFlowStore((state) => state.onNodeResize);
  const onNodeResizeStop = useFlowStore((state) => state.onNodeResizeStop);

  const handleNodeResize = useCallback((event: any, params: any) => {
    onNodeResize(event, { id, type, ...params });
  }, [id, type, onNodeResize]);

  const handleNodeResizeStop = useCallback((event: any, params: any) => {
    onNodeResizeStop(event, { id, ...params });
  }, [id, onNodeResizeStop]);

  return {
    handleNodeResize,
    handleNodeResizeStop
  };
};
