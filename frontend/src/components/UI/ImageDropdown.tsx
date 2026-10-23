import React, { useState } from 'react';
import { Search, Globe, Box, ChevronDown, ChevronRight, Plus, Check, Zap, Cpu, HardDrive, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getOptionClasses,
  useImageDropdown,
  ImageOption,
} from '@/activities/ui';

interface ImageDropdownProps {
  value: string;
  onChange: (value: string) => void;
  colorMode: 'dark' | 'light';
}

interface ImageAccordionItemProps {
  opt: ImageOption;
  value: string;
  colorMode: 'dark' | 'light';
  handleSelectOption: (imgName: string) => void;
}

const ImageAccordionItem = ({ opt, value, colorMode, handleSelectOption }: ImageAccordionItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelected = value === opt.name;

  return (
    <div className={cn(
      "rounded-lg border transition-all duration-150 overflow-hidden",
      colorMode === 'dark'
        ? (isSelected ? "border-blue-500/50 bg-slate-900/80" : "border-slate-800/80 bg-slate-900/30 hover:border-slate-700")
        : (isSelected ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-slate-50/50 hover:border-slate-300")
    )}>
      <div className="flex items-center justify-between p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => handleSelectOption(opt.name)}
          className={cn(
            "flex-1 flex items-center justify-between text-left text-[11px] font-mono truncate transition-colors py-0.5 px-1 rounded",
            getOptionClasses(opt.name, value, colorMode)
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {opt.source === 'local' ? (
              <Box size={11} className="text-emerald-500 shrink-0" />
            ) : (
              <Globe size={11} className="text-blue-500 shrink-0" />
            )}
            <span className="truncate">{opt.name}</span>
          </span>
          {isSelected ? (
            <Check size={12} className="text-blue-500 shrink-0" />
          ) : (
            <span className={cn(
              "text-[7px] px-1 py-0.2 rounded font-bold uppercase tracking-wider shrink-0 font-sans",
              opt.source === 'local' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
            )}>
              {opt.source === 'local' ? 'LOCAL' : 'PUBLIC'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          title="Toggle hero stats"
          className={cn(
            "p-1 rounded text-slate-400 hover:text-slate-200 transition-colors shrink-0",
            colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-200"
          )}
        >
          <ChevronRight size={12} className={cn("transition-transform duration-200", isExpanded && "rotate-90")} />
        </button>
      </div>

      {isExpanded && (
        <div className={cn(
          "px-2.5 pb-2 pt-1 border-t grid grid-cols-2 gap-1.5 font-mono text-[9px]",
          colorMode === 'dark' ? "border-slate-800/80 bg-slate-950/60 text-slate-300" : "border-slate-200/80 bg-white/80 text-slate-700"
        )}>
          <div className="flex items-center gap-1 bg-slate-800/30 dark:bg-slate-900/50 p-1 rounded">
            <Gauge size={10} className="text-emerald-400 shrink-0" />
            <span className="text-slate-500 mr-0.5">TRF:</span>
            <span className="font-semibold text-emerald-400 truncate">{opt.characteristics.maxTraffic}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/30 dark:bg-slate-900/50 p-1 rounded">
            <HardDrive size={10} className="text-blue-400 shrink-0" />
            <span className="text-slate-500 mr-0.5">RAM:</span>
            <span className="font-semibold truncate">{opt.characteristics.ramWeight}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/30 dark:bg-slate-900/50 p-1 rounded">
            <Zap size={10} className="text-amber-400 shrink-0" />
            <span className="text-slate-500 mr-0.5">STU:</span>
            <span className="font-semibold truncate">{opt.characteristics.startup}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/30 dark:bg-slate-900/50 p-1 rounded">
            <Cpu size={10} className="text-purple-400 shrink-0" />
            <span className="text-slate-500 mr-0.5">CPU:</span>
            <span className="font-semibold truncate">{opt.characteristics.cpuClass}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface OptionsListProps {
  search: string;
  value: string;
  colorMode: 'dark' | 'light';
  filteredOptions: { dockerHub: ImageOption[]; local: ImageOption[] };
  handleSelectOption: (imgName: string) => void;
  handleUseCustomImage: () => void;
}

const OptionsList = ({
  search,
  value,
  colorMode,
  filteredOptions,
  handleSelectOption,
  handleUseCustomImage
}: OptionsListProps) => {
  const hasMatches = filteredOptions.dockerHub.length > 0 || filteredOptions.local.length > 0;

  return (
    <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
      {search.trim().length > 0 && (
        <button
          type="button"
          onClick={handleUseCustomImage}
          className={cn(
            "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
            colorMode === 'dark' ? "hover:bg-blue-600/10 hover:text-blue-400" : "hover:bg-blue-50 hover:text-blue-600"
          )}
        >
          <span className="flex items-center gap-2 font-mono text-[11px] truncate">
            <Plus size={12} className="text-blue-500 shrink-0" />
            <span>Use custom image: <strong>{search}</strong></span>
          </span>
          <span className="text-[8px] bg-blue-500/10 text-blue-500 px-1 py-0.2 rounded font-bold uppercase shrink-0">REGISTER</span>
        </button>
      )}

      {filteredOptions.local.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">Local & Custom Cache</p>
          <div className="space-y-1 mt-0.5">
            {filteredOptions.local.map((opt) => (
              <ImageAccordionItem
                key={opt.name}
                opt={opt}
                value={value}
                colorMode={colorMode}
                handleSelectOption={handleSelectOption}
              />
            ))}
          </div>
        </div>
      )}

      {filteredOptions.dockerHub.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">Docker Hub Registry</p>
          <div className="space-y-1 mt-0.5">
            {filteredOptions.dockerHub.map((opt) => (
              <ImageAccordionItem
                key={opt.name}
                opt={opt}
                value={value}
                colorMode={colorMode}
                handleSelectOption={handleSelectOption}
              />
            ))}
          </div>
        </div>
      )}

      {!hasMatches && search.trim().length === 0 && (
        <p className="text-[10px] text-center text-slate-600 font-medium py-6">No image options registered</p>
      )}
    </div>
  );
};

export const ImageDropdown = ({ value, onChange, colorMode }: ImageDropdownProps) => {
  const {
    isOpen,
    setIsOpen,
    search,
    setSearch,
    dropdownRef,
    inputRef,
    filteredOptions,
    handleSelectOption,
    handleUseCustomImage,
  } = useImageDropdown({ value, onChange });

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-3 py-1.8 rounded-lg border text-left flex items-center justify-between text-xs outline-none transition-all duration-200 group font-mono",
          colorMode === 'dark'
            ? "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200 focus:border-blue-500/50"
            : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800 focus:border-blue-400"
        )}
      >
        <span className="truncate pr-4">
          {value || <span className="text-slate-500 not-italic font-sans">Select container image...</span>}
        </span>
        <ChevronDown size={14} className={cn("text-slate-500 group-hover:text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150",
          colorMode === 'dark'
            ? "bg-slate-950/95 border-slate-800 backdrop-blur-lg shadow-black/80"
            : "bg-white/95 border-slate-200 backdrop-blur-lg shadow-slate-200/50"
        )}>
          <div className="relative mb-2">
            <Search size={12} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or type custom image..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full pl-8 pr-2 py-1.5 text-xs outline-none rounded-lg border font-mono transition-all",
                colorMode === 'dark'
                  ? "bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                  : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
              )}
            />
          </div>

          <OptionsList
            search={search}
            value={value}
            colorMode={colorMode}
            filteredOptions={filteredOptions}
            handleSelectOption={handleSelectOption}
            handleUseCustomImage={handleUseCustomImage}
          />
        </div>
      )}
    </div>
  );
};
