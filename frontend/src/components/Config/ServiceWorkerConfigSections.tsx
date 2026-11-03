import React from 'react';
import { Network, Server, Info } from 'lucide-react';
import { ConfigSection } from '@/components/UI/ConfigUI';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { WORKER_NODE_OPTIONS } from '@/lib/workerNodeHelpers';

interface ExternalTrafficPolicySectionProps {
  data: any;
  colorMode: string;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

const TRAFFIC_POLICY_OPTIONS = [
  { id: 'Cluster', label: 'Cluster', desc: 'Routes traffic to all pods across nodes. Extra hop may occur with SNAT.' },
  { id: 'Local', label: 'Local', desc: 'Preserves Client IP. Routes only to node-local pods (no extra hop).' },
] as const;

export const ExternalTrafficPolicySection: React.FC<ExternalTrafficPolicySectionProps> = ({
  data,
  colorMode,
  performUpdate,
  toggleVisibility,
  toggleYaml,
}) => {
  const currentPolicy = data.externalTrafficPolicy || 'Cluster';

  return (
    <ConfigSection
      title="externalTrafficPolicy"
      icon={Network}
      isVisible={data.displaySettings?.externalTrafficPolicy}
      onToggle={() => toggleVisibility('externalTrafficPolicy')}
      isYamlEnabled={data.yamlSettings?.externalTrafficPolicy}
      onYamlToggle={() => toggleYaml('externalTrafficPolicy')}
      disableYamlToggle={Boolean(data.externalTrafficPolicy) === false}
    >
      <div className="space-y-2">
        <SelectorGroup
          options={TRAFFIC_POLICY_OPTIONS}
          currentValue={currentPolicy}
          onSelect={(val) => performUpdate({ externalTrafficPolicy: val })}
          colorMode={colorMode}
        />

        <div className="p-2 rounded border border-blue-500/20 bg-blue-500/5 text-[9px] text-blue-300 space-y-1">
          <div className="flex items-center gap-1 font-bold">
            <Info size={11} className="text-blue-400 shrink-0" />
            <span>{currentPolicy === 'Cluster' ? 'Cluster Policy Behavior' : 'Local Policy Behavior'}</span>
          </div>
          <p className="leading-tight text-slate-300/80">
            {currentPolicy === 'Cluster'
              ? 'kube-proxy may forward packets to target pods on other worker nodes (SNAT applied, client IP is replaced by the node IP).'
              : 'Preserves client IP without SNAT. If incoming traffic arrives at a worker node without local pod endpoints, packets are dropped.'}
          </p>
        </div>
      </div>
    </ConfigSection>
  );
};

interface EntryNodeSectionProps {
  data: any;
  colorMode: string;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const EntryNodeSection: React.FC<EntryNodeSectionProps> = ({
  data,
  colorMode,
  performUpdate,
  toggleVisibility,
}) => {
  const currentEntry = (data.entryNode || 'worker-1');

  return (
    <ConfigSection
      title="Simulated Entry Node"
      icon={Server}
      isVisible={data.displaySettings?.entryNode}
      onToggle={() => toggleVisibility('entryNode')}
    >
      <div className="space-y-1.5">
        <SelectorGroup
          options={WORKER_NODE_OPTIONS}
          currentValue={currentEntry}
          onSelect={(val) => performUpdate({ entryNode: val })}
          colorMode={colorMode}
        />
        <p className="text-[9px] text-slate-400 leading-tight">
          Simulates which worker node receives incoming external NodePort traffic.
        </p>
      </div>
    </ConfigSection>
  );
};
