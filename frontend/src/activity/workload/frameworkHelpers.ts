import { RUNTIMES } from '../../constants/config';

export const getFrameworksForRuntime = (runtime: string): readonly string[] | null => {
  if (!runtime || runtime === 'none') return null;
  const frameworks = RUNTIMES[runtime as keyof typeof RUNTIMES]?.frameworks;
  if (!frameworks) return null;
  return frameworks;
};

export const getFrameworkButtonClass = (isActive: boolean, colorMode: string): string => {
  if (isActive) {
    return 'bg-emerald-600 border-emerald-600 text-white';
  }
  if (colorMode === 'dark') {
    return 'bg-slate-950 border-slate-800 hover:border-slate-700';
  }
  return 'bg-white border-slate-200 hover:border-slate-300';
};
