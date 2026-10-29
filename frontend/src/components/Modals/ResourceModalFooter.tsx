import React from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ResourceModalMode = 'form' | 'list' | 'profile';

export interface ResourceModalFooterProps {
  readonly mode: ResourceModalMode;
  readonly isDark: boolean;
  readonly onAddNewFromList: () => void;
  readonly onClose: () => void;
  readonly onBackToMode: () => void;
  readonly onSave: () => void;
  readonly addNewButtonLabel: string;
  readonly saveButtonLabel: string;
  readonly accentColor?: 'rose' | 'teal';
  readonly backButtonTestId?: string;
  readonly closeButtonTestId?: string;
  readonly profileBackButtonTestId?: string;
}

const ListModeFooter: React.FC<{
  readonly onAddNewFromList: () => void;
  readonly onClose: () => void;
  readonly addNewButtonLabel: string;
  readonly isDark: boolean;
  readonly accentColor: 'rose' | 'teal';
  readonly closeButtonTestId?: string;
}> = ({
  onAddNewFromList,
  onClose,
  addNewButtonLabel,
  isDark,
  accentColor,
  closeButtonTestId,
}) => (
  <div className="flex items-center justify-between w-full">
    <button
      type="button"
      onClick={onAddNewFromList}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer",
        accentColor === 'rose'
          ? "bg-rose-600 hover:bg-rose-500"
          : "bg-teal-600 hover:bg-teal-500"
      )}
    >
      <Plus size={14} />
      <span>{addNewButtonLabel}</span>
    </button>
    <button
      type="button"
      data-testid={closeButtonTestId}
      onClick={onClose}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
        isDark
          ? "border-slate-700 hover:bg-slate-800 text-slate-300"
          : "border-slate-300 hover:bg-slate-100 text-slate-700"
      )}
    >
      Close
    </button>
  </div>
);

const ProfileModeFooter: React.FC<{
  readonly onBackToMode: () => void;
  readonly onAddNewFromList: () => void;
  readonly onClose: () => void;
  readonly addNewButtonLabel: string;
  readonly isDark: boolean;
  readonly accentColor: 'rose' | 'teal';
  readonly profileBackButtonTestId?: string;
}> = ({
  onBackToMode,
  onAddNewFromList,
  onClose,
  addNewButtonLabel,
  isDark,
  accentColor,
  profileBackButtonTestId = 'configmap-footer-back-button',
}) => (
  <div className="flex items-center justify-between w-full">
    <button
      type="button"
      data-testid={profileBackButtonTestId}
      onClick={onBackToMode}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
        accentColor === 'rose'
          ? isDark ? "border-slate-700 hover:bg-slate-800 text-rose-400" : "border-slate-300 hover:bg-slate-100 text-rose-600"
          : isDark ? "border-slate-700 hover:bg-slate-800 text-teal-400" : "border-slate-300 hover:bg-slate-100 text-teal-600"
      )}
    >
      <ArrowLeft size={13} />
      <span>Back to List</span>
    </button>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onAddNewFromList}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer",
          accentColor === 'rose'
            ? "bg-rose-600 hover:bg-rose-500"
            : "bg-teal-600 hover:bg-teal-500"
        )}
      >
        <Plus size={14} />
        <span>{addNewButtonLabel}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          isDark
            ? "border-slate-700 hover:bg-slate-800 text-slate-300"
            : "border-slate-300 hover:bg-slate-100 text-slate-700"
        )}
      >
        Close
      </button>
    </div>
  </div>
);

const FormModeFooter: React.FC<{
  readonly onBackToMode: () => void;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly saveButtonLabel: string;
  readonly isDark: boolean;
  readonly accentColor: 'rose' | 'teal';
  readonly backButtonTestId?: string;
  readonly closeButtonTestId?: string;
}> = ({
  onBackToMode,
  onClose,
  onSave,
  saveButtonLabel,
  isDark,
  accentColor,
  backButtonTestId,
  closeButtonTestId,
}) => (
  <div className="flex items-center justify-between w-full">
    <button
      type="button"
      data-testid={backButtonTestId}
      onClick={onBackToMode}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
        accentColor === 'rose'
          ? isDark ? "border-slate-700 hover:bg-slate-800 text-indigo-400" : "border-slate-300 hover:bg-slate-100 text-indigo-600"
          : isDark ? "border-slate-700 hover:bg-slate-800 text-teal-400" : "border-slate-300 hover:bg-slate-100 text-teal-600"
      )}
    >
      <ArrowLeft size={13} />
      <span>Back</span>
    </button>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid={closeButtonTestId}
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          isDark
            ? "border-slate-700 hover:bg-slate-800 text-slate-300"
            : "border-slate-300 hover:bg-slate-100 text-slate-700"
        )}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        className={cn(
          "px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-md transition-all cursor-pointer",
          accentColor === 'rose'
            ? "bg-rose-600 hover:bg-rose-500"
            : "bg-teal-600 hover:bg-teal-500"
        )}
      >
        {saveButtonLabel}
      </button>
    </div>
  </div>
);

export const ResourceModalFooter: React.FC<ResourceModalFooterProps> = ({
  mode,
  isDark,
  onAddNewFromList,
  onClose,
  onBackToMode,
  onSave,
  addNewButtonLabel,
  saveButtonLabel,
  accentColor = 'teal',
  backButtonTestId,
  closeButtonTestId,
  profileBackButtonTestId,
}) => {
  if (mode === 'list') {
    return (
      <ListModeFooter
        onAddNewFromList={onAddNewFromList}
        onClose={onClose}
        addNewButtonLabel={addNewButtonLabel}
        isDark={isDark}
        accentColor={accentColor}
        closeButtonTestId={closeButtonTestId}
      />
    );
  }

  if (mode === 'profile') {
    return (
      <ProfileModeFooter
        onBackToMode={onBackToMode}
        onAddNewFromList={onAddNewFromList}
        onClose={onClose}
        addNewButtonLabel={addNewButtonLabel}
        isDark={isDark}
        accentColor={accentColor}
        profileBackButtonTestId={profileBackButtonTestId}
      />
    );
  }

  return (
    <FormModeFooter
      onBackToMode={onBackToMode}
      onClose={onClose}
      onSave={onSave}
      saveButtonLabel={saveButtonLabel}
      isDark={isDark}
      accentColor={accentColor}
      backButtonTestId={backButtonTestId}
      closeButtonTestId={closeButtonTestId}
    />
  );
};
