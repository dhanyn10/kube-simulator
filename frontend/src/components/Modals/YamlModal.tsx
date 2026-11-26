import { logger } from '@/lib/logger';
import React from 'react';
import {
  FileCode2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Download,
  Terminal,
  Copy,
} from 'lucide-react';
import { cn, beautifyYaml } from '@/lib/utils';
import { parseYamlSearchLines, getNextMatchIndex } from '@/activities/modals/yamlSearchHelpers';
import {
  buildYamlRunbook,
  getStepsByStage,
  type YamlStage,
} from '@/activities/modals/yamlRunbookHelpers';
import { Modal } from './Modal';
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

interface YamlModalStepperProps {
  stage: YamlStage;
  onSelectStage: (stage: YamlStage) => void;
  isDark: boolean;
}

const getStepTabClass = (stage: YamlStage, target: YamlStage, isDark: boolean): string => {
  if (stage === target) return 'bg-blue-600 text-white shadow-sm';
  return isDark
    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60';
};

function YamlModalStepper({ stage, onSelectStage, isDark }: Readonly<YamlModalStepperProps>) {
  const isDeployActive = stage === 'deploy' || stage === 'localhost';
  return (
    <div
      className={cn(
        'px-4 py-2.5 border-b flex items-center gap-2 text-xs font-medium overflow-x-auto shrink-0',
        isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/80'
      )}
    >
      <button
        type="button"
        data-testid="yaml-tab-runbook"
        onClick={() => onSelectStage('prerequisites')}
        className={cn(
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 text-xs font-semibold cursor-pointer',
          getStepTabClass(stage, 'prerequisites', isDark)
        )}
      >
        <span>1. Prerequisites</span>
      </button>
      <ArrowRight size={12} className="text-slate-500 shrink-0" />
      <button
        type="button"
        data-testid="yaml-tab-manifest"
        onClick={() => onSelectStage('manifest')}
        className={cn(
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 text-xs font-semibold cursor-pointer',
          getStepTabClass(stage, 'manifest', isDark)
        )}
      >
        <span>2. Manifest</span>
      </button>
      <ArrowRight size={12} className="text-slate-500 shrink-0" />
      <button
        type="button"
        data-testid="yaml-tab-deploy"
        onClick={() => onSelectStage('deploy')}
        className={cn(
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 text-xs font-semibold cursor-pointer',
          isDeployActive
            ? isDark
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-blue-600 text-white shadow-sm'
            : getStepTabClass(stage, 'deploy', isDark)
        )}
      >
        <span>3. Deploy & Test</span>
      </button>
      <ArrowRight size={12} className="text-slate-500 shrink-0" />
      <button
        type="button"
        data-testid="yaml-tab-cleanup"
        onClick={() => onSelectStage('cleanup')}
        className={cn(
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 text-xs font-semibold cursor-pointer',
          getStepTabClass(stage, 'cleanup', isDark)
        )}
      >
        <span>4. Cleanup</span>
      </button>
    </div>
  );
}

interface YamlManifestSidebarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  totalMatches: number;
  activeMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClearSearch: () => void;
  colorMode: 'dark' | 'light';
  browserWarnings: string[];
  copiedCommandId: string | null;
  onCopyCommand: (id: string, command: string) => void;
  onDownloadYaml: () => void;
  onGoToLocalhost: () => void;
}

