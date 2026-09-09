import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfigSection } from '@/components/UI/ConfigUI';
import { getFrameworksForRuntime, getFrameworkButtonClass } from '@/activity/workload';

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
  const frameworks = getFrameworksForRuntime(runtime);
  if (!frameworks) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-1">
      <ConfigSection title="Framework" icon={Box}>
        <div className="flex flex-wrap gap-1">
          {frameworks.map((fw) => {
            const isActive = framework === fw;
            const btnClass = getFrameworkButtonClass(isActive, colorMode);

            return (
              <button
                type="button"
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
