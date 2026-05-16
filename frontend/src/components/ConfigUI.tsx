import React from 'react';
import { cn } from '../lib/utils';
import { Eye, EyeOff, Minus, Plus } from 'lucide-react';

export const ConfigLabel = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <label className={cn("text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5", className)}>
    {children}
  </label>
);

export const VisibilityToggle = ({ isVisible, onToggle }: { isVisible: boolean, onToggle: () => void }) => (
  <button onClick={onToggle} className="text-slate-500 hover:text-blue-500 transition-colors">
    {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
  </button>
);

export const ConfigInput = ({ value, onChange, placeholder, colorMode, className = "", type = "text", min, max }: any) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    min={min}
    max={max}
    className={cn(
      "w-full text-[10px] p-2 rounded border outline-none",
      colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800",
      className
    )}
  />
);

export const ConfigSection = ({ title, icon: Icon, isVisible, onToggle, children }: any) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <ConfigLabel>
        {Icon && <Icon size={10} />} {title}
      </ConfigLabel>
      {onToggle && <VisibilityToggle isVisible={isVisible !== false} onToggle={onToggle} />}
    </div>
    {children}
  </div>
);

export const NumberStepper = ({ value, onChange, min = 1, max = 1000, colorMode }: any) => (
  <div className="flex items-center gap-2">
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className={cn(
        "p-1.5 rounded border transition-colors disabled:opacity-30",
        colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
      )}
    >
      <Minus size={10} />
    </button>
    <span className="flex-1 text-center font-mono text-[10px]">{value}</span>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className={cn(
        "p-1.5 rounded border transition-colors disabled:opacity-30",
        colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
      )}
    >
      <Plus size={10} />
    </button>
  </div>
);

export const RangeInput = ({ value, onChange, min, max, step = 1, unit = "%" }: any) => (
  <div className="space-y-1.5">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
    />
    <div className="flex justify-between text-[8px] font-mono text-slate-500">
      <span>{min}{unit}</span>
      <span className="text-blue-500 font-bold">{value}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);
