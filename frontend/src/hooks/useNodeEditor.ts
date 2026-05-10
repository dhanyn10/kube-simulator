import { useState, useEffect, useRef, useCallback } from 'react';
import { useFlowStore } from '../store';

export const useNodeRename = (id: string, initialLabel: string, onRename?: (newName: string) => void) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleRename = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== initialLabel) {
      onRename?.(editValue.trim());
    } else {
      setEditValue(initialLabel);
    }
  }, [editValue, initialLabel, onRename]);

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
    onKeyDown
  };
};

export const useNodeResize = (id: string, type: string) => {
  const onNodeResize = useFlowStore((state) => state.onNodeResize);
  const onNodeResizeStop = useFlowStore((state) => state.onNodeResizeStop);

  const handleNodeResize = useCallback((event: any, params: any) => {
    onNodeResize(event, { id, type, ...params } as any);
  }, [id, type, onNodeResize]);

  const handleNodeResizeStop = useCallback((event: any, params: any) => {
    onNodeResizeStop(event, { id, ...params } as any);
  }, [id, onNodeResizeStop]);

  return {
    handleNodeResize,
    handleNodeResizeStop
  };
};
