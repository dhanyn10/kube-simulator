import { Shield, Settings, Lock, Activity } from 'lucide-react';
import { K8sNodeData } from '@/types';

/**
 * Reusable Card Footer component for rendering attached resources
 * (Roles, ConfigMaps, Secrets, HPAs) on canvas nodes.
 */
export const AttachedResourcesFooter = ({ data }: { readonly data: K8sNodeData }) => {
  const hasAttached = Boolean(
    (data.roles && data.roles.length > 0) ||
    (data.configMaps && data.configMaps.length > 0) ||
    (data.secrets && data.secrets.length > 0) ||
    (data.hpas && data.hpas.length > 0)
  );

  if (!hasAttached) return null;

  return (
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
      {data.hpas?.map((hpa: any) => {
        const details = (hpa.minReplicas !== undefined && hpa.maxReplicas !== undefined && hpa.targetCPU !== undefined)
          ? ` (Min: ${hpa.minReplicas}, Max: ${hpa.maxReplicas}, CPU: ${hpa.targetCPU}%)`
          : '';
        return (
          <span
            key={hpa.id || hpa.name}
            className="node-attached-badge-hpa"
            title={`HPA: ${hpa.name}${details}`}
          >
            <Activity size={11} />
          </span>
        );
      })}
    </div>
  );
};
