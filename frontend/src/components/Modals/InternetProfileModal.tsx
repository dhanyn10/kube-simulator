import React, { useMemo } from 'react';
import { Globe, Plus, Trash2, Check, Sparkles, LayoutGrid, ArrowLeft, Eye, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import {
  useInternetProfileModal,
  HOURS_OF_DAY,
  ECOMMERCE_PROFILE
} from '@/activities/modals';
import { useFlowStore } from '@/store/useFlowStore';
import { MiniCurvePreview, InteractiveTrafficChart } from '../UI/ProfileChart';

interface InternetProfileModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly selectedNode: any;
  readonly performUpdate: (updates: any) => void;
}

export const InternetProfileModal: React.FC<InternetProfileModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
  performUpdate
}) => {
  const cardName = selectedNode?.data?.label || 'Internet';

  const currentHourIndex = selectedNode?.data?.currentHourIndex;

  const edges = useFlowStore((state) => state.edges);
  const nodes = useFlowStore((state) => state.nodes);

  const outgoingEdges = edges.filter((e) => String(e.source) === String(selectedNode?.id));
  const isRed = useMemo(() => {
    if (outgoingEdges.length === 0) return true;
    if (outgoingEdges.some((e) => e.data?.validationError)) return true;
    const targets = outgoingEdges.map((e) => nodes.find((n) => String(n.id) === String(e.target)));
    return targets.some((t) => !t || (t.type === 'Pod' || t.type === 'Deployment') && t.data?.status !== 'ready');
  }, [outgoingEdges, nodes]);

  const {
    colorMode,
    profiles,
    activeProfileName,
    activeProfile,
    viewMode,
    setViewMode,
    detailProfile,
    handleApplyProfile,
    handleOpenDetails,
    handleUpdateDetailPoint,
    handleUpdateDetailName,
    handleSaveAndApplyDetailProfile,
    handleSaveCustomProfile,
    handleDeleteProfile,
    newProfileName,
    setNewProfileName,
    customHourlyValues,
    handleStartCustomProfile,
    handleRandomizeCustomValues,
    handleUpdateCustomPoint
  } = useInternetProfileModal(isOpen, selectedNode, performUpdate, onClose);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cardName}
      subtitle="24-Hour Connection Simulation Profile Templates (00:00 - 23:00)"
      icon={Globe}
      iconColorClass="text-blue-500"
      widthClass="w-full max-w-4xl"
      maxHeightClass="max-h-[85vh] h-[75vh]"
    >
      <div className="space-y-5">
        {viewMode === 'grid' && (
          <>
            {/* Gallery Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Select Connection Simulation Profile
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {profiles.length} Available Profile{profiles.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* MS Word-style Template Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((p) => {
                const isApplied = p.name === activeProfileName;
                const values = HOURS_OF_DAY.map((h) => p.hourly?.[h] ?? 0);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);

                return (
                  <div
                    key={p.name}
                    className={cn(
                      "relative p-3.5 rounded-xl border transition-all flex flex-col justify-between select-none outline-none",
                      isApplied
                        ? (colorMode === 'dark' ? "bg-slate-900 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500" : "bg-blue-50/70 border-blue-500 shadow-md ring-1 ring-blue-500")
                        : (colorMode === 'dark' ? "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50")
                    )}
                  >
                    {/* Top Right Checkmark Badge (Only icon, no text label) */}
                    {isApplied && (
                      <div
                        data-testid={`applied-badge-${p.name.replaceAll(/\s+/g, '-')}`}
                        className="absolute top-2.5 right-2.5 z-10 p-1 rounded-full bg-blue-600 text-white shadow-md animate-in fade-in zoom-in duration-200"
                        title="Applied Profile"
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}

                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between mb-1.5 pr-10">
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider",
                          p.name === ECOMMERCE_PROFILE.name
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        )}>
                          {p.name === ECOMMERCE_PROFILE.name ? 'Default' : 'Custom'}
                        </span>

                        {p.name !== ECOMMERCE_PROFILE.name && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(p.name);
                            }}
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {/* Template Title */}
                      <h4 className="text-xs font-bold text-slate-200 dark:text-slate-100 line-clamp-1 mb-1">
                        {p.name}
                      </h4>

                      {/* Curve Preview */}
                      <MiniCurvePreview profile={p} isApplied={isApplied} currentHourIndex={currentHourIndex} isRed={isRed} />
                    </div>

                    {/* Metrics Summary */}
                    <div className="pt-2 my-1 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono font-semibold text-slate-400">
                      <span>Min: <strong className="text-slate-200">{minVal >= 1000 ? `${(minVal / 1000).toFixed(1)}k` : minVal}</strong></span>
                      <span className="text-blue-400">Max: <strong className="text-blue-400">{maxVal >= 1000 ? `${(maxVal / 1000).toFixed(1)}k` : maxVal}</strong></span>
                    </div>

                    {/* Action Buttons: Apply & Details (Both typical outline buttons) */}
                    <div className="pt-2 flex items-center gap-2 border-t border-slate-800/40">
                      <button
                        type="button"
                        onClick={() => handleApplyProfile(p.name)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all border shadow-sm",
                          isApplied
                            ? "border-blue-500 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                            : (colorMode === 'dark'
                              ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700")
                        )}
                      >
                        <Check size={13} />
                        <span>Apply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDetails(p.name)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all border shadow-sm",
                          colorMode === 'dark'
                            ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                            : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        )}
                      >
                        <Eye size={13} />
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add Custom Profile Template Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleStartCustomProfile}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleStartCustomProfile();
                  }
                }}
                className={cn(
                  "p-4 rounded-xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 select-none min-h-[160px] outline-none focus:ring-2 focus:ring-blue-500/50",
                  colorMode === 'dark' ? "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                )}
              >
                <div className="p-2.5 rounded-full bg-blue-600/20 text-blue-400">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold">Add Custom Profile</span>
                <span className="text-[10px] text-slate-500">Create new randomized weekly connection schedule</span>
              </div>
            </div>
          </>
        )}

        {/* Detailed Full Profile View */}
        {viewMode === 'details' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Back to Profiles Gallery</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAndApplyDetailProfile}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-sm transition-all",
                    detailProfile.name === activeProfileName
                      ? "border-blue-500 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      : "bg-blue-600 hover:bg-blue-500 text-white border-transparent"
                  )}
                >
                  <Check size={14} />
                  <span>{detailProfile.name === activeProfileName ? 'Applied' : 'Save & Apply Profile'}</span>
                </button>
              </div>
            </div>

            <InteractiveTrafficChart
              profile={detailProfile}
              colorMode={colorMode}
              isApplied={detailProfile.name === activeProfileName}
              currentHourIndex={currentHourIndex}
              isRed={isRed}
              onUpdatePoint={handleUpdateDetailPoint}
              onUpdateName={handleUpdateDetailName}
            />
          </div>
        )}

        {/* Custom Graphical Profile Creation Screen */}
        {viewMode === 'custom' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Cancel Custom Creation</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRandomizeCustomValues}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-blue-400 transition-all shadow-sm"
                  title="Randomize daily traffic values"
                >
                  <Shuffle size={14} />
                  <span>Randomize Graph</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCustomProfile}
                  disabled={!newProfileName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 transition-all"
                >
                  <Sparkles size={14} />
                  <span>Save & Apply Custom Profile</span>
                </button>
              </div>
            </div>

            {/* Graphical Chart for Custom Profile */}
            <InteractiveTrafficChart
              profile={{
                name: newProfileName,
                hourly: customHourlyValues
              }}
              colorMode={colorMode}
              isApplied={false}
              currentHourIndex={currentHourIndex}
              isRed={isRed}
              onUpdatePoint={handleUpdateCustomPoint}
              onUpdateName={setNewProfileName}
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
          <p className="text-[11px] text-slate-400 font-medium">
            Active Connection Profile: <span className="text-blue-400 font-bold">{activeProfile ? activeProfile.name : 'None'}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow",
              colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
            )}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
