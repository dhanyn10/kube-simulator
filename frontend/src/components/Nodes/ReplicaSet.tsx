import { memo } from 'react';
import { NodeProps, NodeResizer, Node } from '@xyflow/react';
import { Shield, Settings, Lock, Activity } from 'lucide-react';
import { K8sNodeData } from '@/types';
import { useReplicaSetNodeHandler } from '@/activities/nodes';

export const ReplicaSetNode = memo(({ selected, data }: NodeProps<Node<K8sNodeData>>) => {
  const { containerClass, badgeClass } = useReplicaSetNodeHandler(selected);

  return (
    <div className={containerClass}>
      <NodeResizer
        minWidth={180}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-emerald-500/40"
        handleClassName="w-2 h-2 bg-white border-2 border-emerald-500 rounded"
      />

      <div className="absolute -top-6 left-2 flex items-center gap-2">
        <span className={badgeClass}>
          ReplicaSet: {data.label}
        </span>
        {data.replicas > 1 && (
          <span className="text-[10px] font-bold text-emerald-500">
            x{data.replicas}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {((data.roles && data.roles.length > 0) || (data.configMaps && data.configMaps.length > 0) || (data.secrets && data.secrets.length > 0) || (data.hpas && data.hpas.length > 0)) && (
        <div className="node-attached-footer">
          {data.roles?.map((role: any) => {
            const usersText = role.assignedUsers && role.assignedUsers.length > 0
              ? ` (Users: ${role.assignedUsers.join(', ')})`
              : '';
            return (
              <span
                key={role.id || role.name}
                className="node-attached-badge-role"
                title={`Role: ${role.name}${usersText}`}
              >
                <Shield size={11} />
              </span>
            );
          })}
          {data.configMaps?.map((cm: any) => (
            <span
              key={cm.id || cm.name}
              className="node-attached-badge-configmap"
              title={`ConfigMap: ${cm.name}`}
            >
              <Settings size={11} />
            </span>
          ))}
          {data.secrets?.map((sec: any) => (
            <span
              key={sec.id || sec.name}
              className="node-attached-badge-secret"
              title={`Secret: ${sec.name}`}
            >
              <Lock size={11} />
            </span>
          ))}
          {data.hpas?.map((hpa: any) => (
            <span
              key={hpa.id || hpa.name}
              className="node-attached-badge-hpa"
              title={`HPA: ${hpa.name}`}
            >
              <Activity size={11} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