function YamlManifestSidebar({
  searchQuery,
  onSearchQueryChange,
  totalMatches,
  activeMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClearSearch,
  colorMode,
  browserWarnings,
  copiedCommandId,
  onCopyCommand,
  onDownloadYaml,
  onGoToLocalhost,
}: Readonly<YamlManifestSidebarProps>) {
  const isDark = colorMode === 'dark';
  const isApplyCopied = copiedCommandId === 'apply-manifest-0';

  return (
    <div
      className={cn(
        'w-full md:w-72 border-l flex flex-col overflow-hidden shrink-0',
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'
      )}
    >
      <YamlSearchBar
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        totalMatches={totalMatches}
        activeIndex={activeMatchIndex}
        onNextMatch={onNextMatch}
        onPrevMatch={onPrevMatch}
        onClear={onClearSearch}
        colorMode={colorMode}
      />

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto custom-scrollbar">
        {/* Quick Action: Download infra.yaml */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="yaml-download-btn"
            onClick={onDownloadYaml}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20 transition-all active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            <span>Download infra.yaml</span>
          </button>
        </div>

        {/* Step: Apply Manifest */}
        <div
          className={cn(
            'p-3.5 rounded-xl border flex flex-col gap-2.5',
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          )}
        >
          <span
            className={cn(
              'text-xs font-bold uppercase tracking-wider flex items-center gap-1.5',
              isDark ? 'text-slate-300' : 'text-slate-700'
            )}
          >
            <Terminal size={13} className="text-blue-500" />
            Apply Manifest
          </span>
          <p className={cn('text-[11px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
            Run in the folder where you saved <code className="font-mono text-emerald-500 font-semibold">infra.yaml</code>:
          </p>
          <div
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg border',
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            )}
          >
            <code
              className={cn(
                'flex-1 min-w-0 font-mono text-[10px] break-all leading-relaxed',
                isDark ? 'text-emerald-400' : 'text-emerald-700'
              )}
            >
              kubectl apply -f infra.yaml
            </code>
            <button
              type="button"
              data-testid="yaml-runbook-copy-apply-manifest-0"
              onClick={() => onCopyCommand('apply-manifest-0', 'kubectl apply -f infra.yaml')}
              className={cn(
                'shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer',
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              )}
            >
              {isApplyCopied ? (
                <CheckCircle2 size={11} className="text-emerald-400" />
              ) : (
                <Copy size={11} />
              )}
              <span>{isApplyCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Readiness Warnings */}
        {browserWarnings.length > 0 && (
          <div
            data-testid="yaml-browser-warning-banner"
            className={cn(
              'p-3.5 rounded-xl border flex flex-col gap-2',
              isDark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-50 border-amber-300'
            )}
          >
            <span
              className={cn(
                'text-xs font-bold flex items-center gap-1.5',
                isDark ? 'text-amber-300' : 'text-amber-800'
              )}
            >
              <AlertTriangle size={13} />
              Not ready for browser test ({browserWarnings.length})
            </span>
            <p className={cn('text-[11px] leading-relaxed', isDark ? 'text-amber-200/80' : 'text-amber-900/80')}>
              Some cards are missing or incomplete. Check the diagnostics before testing at localhost.
            </p>
            <button
              type="button"
              onClick={onGoToLocalhost}
              className={cn(
                'self-start px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-colors cursor-pointer',
                isDark
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
              )}
            >
              See the fixes
            </button>
          </div>
        )}

        <div
          className={cn(
            'mt-auto p-3 rounded-lg border border-dashed flex flex-col gap-1.5',
            isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'
          )}
        >
          <span className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">Pro Tip</span>
          <p className={cn('text-[11px] leading-normal', isDark ? 'text-slate-400' : 'text-slate-600')}>
            Ensure your context is set to <code className="bg-slate-800 text-emerald-400 px-1 py-0.5 rounded font-mono text-[10px]">docker-desktop</code> before applying.
          </p>
        </div>
      </div>
    </div>
  );
}

interface YamlModalFooterProps {
  stage: YamlStage;
  hasRunbook: boolean;
  isDark: boolean;
  onClose: () => void;
  onSelectStage: (stage: YamlStage) => void;
}

function YamlModalFooter({
  stage,
  hasRunbook,
  isDark,
  onClose,
  onSelectStage,
}: Readonly<YamlModalFooterProps>) {
  const isCleanup = hasRunbook && stage === 'cleanup';

  return (
    <div
      data-testid="yaml-modal-footer"
      className="flex items-center justify-between w-full"
    >
      {isCleanup ? (
        <button
          type="button"
          data-testid="yaml-btn-back"
          onClick={() => onSelectStage('deploy')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex items-center gap-1.5 cursor-pointer",
            isDark
              ? "border-slate-700 hover:bg-slate-800 text-slate-300"
              : "border-slate-300 hover:bg-slate-100 text-slate-700"
          )}
        >
          <ArrowLeft size={13} />
          <span>Deploy & Test</span>
        </button>
      ) : (
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
      )}

      {isCleanup ? (
        <button
          type="button"
          data-testid="yaml-modal-close-btn"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95 cursor-pointer"
        >
          Close
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {hasRunbook && stage === 'manifest' && (
            <button
              type="button"
              data-testid="yaml-btn-back"
              onClick={() => onSelectStage('prerequisites')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex items-center gap-1.5 cursor-pointer",
                isDark
                  ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                  : "border-slate-300 hover:bg-slate-100 text-slate-700"
              )}
            >
              <ArrowLeft size={13} />
              <span>Prerequisites</span>
            </button>
          )}

          {hasRunbook && (stage === 'deploy' || stage === 'localhost') && (
            <button
              type="button"
              data-testid="yaml-btn-back"
              onClick={() => onSelectStage('manifest')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex items-center gap-1.5 cursor-pointer",
                isDark
                  ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                  : "border-slate-300 hover:bg-slate-100 text-slate-700"
              )}
            >
              <ArrowLeft size={13} />
              <span>Manifest</span>
            </button>
          )}

          {hasRunbook && stage === 'prerequisites' && (
            <button
              type="button"
              data-testid="yaml-runbook-view-manifest"
              onClick={() => onSelectStage('manifest')}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next: View Manifest</span>
              <ArrowRight size={13} />
            </button>
          )}

          {hasRunbook && stage === 'manifest' && (
            <button
              type="button"
              data-testid="yaml-btn-next-localhost"
              onClick={() => onSelectStage('deploy')}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next: Deploy & Test</span>
              <ArrowRight size={13} />
            </button>
          )}

          {hasRunbook && (stage === 'deploy' || stage === 'localhost') && (
            <button
              type="button"
              data-testid="yaml-btn-next-cleanup"
              onClick={() => onSelectStage('cleanup')}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next: Cleanup</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only YAML viewer modal (with copy + search + 3-stage deployment workflow).
 * Matches unified modal styling across Kube Simulator.
 */
export function YamlModal({ content, colorMode, onClose }: Readonly<YamlModalProps>) {
  const [copied, setCopied] = React.useState(false);
  const [copiedCommandId, setCopiedCommandId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);
  const [stage, setStage] = React.useState<YamlStage>('prerequisites');
  const viewerRef = React.useRef<HTMLDivElement>(null);

  const formattedContent = React.useMemo(() => beautifyYaml(content), [content]);
  const runbook = React.useMemo(() => buildYamlRunbook(formattedContent), [formattedContent]);
  const activeStage = runbook.length > 0 ? stage : 'manifest';
  const prereqSteps = React.useMemo(() => getStepsByStage(runbook, 'prerequisites'), [runbook]);
  const deploySteps = React.useMemo(() => getStepsByStage(runbook, 'deploy'), [runbook]);
  const cleanupSteps = React.useMemo(() => getStepsByStage(runbook, 'cleanup'), [runbook]);
  const browserWarnings = React.useMemo(
    () => runbook.find((step) => step.id === 'browser-test-warnings')?.notes || [],
    [runbook]
  );

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

  const handleDownloadYaml = () => {
    try {
      const blob = new Blob([formattedContent], { type: 'text/yaml;charset=utf-8' });
      if (typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'infra.yaml';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      logger.error('Failed to download YAML file: ', err);
    }
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

  const headerExtra = (
    <span
      data-testid="auto-beautified-badge"
      className={cn(
        'px-2 py-0.5 text-[10px] font-semibold rounded-full border flex items-center gap-1 shrink-0',
        isDark
          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      )}
    >
      <Sparkles size={11} />
      Auto-Beautified
    </span>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Kubernetes Manifest Output"
      subtitle="Preview, customize add-ons, and deploy to your local cluster"
      icon={FileCode2}
      iconColorClass="text-emerald-500"
      headerExtra={headerExtra}
      closeLabel="Close YAML"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[80vh]"
      disableScroll
      disablePadding
      footer={
        <YamlModalFooter
          stage={activeStage}
          hasRunbook={runbook.length > 0}
          isDark={isDark}
          onClose={onClose}
          onSelectStage={setStage}
        />
      }
    >
      {runbook.length > 0 && (
        <YamlModalStepper stage={activeStage} onSelectStage={setStage} isDark={isDark} />
      )}

      {activeStage === 'prerequisites' && runbook.length > 0 && (
        <YamlRunbook
          steps={prereqSteps}
          colorMode={colorMode}
          copiedCommandId={copiedCommandId}
          onCopyCommand={handleCopyPrereq}
          title="1. Cluster Prerequisites"
          description="Follow these steps in your terminal before applying the manifest. If you use Docker Desktop, make sure 'Enable Kubernetes' is checked in Settings."
        />
      )}

      {(activeStage === 'deploy' || activeStage === 'localhost') && runbook.length > 0 && (
        <YamlRunbook
          steps={deploySteps}
          colorMode={colorMode}
          copiedCommandId={copiedCommandId}
          onCopyCommand={handleCopyPrereq}
          title="3. Deploy & Test"
          description="Apply your infra.yaml manifest, verify that pods and services are running, and test the application at localhost."
        />
      )}

      {activeStage === 'cleanup' && runbook.length > 0 && (
        <YamlRunbook
          steps={cleanupSteps}
          colorMode={colorMode}
          copiedCommandId={copiedCommandId}
          onCopyCommand={handleCopyPrereq}
          title="4. Cleanup & Teardown"
          description="Delete deployed application resources, stop active port-forwards, and revert cluster add-ons when you are done."
        />
      )}

      {activeStage === 'manifest' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Main YAML Viewer */}
          <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Sticky Copy Button at Top-Right of YAML Block */}
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                data-testid="yaml-modal-copy-btn"
                onClick={handleCopy}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md border backdrop-blur-md transition-all active:scale-95 cursor-pointer',
                  isDark
                    ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600'
                    : 'bg-white/95 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                )}
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy YAML</span>
                  </>
                )}
              </button>
            </div>

            <div
              ref={viewerRef}
              data-testid="yaml-code-viewer"
              className={cn(
                'flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-auto select-all custom-scrollbar',
                isDark ? 'bg-slate-950 text-emerald-500/90' : 'bg-slate-50 text-emerald-700/90'
              )}
            >
              {!formattedContent && (
                <pre data-testid="yaml-viewer-pre"># No resources generated yet.</pre>
              )}

              {formattedContent && !searchQuery.trim() && (
                <pre data-testid="yaml-viewer-pre">{formattedContent}</pre>
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
          </div>

          {/* Right Sidebar */}
          <YamlManifestSidebar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            totalMatches={totalMatches}
            activeMatchIndex={activeMatchIndex}
            onNextMatch={handleNextMatch}
            onPrevMatch={handlePrevMatch}
            onClearSearch={handleClearSearch}
            colorMode={colorMode}
            browserWarnings={browserWarnings}
            copiedCommandId={copiedCommandId}
            onCopyCommand={handleCopyPrereq}
            onDownloadYaml={handleDownloadYaml}
            onGoToLocalhost={() => setStage('deploy')}
          />
        </div>
      )}
    </Modal>
  );
}
