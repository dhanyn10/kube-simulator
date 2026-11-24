import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '@/store/useFlowStore';

describe('Kube IAM & Store Integration Tests', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      iamUsers: [],
    });
  });

  it('adds an IAM user and stores it in iamUsers state', () => {
    const store = useFlowStore.getState();

    store.addIamUser({
      name: 'dev-user',
      role: 'viewer',
      namespaces: ['default'],
    } as Parameters<typeof store.addIamUser>[0]);

    const { iamUsers } = useFlowStore.getState();
    expect(iamUsers).toHaveLength(1);
    expect(iamUsers[0].name).toBe('dev-user');
    expect(iamUsers[0].id).toBeTruthy();
  });
});
