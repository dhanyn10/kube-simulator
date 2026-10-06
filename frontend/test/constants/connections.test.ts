import { describe, it, expect } from 'vitest';
import { getConnectionError } from '@/constants/connections';

describe('connections constants', () => {
  it('should return null for valid connections', () => {
    expect(getConnectionError('Internet', 'Ingress')).toBeNull();
    expect(getConnectionError('Internet', 'Service')).toBeNull();
    expect(getConnectionError('Service', 'Pod')).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Deployment', 'PVC')).toBeNull();
    expect(getConnectionError('Pod', 'Service')).toBeNull();
  });

  it('should return error message for invalid connections', () => {
    const error = getConnectionError('Internet', 'Namespace');
    expect(error).toBe('Internet cannot be connected to Namespace.');
  });

  it('should return error when connecting Internet directly to Pod, Deployment, or ReplicaSet', () => {
    expect(getConnectionError('Internet', 'Pod')).toBe('Internet cannot be connected to Pod.');
    expect(getConnectionError('Internet', 'Deployment')).toBe('Internet cannot be connected to Deployment.');
    expect(getConnectionError('Internet', 'ReplicaSet')).toBe('Internet cannot be connected to ReplicaSet.');
  });

  it('should return error when connecting Pod, Deployment, or ReplicaSet directly to another Pod or Deployment', () => {
    expect(getConnectionError('Pod', 'Pod')).toBe('Pod cannot be connected to Pod.');
    expect(getConnectionError('Pod', 'Deployment')).toBe('Pod cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Deployment')).toBe('Deployment cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Pod')).toBe('Deployment cannot be connected to Pod.');
  });

  it('should return null for valid LoadBalancer incoming and outgoing connections', () => {
    // Internet -> Service: LoadBalancer
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Service: ClusterIP / NodePort
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'ClusterIP' })
    ).toBeNull();
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'NodePort' })
    ).toBeNull();
  });

  it('should return error for invalid incoming connections to LoadBalancer Service', () => {
    // Pod / Deployment / Ingress / Service -> Service: LoadBalancer is forbidden
    expect(getConnectionError('Pod', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'Pod cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.'
    );
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'Ingress cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.'
    );
    expect(
      getConnectionError(
        'Service',
        'Service',
        { serviceType: 'ClusterIP' },
        { serviceType: 'LoadBalancer' }
      )
    ).toBe('Service cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.');
  });

  it('should return error when connecting LoadBalancer Service directly to Pod, Deployment, ReplicaSet, Storage/Config, or another LoadBalancer', () => {
    expect(getConnectionError('Service', 'Pod', { serviceType: 'LoadBalancer' })).toBe(
      'Service type "LoadBalancer" is not allowed to connect to Pod.'
    );
    expect(getConnectionError('Service', 'Deployment', { serviceType: 'LoadBalancer' })).toBe(
      'Service type "LoadBalancer" is not allowed to connect to Deployment.'
    );
    expect(getConnectionError('Service', 'ReplicaSet', { serviceType: 'LoadBalancer' })).toBe(
      'Service type "LoadBalancer" is not allowed to connect to ReplicaSet.'
    );
    expect(getConnectionError('Service', 'PVC', { serviceType: 'LoadBalancer' })).toBe(
      'Service cannot be connected to PVC.'
    );
    expect(getConnectionError('Service', 'ConfigMap', { serviceType: 'LoadBalancer' })).toBe(
      'Service cannot be connected to ConfigMap.'
    );
    expect(getConnectionError('Service', 'Secret', { serviceType: 'LoadBalancer' })).toBe(
      'Service cannot be connected to Secret.'
    );
    expect(
      getConnectionError(
        'Service',
        'Service',
        { serviceType: 'LoadBalancer' },
        { serviceType: 'LoadBalancer' }
      )
    ).toBe('Service cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.');
  });

  it('should return error for unrecognized source type', () => {
    const error = getConnectionError('Unknown', 'Pod');
    expect(error).toBe('Source type Unknown is not recognized.');
  });
});
