import { Globe, Box, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface DockerImageCardProps {
  img: { name: string; desc: string };
  colorMode: 'dark' | 'light';
  onClick: () => void;
}

export const DockerImageCard = ({ img, colorMode, onClick }: DockerImageCardProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border flex flex-col justify-between transition-all text-left hover:shadow-md min-w-0 outline-none focus:ring-1 focus:ring-blue-500/30",
        colorMode === 'dark' ? "bg-slate-950/20 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="min-w-0 w-full">
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0 w-full">
          <Globe size={11} className="shrink-0 text-blue-500" />
          <span className="font-semibold text-xs font-mono truncate" title={img.name}>{img.name}</span>
        </div>
        <p className="text-[9px] text-slate-500 leading-tight line-clamp-2">{img.desc}</p>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-800/20 pt-1.5 shrink-0 w-full">
        <span className="text-[8px] bg-blue-500/10 text-blue-500 px-1 py-0.2 rounded font-bold uppercase tracking-wider shrink-0">PUBLIC REGISTRY</span>
        <span className="text-[8px] text-blue-500 font-bold shrink-0 uppercase tracking-wider hover:text-blue-600 transition-colors">
          VIEW TAGS &rarr;
        </span>
      </div>
    </button>
  );
};

export const parseDockerResults = (rawData: string, isSearch: boolean): { name: string; desc: string }[] => {
  const data = JSON.parse(rawData);
  return (data.results || []).map((r: any) => ({
    name: isSearch ? r.repo_name : r.name,
    desc: (isSearch ? r.short_description : r.description) || ''
  }));
};

export interface LocalImageRowProps {
  img: string;
  onDelete: (img: string) => void;
  colorMode: 'dark' | 'light';
}

export const LocalImageRow = ({ img, onDelete, colorMode }: LocalImageRowProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-2.5 px-3.5 rounded-lg border transition-all duration-150 min-w-0 gap-3",
        colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Box size={12} className="text-emerald-500 shrink-0" />
        <span className="font-semibold text-xs font-mono truncate flex-1" title={img}>{img}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded font-bold uppercase tracking-wider shrink-0">LOCAL CACHE</span>
        <button
          type="button"
          onClick={() => onDelete(img)}
          className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors shrink-0"
          title="Remove from image registry"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
