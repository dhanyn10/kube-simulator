import { cn } from '../../lib/utils';

interface SelectorGroupProps {
  options: readonly { label: string; value: string; desc?: string }[] | readonly { id: string; label: string; desc?: string }[];
  currentValue: string | undefined;
  onSelect: (value: string) => void;
  colorMode: string;
  activeColorClass?: string;
  activeShadowClass?: string;
  className?: string;
  layout?: 'wrap' | 'grid' | 'column';
  validateOption?: (value: string) => boolean;
}

const getSelectorButtonClasses = (
  isActive: boolean,
  isInvalid: boolean | undefined,
  colorMode: string,
  activeColorClass: string,
  activeShadowClass: string
) => {
  if (isActive) {
    return `${activeColorClass} ${activeShadowClass}`;
  }

  const baseState = colorMode === 'dark'
    ? "bg-slate-800 border-slate-700 hover:border-slate-600"
    : "bg-slate-50 border-slate-200 hover:border-slate-300";

  if (!isInvalid) return baseState;

  const invalidState = colorMode === 'dark'
    ? " border-red-900/50 text-red-400/70"
    : " border-red-200 text-red-400";

  return `${baseState}${invalidState}`;
};

export const SelectorGroup = ({
  options,
  currentValue,
  onSelect,
  colorMode,
  activeColorClass = "bg-blue-600 border-blue-600 text-white",
  activeShadowClass = "",
  className = "",
  layout = 'wrap',
  validateOption
}: SelectorGroupProps) => {
  const containerClasses = cn(
    layout === 'wrap' && "flex flex-wrap gap-1",
    layout === 'grid' && "grid grid-cols-3 gap-2",
    layout === 'column' && "flex flex-col gap-2",
    className
  );

  return (
    <div className={containerClasses}>
      {options.map((opt: any) => {
        const val = opt.value ?? opt.id;
        const isActive = currentValue === val;
        const isInvalid = validateOption?.(val);
        const stateClasses = getSelectorButtonClasses(
          isActive,
          isInvalid,
          colorMode,
          activeColorClass,
          activeShadowClass
        );

        return (
          <button
            type="button"
            key={val}
            onClick={() => onSelect(val)}
            className={cn(
              "transition-all border",
              layout === 'column' ? "flex flex-col items-start p-2 rounded text-left" : "text-[8px] px-2 py-0.5 rounded",
              stateClasses
            )}
          >
            <span className={cn("font-bold", layout !== 'column' && "text-[8px]")}>{opt.label}</span>
            {layout === 'column' && opt.desc && (
              <span className={cn("text-[8px] leading-tight mt-0.5", isActive ? "opacity-90" : "text-slate-500")}>
                {opt.desc}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
