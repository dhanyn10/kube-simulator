import { describe, it, expect } from 'vitest';
import {
  getAutocompleteSuggestions,
  trimSuggestionLabel,
  COMMAND_SPEC_TREE,
  ADMIN_SPEC_TREE,
  getPodNames,
  getDeploymentNames,
  getRoleNames,
  getRoleBindingNames,
  getConfigMapNames,
  getSecretNames,
  ADMIN_SUGGESTIONS,
  KUBECTL_TOP_COMMANDS,
  CONFIG_SUBCOMMANDS,
  GET_SUBCOMMANDS,
  UTILITY_COMMANDS,
} from '@/activities/terminal/terminalAutocomplete';
import { Node } from '@xyflow/react';

describe('terminalAutocomplete', () => {
  it('exports spec trees and top-level command constants', () => {
    expect(COMMAND_SPEC_TREE).toBeDefined();
    expect(ADMIN_SPEC_TREE).toBeDefined();
    expect(ADMIN_SUGGESTIONS).toBeDefined();
    expect(KUBECTL_TOP_COMMANDS).toBeDefined();
    expect(CONFIG_SUBCOMMANDS).toBeDefined();
    expect(GET_SUBCOMMANDS).toBeDefined();
    expect(UTILITY_COMMANDS).toBeDefined();

    const kubectlNode = COMMAND_SPEC_TREE.find(n => n.name === 'kubectl');
    expect(kubectlNode).toBeDefined();
    expect(kubectlNode?.children?.some(c => c.name === 'get')).toBe(true);
    expect(kubectlNode?.children?.some(c => c.name === 'config')).toBe(true);
  });

  it('returns empty array when input is empty or awaiting admin password', () => {
    expect(getAutocompleteSuggestions('', [])).toEqual([]);
    expect(getAutocompleteSuggestions('   ', [])).toEqual([]);
    expect(getAutocompleteSuggestions('kubectl', [], false, true)).toEqual([]);
  });

  it('handles admin authenticated mode suggestions', () => {
    const suggs = getAutocompleteSuggestions('try', [], true);
    expect(suggs.some(s => s.value === 'try status')).toBe(true);
    expect(suggs.some(s => s.value === 'try clear')).toBe(true);

    const logoutSugg = getAutocompleteSuggestions('logout', [], true);
    expect(logoutSugg.some(s => s.value === 'logout')).toBe(true);
  });

  it('extracts stacked pod names with replicaSuffixes array and handles resource getters', () => {
    const mockNodes: Node[] = [
      {
        id: 'pod-stacked',
        type: 'Pod',
        data: {
          baseName: 'api-pod',
          podHash: 'x8k2p',
          replicaSuffixes: ['aaaaa', 'bbbbb'],
        },
        position: { x: 0, y: 0 },
      },
      {
        id: 'pod-single',
        type: 'Pod',
        data: { label: 'single-pod' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'dep-1',
        type: 'Deployment',
        data: {
          label: 'web-dep',
          roles: [{ name: 'web-role' }],
          configMaps: [{ name: 'web-cm' }],
          secrets: [{ name: 'web-secret' }],
        },
        position: { x: 0, y: 0 },
      },
    ];

    const pods = getPodNames(mockNodes);
    expect(pods).toContain('api-pod-x8k2p-aaaaa');
    expect(pods).toContain('api-pod-x8k2p-bbbbb');
    expect(pods).toContain('single-pod');

    expect(getDeploymentNames(mockNodes)).toEqual(['web-dep']);
    expect(getRoleNames(mockNodes)).toEqual(['web-role']);
    expect(getRoleBindingNames(mockNodes)).toEqual(['web-role-binding']);
    expect(getConfigMapNames(mockNodes)).toEqual(['web-cm']);
    expect(getSecretNames(mockNodes)).toEqual(['web-secret']);
  });

  it('returns full command hints when typing initial keyword prefix "k" or "ku"', () => {
    const kSugg = getAutocompleteSuggestions('k', []);
    expect(kSugg.some(s => s.label === 'kubectl get')).toBe(true);
    expect(kSugg.some(s => s.label === 'kubectl config')).toBe(true);

    const kuSugg = getAutocompleteSuggestions('ku', []);
    expect(kuSugg.some(s => s.label === 'kubectl get')).toBe(true);
    expect(kuSugg.some(s => s.label === 'kubectl config')).toBe(true);
  });

  it('returns general top subcommands when typing "kubectl"', () => {
    const suggestions = getAutocompleteSuggestions('kubectl', []);
    expect(suggestions.length).toBeGreaterThanOrEqual(8);
    expect(suggestions.some(s => s.value === 'kubectl get')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl config')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl logs')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl describe')).toBe(true);
  });

  it('disables commands requiring resources when canvas is empty', () => {
    const scaleSugg = getAutocompleteSuggestions('kubectl scale', []);
    expect(scaleSugg[0].disabled).toBe(true);
    expect(scaleSugg[0].disabledReason).toContain('no Deployment on canvas');

    const setSugg = getAutocompleteSuggestions('kubectl set', []);
    expect(setSugg[0].disabled).toBe(true);

    const rolloutSugg = getAutocompleteSuggestions('kubectl rollout', []);
    expect(rolloutSugg[0].disabled).toBe(true);

    const logsSugg = getAutocompleteSuggestions('kubectl logs', []);
    expect(logsSugg[0].disabled).toBe(true);

    const descSugg = getAutocompleteSuggestions('kubectl describe', []);
    expect(descSugg.some(s => s.disabled)).toBe(true);
  });

  it('handles scale command sequence with deployment and replica count matching', () => {
    const mockNodes: Node[] = [
      { id: 'dep-web', type: 'Deployment', data: { label: 'web-deployment' }, position: { x: 0, y: 0 } },
    ];

    const scaleInit = getAutocompleteSuggestions('kubectl scale', mockNodes);
    expect(scaleInit[0].label).toBe('deployment/web-deployment');

    const scaleDepSlash = getAutocompleteSuggestions('kubectl scale deployment/', mockNodes);
    expect(scaleDepSlash[0].label).toBe('web-deployment');

    const scaleDepExact = getAutocompleteSuggestions('kubectl scale deployment/web-deployment', mockNodes);
    expect(scaleDepExact[0].label).toBe('deployment/web-deployment');

    const depSugg = getAutocompleteSuggestions('kubectl scale deployment/web-deployment ', mockNodes);
    expect(depSugg[0].label).toBe('--replicas=');

    const replicaNumSugg = getAutocompleteSuggestions('kubectl scale deployment/web-deployment --replicas=', mockNodes);
    expect(replicaNumSugg.some(s => s.value.endsWith('--replicas=3'))).toBe(true);

    const replicaNumExact = getAutocompleteSuggestions('kubectl scale deployment/web-deployment --replicas=3', mockNodes);
    expect(replicaNumExact.some(s => s.value.endsWith('--replicas=3'))).toBe(true);

    const scaleInvalid = getAutocompleteSuggestions('kubectl scale deployment/web-deployment invalid', mockNodes);
    expect(scaleInvalid).toEqual([]);

    const scaleDepEmpty = getAutocompleteSuggestions('kubectl scale', []);
    expect(scaleDepEmpty[0].disabled).toBe(true);
  });

  it('handles set image command sequence with deployment and container image', () => {
    const mockNodes: Node[] = [
      { id: 'dep-web', type: 'Deployment', data: { label: 'web-app' }, position: { x: 0, y: 0 } },
    ];

    const setSugg = getAutocompleteSuggestions('kubectl set image deployment/', mockNodes);
    expect(setSugg.some(s => s.value.includes('web-app'))).toBe(true);

    const setImageFull = getAutocompleteSuggestions('kubectl set image deployment/web-app ', mockNodes);
    expect(setImageFull[0].label).toBe('app-container=nginx:1.25');

    const setEmpty = getAutocompleteSuggestions('kubectl set image deployment/', []);
    expect(setEmpty[0].disabled).toBe(true);
  });

  it('handles rollout command sequence (status, history, undo)', () => {
    const mockNodes: Node[] = [
      { id: 'dep-web', type: 'Deployment', data: { label: 'web-app' }, position: { x: 0, y: 0 } },
    ];

    const rolloutInit = getAutocompleteSuggestions('kubectl rollout ', mockNodes);
    expect(rolloutInit.some(s => s.value.includes('status deploy/web-app'))).toBe(true);
    expect(rolloutInit.some(s => s.value.includes('history deploy/web-app'))).toBe(true);

    const rolloutStatus = getAutocompleteSuggestions('kubectl rollout status deploy/', mockNodes);
    expect(rolloutStatus.some(s => s.value === 'kubectl rollout status deploy/web-app')).toBe(true);

    const rolloutHistory = getAutocompleteSuggestions('kubectl rollout history deploy/', mockNodes);
    expect(rolloutHistory.some(s => s.value === 'kubectl rollout history deploy/web-app')).toBe(true);

    const rolloutUndo = getAutocompleteSuggestions('kubectl rollout undo deploy/', mockNodes);
    expect(rolloutUndo.some(s => s.value === 'kubectl rollout undo deploy/web-app')).toBe(true);

    const rolloutEmpty = getAutocompleteSuggestions('kubectl rollout', []);
    expect(rolloutEmpty[0].disabled).toBe(true);
  });

  it('handles describe command sequence for all resource types', () => {
    const mockNodes: Node[] = [
      {
        id: 'dep-1',
        type: 'Deployment',
        data: {
          label: 'app-dep',
          roles: [{ name: 'app-role' }],
          configMaps: [{ name: 'app-cm' }],
          secrets: [{ name: 'app-secret' }],
        },
        position: { x: 0, y: 0 },
      },
      { id: 'pod-1', type: 'Pod', data: { label: 'app-pod' }, position: { x: 0, y: 0 } },
    ];

    const descInit = getAutocompleteSuggestions('kubectl describe ', mockNodes);
    expect(descInit.some(s => s.label === 'deploy')).toBe(true);
    expect(descInit.some(s => s.label === 'pod')).toBe(true);

    expect(getAutocompleteSuggestions('kubectl describe deploy ', mockNodes)[0].value).toBe('kubectl describe deploy app-dep');
    expect(getAutocompleteSuggestions('kubectl describe pod ', mockNodes)[0].value).toBe('kubectl describe pod app-pod');
    expect(getAutocompleteSuggestions('kubectl describe role ', mockNodes)[0].value).toBe('kubectl describe role app-role');
    expect(getAutocompleteSuggestions('kubectl describe rolebinding ', mockNodes)[0].value).toBe('kubectl describe rolebinding app-role-binding');
    expect(getAutocompleteSuggestions('kubectl describe cm ', mockNodes)[0].value).toBe('kubectl describe cm app-cm');
    expect(getAutocompleteSuggestions('kubectl describe configmap ', mockNodes)[0].value).toBe('kubectl describe configmap app-cm');
    expect(getAutocompleteSuggestions('kubectl describe secret ', mockNodes)[0].value).toBe('kubectl describe secret app-secret');
  });

  it('handles delete command sequence for pods, deployments, and services', () => {
    const mockNodes: Node[] = [
      { id: 'dep-1', type: 'Deployment', data: { label: 'web-dep' }, position: { x: 0, y: 0 } },
      { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } },
    ];

    const deleteInit = getAutocompleteSuggestions('kubectl delete ', mockNodes);
    expect(deleteInit.some(s => s.label === 'pod')).toBe(true);
    expect(deleteInit.some(s => s.label === 'deployment')).toBe(true);

    const deletePod = getAutocompleteSuggestions('kubectl delete pod ', mockNodes);
    expect(deletePod[0].value).toBe('kubectl delete pod web-pod');

    const deleteNoPods = getAutocompleteSuggestions('kubectl delete pod ', []);
    expect(deleteNoPods[0].disabled).toBe(true);
  });

  it('handles logs command sequence with pod filtering', () => {
    const mockNodes: Node[] = [
      { id: 'pod-1', type: 'Pod', data: { label: 'my-custom-pod' }, position: { x: 0, y: 0 } },
    ];

    const logsSugg = getAutocompleteSuggestions('kubectl logs ', mockNodes);
    expect(logsSugg[0].value).toBe('kubectl logs my-custom-pod');

    const logsEmpty = getAutocompleteSuggestions('kubectl logs', []);
    expect(logsEmpty[0].disabled).toBe(true);
  });

  it('covers getKubectlSubcommandCandidates partial subcommand candidates', () => {
    const mockNodes: Node[] = [
      {
        id: 'dep-1',
        type: 'Deployment',
        data: {
          label: 'app-dep',
          roles: [{ name: 'app-role' }],
          configMaps: [{ name: 'app-cm' }],
          secrets: [{ name: 'app-secret' }],
        },
        position: { x: 0, y: 0 },
      },
      { id: 'pod-1', type: 'Pod', data: { label: 'app-pod' }, position: { x: 0, y: 0 } },
    ];

    expect(getAutocompleteSuggestions('kubectl r', mockNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl l', mockNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl des', mockNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl sc', mockNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl se', mockNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl del', mockNodes).length).toBeGreaterThan(0);

    const emptyNodes: Node[] = [];
    expect(getAutocompleteSuggestions('kubectl r', emptyNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl l', emptyNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl des', emptyNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl sc', emptyNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl se', emptyNodes).length).toBeGreaterThan(0);
    expect(getAutocompleteSuggestions('kubectl del', emptyNodes).length).toBeGreaterThan(0);
  });

  it('covers COMMAND_SPEC_TREE dynamic resolvers and reasons', () => {
    const kubectlNode = COMMAND_SPEC_TREE.find(n => n.name === 'kubectl');
    const logsSpecNode = kubectlNode?.children?.find(c => c.name === 'logs ');
    const descSpecNode = kubectlNode?.children?.find(c => c.name === 'describe');

    expect(logsSpecNode?.requiresResourceReason?.([])).toContain('no Pod on canvas');
    expect(logsSpecNode?.subItemsResolver?.([])).toEqual([]);

    const descDeployNode = descSpecNode?.children?.find(c => c.name === 'deploy ');
    expect(descDeployNode?.requiresResourceReason?.([])).toContain('no Deployment on canvas');
    expect(descDeployNode?.dynamicChildren?.([])).toEqual([]);
  });

  it('recursively executes all resolvers and dynamic children in COMMAND_SPEC_TREE', () => {
    const mockNodesWithAll: Node[] = [
      {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'pod-1', baseName: 'pod', podHash: '12345', replicaSuffixes: ['abcde'] },
        position: { x: 0, y: 0 },
      },
      {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'dep-1', roles: [{ name: 'role-1' }], configMaps: [{ name: 'cm-1' }], secrets: [{ name: 'sec-1' }] },
        position: { x: 0, y: 0 },
      },
    ];

    let executedCount = 0;
    const traverse = (nodes: any[]) => {
      nodes.forEach((node) => {
        if (node.requiresResourceReason) {
          node.requiresResourceReason([]);
          node.requiresResourceReason(mockNodesWithAll);
          executedCount++;
        }
        if (node.dynamicChildren) {
          node.dynamicChildren([]);
          node.dynamicChildren(mockNodesWithAll);
          executedCount++;
        }
        if (node.subItemsResolver) {
          node.subItemsResolver([]);
          node.subItemsResolver(mockNodesWithAll);
          executedCount++;
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };

    traverse(COMMAND_SPEC_TREE);
    expect(executedCount).toBeGreaterThan(0);
  });

  it('covers describe sequence empty canvas reasons', () => {
    const emptyNodes: Node[] = [];
    expect(getAutocompleteSuggestions('kubectl describe deploy ', emptyNodes)[0].disabled).toBe(true);
    expect(getAutocompleteSuggestions('kubectl describe pod ', emptyNodes)[0].disabled).toBe(true);
    expect(getAutocompleteSuggestions('kubectl describe role ', emptyNodes)[0].disabled).toBe(true);
    expect(getAutocompleteSuggestions('kubectl describe rolebinding ', emptyNodes)[0].disabled).toBe(true);
    expect(getAutocompleteSuggestions('kubectl describe cm ', emptyNodes)[0].disabled).toBe(true);
    expect(getAutocompleteSuggestions('kubectl describe secret ', emptyNodes)[0].disabled).toBe(true);
  });

  it('covers delete sequence deployment and service branches', () => {
    const mockNodes: Node[] = [
      { id: 'dep-1', type: 'Deployment', data: { label: 'web-dep' }, position: { x: 0, y: 0 } },
    ];

    const deleteInit = getAutocompleteSuggestions('kubectl delete ', mockNodes);
    expect(deleteInit.some(s => s.value === 'kubectl delete deployment ')).toBe(true);
    expect(deleteInit.some(s => s.value === 'kubectl delete service ')).toBe(true);
  });

  it('covers trimSuggestionLabel edge cases and utility command fallback', () => {
    const utilitySugg = getAutocompleteSuggestions('help', []);
    expect(utilitySugg.some(s => s.value === 'help')).toBe(true);

    const historySugg = getAutocompleteSuggestions('history', []);
    expect(historySugg.some(s => s.value === 'history')).toBe(true);

    const clearSugg = getAutocompleteSuggestions('clear', []);
    expect(clearSugg.some(s => s.value === 'clear')).toBe(true);

    const directItem = { value: 'kubectl get', label: 'kubectl get', category: 'Subcommand' as const };
    expect(trimSuggestionLabel(directItem, 'kubectl').label).toBe('get');

    const eqItem = { value: 'app=nginx', label: 'app=nginx', category: 'Subcommand' as const };
    expect(trimSuggestionLabel(eqItem, 'app=').label).toBe('nginx');

    const fullItem = { value: 'kubectl scale deployment/web', label: 'deployment/web', category: 'Deployment' as const };
    expect(trimSuggestionLabel(fullItem, 'kubectl scale ').label).toBe('deployment/web');

    const partialItem = { value: 'kubectl config view', label: 'kubectl config view', category: 'Command' as const };
    expect(trimSuggestionLabel(partialItem, 'kubectl con').label).toBe('fig view');
  });

  it('trimSuggestionLabel handles custom multi-token command sequences and trimming edge cases', () => {
    const item = {
      value: 'a b c d e',
      label: 'a b c d e',
      category: 'Command' as const,
      description: 'Full description for a b c d e'
    };

    expect(trimSuggestionLabel(item, 'a ').label).toBe('b c d e');
    expect(trimSuggestionLabel(item, 'a b ').label).toBe('c d e');
    expect(trimSuggestionLabel(item, 'a b c ').label).toBe('d e');
    expect(trimSuggestionLabel(item, 'a b c d ').label).toBe('e');

    expect(trimSuggestionLabel(item, 'a b c d ').value).toBe('a b c d e');
    expect(trimSuggestionLabel(item, 'a b c d ').description).toBe('Full description for a b c d e');
  });
});
