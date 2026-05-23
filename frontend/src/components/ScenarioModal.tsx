import  { useState } from 'react';
import { BookOpen, GraduationCap, Zap, AlertCircle } from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { scenarios, Scenario } from '../scenarios';
import { hydrateNodes } from '../store/nodeHelpers';
import { Modal } from './Modal';
import { useFitView } from '../hooks/useFitView';

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioModal = ({ isOpen, onClose }: ScenarioModalProps) => {
  const fitView = useFitView();
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

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
      simulationMetrics: {},
      lastActionId: `scenario-${Date.now()}`,
      lastActionName: 'Load Scenario'
    });

    onClose();
    setShowConfirm(false);
    setSelectedScenario(null);

    // Give React Flow a moment to render and measure the new nodes
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 800 });
    }, 150);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Learning Scenarios"
      subtitle="Select a case study to learn infrastructure patterns"
      icon={BookOpen}
      footer={
        <p className="text-[10px] text-center text-slate-500 font-medium">
          Scenarios are templates designed to show best practices in Kubernetes architecture.
        </p>
      }
    >
      <div className="space-y-4">
        {showConfirm ? (
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
        ) : (
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
        )}
      </div>
    </Modal>
  );
};
