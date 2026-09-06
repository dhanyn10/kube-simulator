import { useState, useRef, useCallback, useEffect } from 'react';

export const useTerminalScroll = (
  isTerminalOpen: boolean,
  terminalActiveTab: 'activity' | 'logs',
  currentPage: number,
  totalPages: number,
  filteredLogs: string[]
) => {
  const [isAutoscroll, setIsAutoscroll] = useState(true);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);

  const performScroll = useCallback((instant: boolean) => {
    const el = contentAreaRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    const behavior = instant ? 'auto' : 'smooth';
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior });
    } else if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
    const timeoutMs = instant ? 100 : 600;
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, timeoutMs);
  }, []);

  const handleToggleAutoscroll = useCallback((checked: boolean) => {
    setIsAutoscroll(checked);
    if (checked) {
      performScroll(true);
    }
  }, [performScroll]);

  const handleScroll = useCallback(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 15;
    if (isProgrammaticScrollRef.current) {
      if (isAtBottom) {
        isProgrammaticScrollRef.current = false;
      }
      return;
    }
    if (!isAtBottom && isAutoscroll) {
      setIsAutoscroll(false);
    }
  }, [isAutoscroll]);

  useEffect(() => {
    if (isTerminalOpen && isAutoscroll) {
      if (terminalActiveTab === 'activity' || currentPage === totalPages) {
        performScroll(false);
      }
    }
  }, [isTerminalOpen, isAutoscroll, filteredLogs, terminalActiveTab, currentPage, totalPages, performScroll]);

  return {
    contentAreaRef,
    terminalEndRef,
    isAutoscroll,
    handleToggleAutoscroll,
    handleScroll,
  };
};
