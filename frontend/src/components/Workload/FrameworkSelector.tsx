import { Box } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RUNTIMES } from '../../constants/config';
import { ConfigSection } from '../UI/ConfigUI';

interface FrameworkSelectorProps {
  runtime: string;
  framework: string | undefined;
  colorMode: string;
  performUpdate: (updates: any) => void;
}

/**
 * Component for selecting the application framework based on the chosen runtime.
 */
export const FrameworkSelector = ({
  runtime,
  framework,
  colorMode,
  performUpdate
}: FrameworkSelectorProps) => {
  if (Boolean(runtime) === false || runtime === 'none') return null;

  const frameworks = RUNTIMES[runtime as keyof typeof RUNTIMES]?.frameworks;
  if (Boolean(frameworks) === false) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-1">
      <ConfigSection title="Framework" icon={Box}>
        <div className="flex flex-wrap gap-1">
          {frameworks.map((fw) => {
            const isActive = framework === fw;
            let btnClass = "bg-white border-slate-200 hover:border-slate-300";
            if (isActive) {
              btnClass = "bg-emerald-600 border-emerald-600 text-white";
            } else if (colorMode === 'dark') {
              btnClass = "bg-slate-950 border-slate-800 hover:border-slate-700";
            }

            return (
              <button
                key={fw}
                onClick={() => performUpdate({ framework: fw })}
                className={cn(
                  "text-[8px] px-2 py-1 rounded-full border transition-all",
                  btnClass
                )}
              >
                {fw}
              </button>
            );
          })}
        </div>
      </ConfigSection>
    </div>
  );
};
