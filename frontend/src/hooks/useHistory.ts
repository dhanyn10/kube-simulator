import { useCallback } from 'react';
import { applyHistoryState, useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';

/**
 * Hook for accessing the canvas history feature:
 * reads history logs/current index/loading state from the flow store,
 * fetches history logs from the backend, and provides undo/redo/jump handlers
 * that open the history tab, apply state via `applyHistoryState`, and refresh logs.
 *
 * @returns Object with `historyLogs`, `currentHistoryIndex`, `isLoading`, `fetchHistoryLogs`,
 *   `handleUndo`, `handleRedo`, `handleJumpToHistory`.
 */
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
    const state = await getBackendGateway().undo();
    if (state) {
      applyHistoryState(state);
      await fetchHistoryLogs();
    }
  }, [openHistoryTab, fetchHistoryLogs]);

  const handleRedo = useCallback(async () => {
    openHistoryTab();
    const state = await getBackendGateway().redo();
    if (state) {
      applyHistoryState(state);
      await fetchHistoryLogs();
    }
  }, [openHistoryTab, fetchHistoryLogs]);

  const handleJumpToHistory = useCallback(async (index: number) => {
    const state = await getBackendGateway().jumpToHistory(index);
    if (state) {
      applyHistoryState(state);
      await fetchHistoryLogs();
    }
  }, [fetchHistoryLogs]);

  return { historyLogs, currentHistoryIndex, isLoading, fetchHistoryLogs, handleUndo, handleRedo, handleJumpToHistory };
}
