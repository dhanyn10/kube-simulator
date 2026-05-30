import  { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Globe, Box, ChevronDown, Plus, Check } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { DEFAULT_REGISTRY_IMAGES } from '../../constants/config';

interface ImageDropdownProps {
  value: string;
  onChange: (value: string) => void;
  colorMode: 'dark' | 'light';
}

export const ImageDropdown = ({ value, onChange, colorMode }: ImageDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const customImages = useFlowStore((state) => state.customImages);
  const addCustomImage = useFlowStore((state) => state.addCustomImage);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Grouped options list
  const filteredOptions = useMemo(() => {
    const query = search.toLowerCase();
    
    const dockerHub = DEFAULT_REGISTRY_IMAGES.filter(img => 
      img.name.toLowerCase().includes(query)
    ).map(img => ({ name: img.name, source: 'docker' as const }));

    const local = customImages.filter(img => 
      img.toLowerCase().includes(query)
    ).map(img => ({ name: img, source: 'local' as const }));

    return { dockerHub, local };
  }, [search, customImages]);

  const hasMatches = filteredOptions.dockerHub.length > 0 || filteredOptions.local.length > 0;
  
  const handleSelectOption = (imgName: string) => {
    onChange(imgName);
    setIsOpen(false);
    setSearch('');
  };

  const handleUseCustomImage = () => {
    if (!search.trim()) return;
    const img = search.trim();
    // Register it as custom image so it saves
    addCustomImage(img);
    handleSelectOption(img);
  };

  const getOptionClasses = (imgName: string) => {
    const isSelected = value === imgName;
    if (isSelected) {
      if (colorMode === 'dark') {
        return "bg-slate-900 text-blue-400";
      }
      return "bg-blue-50/50 text-blue-600";
    }

    if (colorMode === 'dark') {
      return "hover:bg-slate-900 text-slate-300";
    }
    return "hover:bg-slate-50 text-slate-700";
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Clickable Trigger Button */}
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

      {/* Dropdown Floating Pane */}
      {isOpen && (
        <div className={cn(
          "absolute left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150",
          colorMode === 'dark'
            ? "bg-slate-950/95 border-slate-800 backdrop-blur-lg shadow-black/80"
            : "bg-white/95 border-slate-200 backdrop-blur-lg shadow-slate-200/50"
        )}>
          {/* Integrated Search Box */}
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

          {/* Option List Scroll Container */}
          <div className="max-h-[190px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            
            {/* Custom typed option if matches don't contain it */}
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

            {/* Local / Custom Images Group */}
            {filteredOptions.local.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">Local & Custom Cache</p>
                <div className="space-y-0.5 mt-0.5">
                  {filteredOptions.local.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => handleSelectOption(opt.name)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] font-mono transition-colors",
                        getOptionClasses(opt.name)
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Box size={11} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{opt.name}</span>
                      </span>
                      {value === opt.name ? <Check size={12} className="text-blue-500 shrink-0" /> : (
                        <span className="text-[7px] bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded font-bold uppercase tracking-wider shrink-0 font-sans">LOCAL</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Docker Hub Registry Images Group */}
            {filteredOptions.dockerHub.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">Docker Hub Registry</p>
                <div className="space-y-0.5 mt-0.5">
                  {filteredOptions.dockerHub.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => handleSelectOption(opt.name)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] font-mono transition-colors",
                        getOptionClasses(opt.name)
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Globe size={11} className="text-blue-500 shrink-0" />
                        <span className="truncate">{opt.name}</span>
                      </span>
                      {value === opt.name ? <Check size={12} className="text-blue-500 shrink-0" /> : (
                        <span className="text-[7px] bg-blue-500/10 text-blue-500 px-1 py-0.2 rounded font-bold uppercase tracking-wider shrink-0 font-sans">PUBLIC</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasMatches && search.trim().length === 0 && (
              <p className="text-[10px] text-center text-slate-600 font-medium py-6">No image options registered</p>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
