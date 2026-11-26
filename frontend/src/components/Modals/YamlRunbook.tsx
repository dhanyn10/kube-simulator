import { AlertTriangle, CheckCircle2, Copy, Globe, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { YamlRunbookStep } from '@/activities/modals/yamlRunbookHelpers';

interface YamlRunbookProps {
  readonly steps: YamlRunbookStep[];
  readonly colorMode: 'dark' | 'light';
  readonly copiedCommandId: string | null;
  readonly onCopyCommand: (id: string, command: string) => void;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Renders the ordered kubectl instructions shown before the generated YAML.
 */
export function YamlRunbook({
  steps,
  colorMode,
  copiedCommandId,
  onCopyCommand,
  title,
  description,
}: Readonly<YamlRunbookProps>) {
  const isDark = colorMode === 'dark';
  const headingTitle = title || 'Deployment Runbook';
  const headingDesc =
    description ||
    'Follow these steps in order from your terminal. If you use Docker Desktop, simply make sure "Enable Kubernetes" is checked in Settings.';

  return (
    <div className={cn('flex-1 overflow-auto custom-scrollbar p-6', isDark ? 'bg-slate-950' : 'bg-slate-50')}>
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h3 className={cn('text-xs font-bold uppercase tracking-wider flex items-center gap-2', isDark ? 'text-slate-200' : 'text-slate-800')}>
            <Terminal size={14} className="text-blue-500" />
            {headingTitle}
          </h3>
          <p className={cn('text-[11px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
            {headingDesc}
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {steps.map((step, stepIndex) => (
            <li
              key={step.id}
              data-testid={`yaml-runbook-step-${step.id}`}
              className={cn(
                'rounded-xl border p-4 flex flex-col gap-3',
                step.tone === 'warning'
                  ? isDark
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-amber-50 border-amber-300'
                  : isDark
                    ? 'bg-slate-900/80 border-slate-800'
                    : 'bg-white border-slate-200'
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold',
                    step.tone === 'warning'
                      ? 'bg-amber-500 text-white'
                      : isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  )}
                >
                  {step.tone === 'warning' ? <AlertTriangle size={12} /> : stepIndex + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>
                      {step.title}
                    </span>
                    {(step.id === 'docker-desktop-context' || step.requiresSetup) && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/30">
                        Before Apply
                      </span>
                    )}
                  </div>
                  <p className={cn('text-[11px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
                    {step.description}
                  </p>
                </div>
              </div>

              {step.commands.length > 0 && (
                <div className="flex flex-col gap-2 pl-9">
                  {step.commands.map((item, commandIndex) => {
                    const commandId = `${step.id}-${commandIndex}`;
                    const isCopied = copiedCommandId === commandId;
                    return (
                      <div
                        key={commandId}
                        className={cn(
                          'flex items-start gap-2 rounded-lg border p-2',
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        )}
                      >
                        <pre
                          className={cn(
                            'flex-1 min-w-0 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed',
                            isDark ? 'text-emerald-400' : 'text-emerald-700'
                          )}
                        >
                          {item.command}
                        </pre>
                        <button
                          type="button"
                          data-testid={`yaml-runbook-copy-${commandId}`}
                          onClick={() => onCopyCommand(commandId, item.command)}
                          className={cn(
                            'shrink-0 px-2 py-1 rounded text-[9px] font-bold uppercase flex items-center gap-1 transition-colors',
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          )}
                        >
                          {isCopied ? (
                            <CheckCircle2 size={10} className="text-emerald-400" />
                          ) : (
                            <Copy size={10} />
                          )}
                          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {step.notes && step.notes.length > 0 && (
                <ul className={cn('flex flex-col gap-1.5 pl-9 list-disc', isDark ? 'text-amber-200' : 'text-amber-900')}>
                  {step.notes.map((note) => (
                    <li key={note} className="text-[11px] leading-relaxed marker:text-amber-500">
                      {note}
                    </li>
                  ))}
                </ul>
              )}

              {step.urls && step.urls.length > 0 && (
                <div className={cn('flex flex-wrap gap-2 pl-9', isDark ? 'text-emerald-400' : 'text-emerald-700')}>
                  {step.urls.map((url) => (
                    <span
                      key={url}
                      className={cn(
                        'px-2 py-1 rounded font-mono text-[10px] flex items-center gap-1',
                        isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'
                      )}
                    >
                      <Globe size={10} />
                      {url}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
