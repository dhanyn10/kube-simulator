
import { cn } from '../../lib/utils';
import { MATERIAL_COLORS } from '../../lib/colors';

interface ColorPaletteProps {
  selectedColor: string;
  onSelect: (color: string) => void;
  className?: string;
}

/**
 * Reusable Color Palette component using Material Design 500 colors.
 * Displays a grid of color buttons for selection.
 */
export const ColorPalette = ({ selectedColor, onSelect, className }: ColorPaletteProps) => {
  return (
    <div className={cn("grid grid-cols-7 gap-1.5", className)}>
      {MATERIAL_COLORS.map((c) => (
        <button
          type="button"
          key={c.hex}
          onClick={() => onSelect(c.hex)}
          className={cn(
            "w-5 h-5 rounded-md border shadow-sm transition-all hover:scale-110 active:scale-95",
            selectedColor.toLowerCase() === c.hex.toLowerCase()
              ? "border-slate-600 dark:border-white scale-110 z-10 ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500"
              : "border-transparent"
          )}
          style={{ backgroundColor: c.hex }}
          title={c.name}
        />
      ))}
    </div>
  );
};
