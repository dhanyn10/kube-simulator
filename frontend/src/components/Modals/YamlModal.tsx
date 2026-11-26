import { logger } from '@/lib/logger';
import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Sparkles, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { cn, beautifyYaml } from '@/lib/utils';
import { parseYamlSearchLines, getNextMatchIndex } from '@/activities/modals/yamlSearchHelpers';
import { buildYamlRunbook } from '@/activities/modals/yamlRunbookHelpers';
import { YamlRunbook } from './YamlRunbook';
import { YamlSearchBar } from './YamlSearchBar';

const getMatchHighlightClass = (isActive: boolean, isDark: boolean): string => {
  if (isActive) {
    return isDark
      ? 'bg-amber-400 text-slate-950 font-bold ring-1 ring-amber-300 shadow-sm'
      : 'bg-amber-500 text-white font-bold ring-1 ring-amber-600 shadow-sm';
  }
  return isDark
    ? 'bg-amber-400/25 text-amber-300'
    : 'bg-amber-200 text-amber-900';
};

interface YamlModalProps {
  content: string;
  colorMode: 'dark' | 'light';
  onClose: () => void;
}

/**
 * Read-only YAML viewer modal (with copy + search).
 */
export function YamlModal({ content, colorMode, onClose }: Readonly<YamlModalProps>) {
  const [copied, setCopied] = React.useState(false);
  const [copiedCommandId, setCopiedCommandId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);
  const viewerRef = React.useRef<HTMLDivElement>(null);

  const formattedContent = React.useMemo(() => beautifyYaml(content), [content]);
  const runbook = React.useMemo(() => buildYamlRunbook(formattedContent), [formattedContent]);
  const browserWarnings = React.useMemo(
    () => runbook.find((step) => step.id === 'browser-test-warnings')?.notes || [],
    [runbook]
  );
  const [view, setView] = React.useState<'runbook' | 'manifest'>('runbook');

  const searchResult = React.useMemo(
    () => parseYamlSearchLines(formattedContent, searchQuery),
    [formattedContent, searchQuery]
  );

  const isDark = colorMode === 'dark';
  const totalMatches = searchResult.totalMatches;

  React.useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  React.useEffect(() => {
    if (totalMatches === 0) return;
    const activeEl = viewerRef.current?.querySelector(`[data-match-index="${activeMatchIndex}"]`);
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeMatchIndex, totalMatches]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      logger.error('Failed to copy text: ', err);
    });
  };

  const handleCopyPrereq = (id: string, command: string) => {
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCommandId(id);
      setTimeout(() => setCopiedCommandId((prev) => (prev === id ? null : prev)), 2000);
    }).catch((err) => {
      logger.error('Failed to copy deployment command: ', err);
    });
  };

  const handleNextMatch = () => {
    setActiveMatchIndex((prev) => getNextMatchIndex(prev, totalMatches, 1));
  };

  const handlePrevMatch = () => {
    setActiveMatchIndex((prev) => getNextMatchIndex(prev, totalMatches, -1));
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveMatchIndex(0);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <dialog open className="yaml-modal-overlay">
      <button
        type="button"
        className="fixed inset-0 w-full h-full cursor-default outline-none bg-transparent"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        className={cn('yaml-modal-container', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-300')}
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={cn('p-4 border-b flex items-center justify-between', isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50/50')}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <h2 id="modal-title" className={cn('text-[10px] font-bold tracking-[0.2em] uppercase', isDark ? 'text-slate-400' : 'text-slate-600')}>
              Kubernetes Manifest Output
            </h2>
            <span
              data-testid="auto-beautified-badge"
              className={cn(
                'px-2 py-0.5 text-[9px] font-semibold rounded-full border flex items-center gap-1',
                isDark
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}
            >
              <Sparkles size={10} />
              Auto-Beautified
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close YAML"
            aria-label="Close YAML"
            className={cn('p-1.5 rounded transition-colors', isDark ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-200 text-slate-500')}
          >
            <X size={16} />
          </button>
        </div>

        {runbook.length > 0 && (
          <div className={cn('px-4 py-2 border-b flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider', isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-100/80')}>
            <button
              type="button"
              data-testid="yaml-tab-runbook"
              onClick={() => setView('runbook')}
              className={cn(
                'px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors',
                view === 'runbook'
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>1. Deployment Steps</span>
            </button>
            <ArrowRight size={12} className="text-slate-500" />
            <button
              type="button"
              data-testid="yaml-tab-manifest"
              onClick={() => setView('manifest')}
              className={cn(
                'px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors',
                view === 'manifest'
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>2. View YAML</span>
            </button>
          </div>
        )}

        {view === 'runbook' && runbook.length > 0 ? (
          <YamlRunbook
            steps={runbook}
            colorMode={colorMode}
            copiedCommandId={copiedCommandId}
            onCopyCommand={handleCopyPrereq}
          />
        ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Main YAML Viewer */}
          <div
            ref={viewerRef}
            className={cn(
              'flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-auto select-all custom-scrollbar',
              isDark ? 'bg-slate-950 text-emerald-500/90' : 'bg-slate-50 text-emerald-700/90'
            )}
          >
            {!formattedContent && (
              <pre># No resources generated yet.</pre>
            )}

            {formattedContent && !searchQuery.trim() && (
              <pre>{formattedContent}</pre>
            )}

            {formattedContent && searchQuery.trim() && (
              <div className="font-mono text-[11px] leading-relaxed whitespace-pre select-text">
                {searchResult.lines.map((line) => (
                  <div key={`line-${line.lineIndex}`} className="min-h-[1.25rem]">
                    {line.segments.map((seg, sIdx) => {
                      if (!seg.isMatch) {
                        return <span key={`seg-${line.lineIndex}-${sIdx}`}>{seg.text}</span>;
                      }
                      const isActive = seg.matchIndex === activeMatchIndex;
                      return (
                        <mark
                          key={`match-${seg.matchIndex}`}
                          data-match-index={seg.matchIndex}
                          data-active-match={isActive ? 'true' : undefined}
                          className={cn(
                            'rounded px-0.5 transition-all font-mono',
                            getMatchHighlightClass(isActive, isDark)
                          )}
                        >
                          {seg.text}
                        </mark>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar: Search Form & Deployment Guide */}
          <div className={cn('w-full md:w-72 border-l flex flex-col overflow-hidden', isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200')}>
            {/* Search Manifest Form */}
            <YamlSearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              totalMatches={totalMatches}
              activeIndex={activeMatchIndex}
              onNextMatch={handleNextMatch}
              onPrevMatch={handlePrevMatch}
              onClear={handleClearSearch}
              colorMode={colorMode}
            />

            {/* Guidance Section */}
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto custom-scrollbar">
              <h3 className={cn('text-[10px] font-bold uppercase tracking-wider flex items-center gap-2', isDark ? 'text-slate-400' : 'text-slate-600')}>
                <CheckCircle2 size={12} className="text-emerald-500" />
                Before You Apply
              </h3>

              {browserWarnings.length > 0 && (
                <div
                  data-testid="yaml-browser-warning-banner"
                  className={cn('p-3 rounded border flex flex-col gap-2', isDark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-50 border-amber-300')}
                >
                  <span className={cn('text-[10px] font-bold uppercase flex items-center gap-1.5', isDark ? 'text-amber-300' : 'text-amber-800')}>
                    <AlertTriangle size={12} />
                    Not ready for browser test ({browserWarnings.length})
                  </span>
                  <p className={cn('text-[10px] leading-relaxed', isDark ? 'text-amber-200/80' : 'text-amber-900/80')}>
                    Some cards are missing or incomplete. Open Deployment Steps for the exact fixes before using localhost.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('runbook')}
                    className={cn('self-start px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors', isDark ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200' : 'bg-amber-100 hover:bg-amber-200 text-amber-900')}
                  >
                    See the fixes
                  </button>
                </div>
              )}

              <p className={cn('text-[10px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
                The Deployment Steps tab contains the exact commands to run, in order. It covers namespace creation, cluster add-ons, saving the manifest, and <code className={cn('px-1 rounded', isDark ? 'bg-slate-800 text-blue-400' : 'bg-slate-200 text-blue-700')}>kubectl apply</code>.
              </p>

              {runbook.length > 0 && (
                <button
                  type="button"
                  onClick={() => setView('runbook')}
                  className={cn('px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                >
                  <ArrowLeft size={12} />
                  Open Deployment Steps
                </button>
              )}

              <div className={cn('mt-auto p-3 rounded border border-dashed flex flex-col gap-2', isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200')}>
                <span className={cn('text-[9px] font-bold uppercase text-blue-500')}>Pro Tip</span>
                <p className={cn('text-[9px] leading-normal', isDark ? 'text-slate-400' : 'text-slate-600')}>Ensure your <code className="bg-slate-800 px-1 rounded">kubeconfig</code> is pointed to the correct cluster before applying.</p>
              </div>
            </div>
          </div>
        </div>
        )}

        <div
          data-testid="yaml-modal-footer"
          className={cn('p-3 border-t flex justify-end gap-2', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}
        >
          <button
            type="button"
            onClick={onClose}
            className={cn('px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors', isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
          >
            Close
          </button>
          {runbook.length > 0 && view === 'runbook' && (
            <button
              type="button"
              data-testid="yaml-runbook-view-manifest"
              onClick={() => setView('manifest')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-blue-900/20 text-white transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Next: View YAML</span>
              <ArrowRight size={12} />
            </button>
          )}
          {runbook.length > 0 && view === 'manifest' && (
            <button
              type="button"
              onClick={() => setView('runbook')}
              className={cn('px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
            >
              <ArrowLeft size={12} />
              Deployment Steps
            </button>
          )}
          <button
            type="button"
            data-testid="yaml-modal-copy-btn"
            onClick={handleCopy}
            className="relative px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase shadow-lg shadow-blue-900/20 text-white transition-all active:scale-95"
          >
            {copied ? (
              <span className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                <CheckCircle2 size={12} />
                Copied!
              </span>
            ) : (
              view === 'runbook' && runbook.length > 0 ? 'Copy YAML' : 'Copy'
            )}
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
