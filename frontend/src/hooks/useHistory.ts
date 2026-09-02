import { useCallback, useState } from 'react';
import { applyHistoryState, useFlowStore } from '../store';

export function useHistory() {
  const historyLogs = useFlowStore((state) => state.historyLogs);
  const currentHistoryIndex = useFlowStore((state) => state.currentHistoryIndex);
  const isLoading = useFlowStore((state) => state.isHistoryLoading);
  const fetchHistoryLogs = useFlowStore((state) => state.fetchHistoryLogs);

  const openHistoryTab = useCallback(() => {
    useFlowStore.setState({
      isRightSidebarVisible: true,
      isHistoryViewOpen: true,
    });
  }, []);

  const handleUndo = useCallback(async () => {
    openHistoryTab();
    // @ts-ignore
    if (globalThis.go?.main?.App?.Undo) {
      // @ts-ignore
      const state = await globalThis.go.main.App.Undo();
      if (state) {
        applyHistoryState(state);
        await fetchHistoryLogs();
      }
    }
  }, [openHistoryTab, fetchHistoryLogs]);

  const handleRedo = useCallback(async () => {
    openHistoryTab();
    // @ts-ignore
    if (globalThis.go?.main?.App?.Redo) {
      // @ts-ignore
      const state = await globalThis.go.main.App.Redo();
      if (state) {
        applyHistoryState(state);
        await fetchHistoryLogs();
      }
    }
  }, [openHistoryTab, fetchHistoryLogs]);

  const handleJumpToHistory = useCallback(async (index: number) => {
    // @ts-ignore
    if (globalThis.go?.main?.App?.JumpToHistory) {
      // @ts-ignore
      const state = await globalThis.go.main.App.JumpToHistory(index);
      if (state) {
        applyHistoryState(state);
        await fetchHistoryLogs();
      }
    }
  }, [fetchHistoryLogs]);

  return { historyLogs, currentHistoryIndex, isLoading, fetchHistoryLogs, handleUndo, handleRedo, handleJumpToHistory };
}
