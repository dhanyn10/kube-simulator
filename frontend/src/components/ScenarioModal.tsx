import React, { useState } from 'react';
import { X, BookOpen, GraduationCap, Zap, AlertCircle } from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { scenarios, Scenario } from '../scenarios';
import { hydrateNodes } from '../store/nodeHelpers';

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioModal = ({ isOpen, onClose }: ScenarioModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  const handleSelectScenario = (scenario: Scenario) => {
    if (nodes.length > 0) {
      setSelectedScenario(scenario);
      setShowConfirm(true);
    } else {
      applyScenario(scenario);
    }
  };

  const applyScenario = (scenario: Scenario) => {
    const { nodes: scenarioNodes, edges: scenarioEdges } = scenario.data;

    const nodesWithStrings = (scenarioNodes || []).map((n: any) => ({
      ...n,
      id: String(n.id),
      parentId: n.parentId ? String(n.parentId) : undefined
    })) as any[];

    const edgesWithStrings = (scenarioEdges || []).map((e: any) => ({
      ...e,
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      type: 'custom'
    }));

    const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());

    useFlowStore.setState({
      nodes: hydratedNodes,
      edges: edgesWithStrings,
      currentProject: { id: -1, name: `Scenario: ${scenario.name}` },
      lastSavedSnapshot: JSON.stringify({ nodes: hydratedNodes, edges: edgesWithStrings }),
      isSimulating: false,
      activeSimulationEdges: [],
      simulationMetrics: {}
    });

    onClose();
    setShowConfirm(false);
    setSelectedScenario(null);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'Basic': return <BookOpen size={16} className="text-emerald-500" />;
      case 'Intermediate': return <Zap size={16} className="text-amber-500" />;
      case 'Advanced': return <GraduationCap size={16} className="text-rose-500" />;
      default: return null;
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'Basic': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Intermediate': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Advanced': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-[600px] max-h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <BookOpen className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Learning Scenarios</h2>
              <p className="text-xs text-slate-500 font-medium">Select a case study to learn infrastructure patterns</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {!showConfirm ? (
            <div className="grid gap-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => handleSelectScenario(scenario)}
                  className={cn(
                    "flex flex-col p-4 rounded-xl border transition-all text-left group relative",
                    colorMode === 'dark'
                      ? "bg-slate-800/40 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/60"
                      : "bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-white"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getLevelIcon(scenario.level)}
                      <span className="font-bold text-sm uppercase tracking-tight">{scenario.name}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest",
                      getLevelBg(scenario.level)
                    )}>
                      {scenario.level}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs leading-relaxed",
                    colorMode === 'dark' ? "text-slate-400" : "text-slate-600"
                  )}>
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="p-4 bg-amber-500/10 rounded-full">
                <AlertCircle size={48} className="text-amber-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold">Overwrite Current Canvas?</h3>
                <p className={cn(
                  "text-sm max-w-[300px]",
                  colorMode === 'dark' ? "text-slate-400" : "text-slate-600"
                )}>
                  Loading a scenario will replace all components currently on your canvas. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 w-full max-w-[320px]">
                <button
                  onClick={() => setShowConfirm(false)}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border",
                    colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedScenario && applyScenario(selectedScenario)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/20"
                >
                  Confirm & Load
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-slate-500/5">
          <p className="text-[10px] text-center text-slate-500 font-medium">
            Scenarios are templates designed to show best practices in Kubernetes architecture.
          </p>
        </div>
      </div>
    </div>
  );
};
