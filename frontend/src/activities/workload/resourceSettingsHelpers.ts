import { CPU_OPTIONS, MEMORY_OPTIONS } from '@/constants/config';

export interface ResourceSettingItem {
  type?: string;
  field: string;
  label?: string;
  options?: readonly string[];
  iconColor?: string;
  activeColor?: string;
  shadow?: string;
  hasError?: boolean;
}

export const getResourceSettingItems = (): ResourceSettingItem[] => [
  {
    field: 'cpuLimit',
    label: 'CPU Limit',
    options: CPU_OPTIONS,
    iconColor: 'text-violet-500',
    activeColor: 'bg-violet-600 border-violet-600',
  },
  {
    field: 'cpuRequest',
    label: 'CPU Request',
    options: CPU_OPTIONS,
    iconColor: 'text-emerald-500',
    activeColor: 'bg-emerald-600 border-emerald-600',
    shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  },
  { type: 'separator', field: 'separator-cpu-mem' },
  {
    field: 'memoryLimit',
    label: 'Memory Limit',
    options: MEMORY_OPTIONS,
    iconColor: 'text-violet-500',
    activeColor: 'bg-violet-600 border-violet-600',
  },
  {
    field: 'memoryRequest',
    label: 'Memory Request',
    options: MEMORY_OPTIONS,
    iconColor: 'text-emerald-500',
    activeColor: 'bg-emerald-600 border-emerald-600',
    shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  },
];
