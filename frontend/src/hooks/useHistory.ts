import { useCallback, useState } from 'react';
import { applyHistoryState, useFlowStore } from '../store';

export function useHistory() {
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const openHistoryTab = useCallback(() => {
    useFlowStore.setState({
      isRightSidebarVisible: true,
      isHistoryViewOpen: true,
    });
  }, []);

  const fetchHistoryLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      // @ts-ignore
      if (globalThis.go?.main?.App?.GetHistoryLogs) {
        // @ts-ignore
        const logs = await globalThis.go.main.App.GetHistoryLogs();
        if (Array.isArray(logs)) {
          setHistoryLogs([...logs].reverse());
        }
      }
      // @ts-ignore
      if (globalThis.go?.main?.App?.GetCurrentHistoryIndex) {
        // @ts-ignore
        const idx = await globalThis.go.main.App.GetCurrentHistoryIndex();
        setCurrentHistoryIndex(idx);
      }
    } finally {
      setIsLoading(false);
    }
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
