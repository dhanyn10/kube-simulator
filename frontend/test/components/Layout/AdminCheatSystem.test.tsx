import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MenuBar } from '@/components/Layout/MenuBar';
import { useFlowStore } from '@/store';
import { handleAdminAndCheatCommands, CommandContext } from '@/components/Layout/terminalCommands';

import { handleHelpCommand } from '@/components/Layout/TerminalPanel';
import { getAutocompleteSuggestions } from '@/components/Layout/terminalAutocomplete';

describe('Admin Authentication and GTA Cheat Code System', () => {
  let logs: string[];
  let ctx: CommandContext;

  beforeEach(() => {
    logs = [];
    useFlowStore.setState({
      simulatedUpdateInfo: null,
      simulatedCurrentVersion: null,
      isAdminAuthenticated: false,
      isAwaitingAdminPassword: false,
      activityLogs: [],
    });

    ctx = {
      nodes: [],
      isSimulating: false,
      updateNodeData: vi.fn(),
      addActivityLog: (msg) => logs.push(msg),
      deleteNodes: vi.fn(),
      getStoreState: () => useFlowStore.getState(),
      setStoreState: (state) => useFlowStore.setState(state),
    };
  });

  it('prompts for password when "kubesim admin" is executed', () => {
    const handled = handleAdminAndCheatCommands('kubesim admin', ctx);
    expect(handled).toBe(true);
    expect(logs).toContain('[Admin Authentication] Please enter admin password:');
    expect(useFlowStore.getState().isAwaitingAdminPassword).toBe(true);
  });

  it('handles already authenticated kubesim admin command', () => {
    useFlowStore.setState({ isAdminAuthenticated: true });
    const handled = handleAdminAndCheatCommands('kubesim admin', ctx);
    expect(handled).toBe(true);
    expect(logs.some(l => l.includes('Already authenticated'))).toBe(true);
  });

  it('authenticates admin when correct password is submitted and unlocks try commands', () => {
    useFlowStore.setState({ isAwaitingAdminPassword: true });

    const handled = handleAdminAndCheatCommands('kubesim123', ctx);
    expect(handled).toBe(true);
    expect(useFlowStore.getState().isAdminAuthenticated).toBe(true);
    expect(logs.some(l => l.includes('Secret Mode Unlocked'))).toBe(true);

    // Now test try version update command
    handleAdminAndCheatCommands('try version update 0.5.0', ctx);
    expect(useFlowStore.getState().simulatedUpdateInfo?.latestVersion).toBe('0.5.0');
  });

  it('rejects authentication on wrong password', () => {
    useFlowStore.setState({ isAwaitingAdminPassword: true });
    const handled = handleAdminAndCheatCommands('wrongpass', ctx);
    expect(handled).toBe(true);
    expect(useFlowStore.getState().isAdminAuthenticated).toBe(false);
    expect(logs.some(l => l.includes('Access Denied'))).toBe(true);
  });

  it('handles try version update, try version current, try version clear, try clear, try status, and unknown try commands', () => {
    useFlowStore.setState({ isAdminAuthenticated: true });

    // try version update default
    handleAdminAndCheatCommands('try version update', ctx);
    expect(useFlowStore.getState().simulatedUpdateInfo?.latestVersion).toBe('0.4.0');

    // try version current without arg (status check)
    logs = [];
    handleAdminAndCheatCommands('try version current', ctx);
    expect(logs.some(l => l.includes('Current assumed version: v0.3.0'))).toBe(true);

    // try version current 0.5.0
    logs = [];
    handleAdminAndCheatCommands('try version current 0.5.0', ctx);
    expect(useFlowStore.getState().simulatedCurrentVersion).toBe('0.5.0');
    expect(logs.some(l => l.includes('Current version set to v0.5.0'))).toBe(true);

    // try status
    logs = [];
    handleAdminAndCheatCommands('try status', ctx);
    expect(logs.some(l => l.includes('Dev-Mode Status') && l.includes('v0.5.0'))).toBe(true);

    // try version clear
    handleAdminAndCheatCommands('try version clear', ctx);
    expect(useFlowStore.getState().simulatedCurrentVersion).toBeNull();

    // try clear resets both
    useFlowStore.setState({ simulatedCurrentVersion: '0.6.0', simulatedUpdateInfo: { latestVersion: '0.7.0', releaseUrl: 'http://example.com' } });
    handleAdminAndCheatCommands('try clear', ctx);
    expect(useFlowStore.getState().simulatedUpdateInfo).toBeNull();
    expect(useFlowStore.getState().simulatedCurrentVersion).toBeNull();

    // unknown try
    handleAdminAndCheatCommands('try invalidcmd', ctx);
    expect(logs.some(l => l.includes('Unknown command'))).toBe(true);
  });

  it('rejects simulated update when target version is lower than or equal to current version', () => {
    useFlowStore.setState({ isAdminAuthenticated: true, simulatedCurrentVersion: '0.4.0' });

    // try version update to 0.2.0 (lower than 0.4.0)
    handleAdminAndCheatCommands('try version update 0.2.0', ctx);
    expect(useFlowStore.getState().simulatedUpdateInfo).toBeNull();
    expect(logs.some(l => l.includes('must be higher than current version'))).toBe(true);

    // try version update to 0.4.0 (equal to 0.4.0)
    logs = [];
    handleAdminAndCheatCommands('try version update 0.4.0', ctx);
    expect(useFlowStore.getState().simulatedUpdateInfo).toBeNull();
    expect(logs.some(l => l.includes('must be higher than current version'))).toBe(true);
  });

  it('warns and clears update info if current version is set higher than active update version', () => {
    useFlowStore.setState({
      isAdminAuthenticated: true,
      simulatedUpdateInfo: { latestVersion: '0.5.0', releaseUrl: 'https://example.com' },
    });

    handleAdminAndCheatCommands('try version current 0.6.0', ctx);
    expect(useFlowStore.getState().simulatedCurrentVersion).toBe('0.6.0');
    expect(useFlowStore.getState().simulatedUpdateInfo).toBeNull();
    expect(logs.some(l => l.includes('Target update version (v0.5.0) cannot be equal or lower than current version (v0.6.0)'))).toBe(true);
  });

  it('enforces mode isolation (blocks try in user mode & standard cmd in admin mode)', () => {
    // User mode: block try command
    handleAdminAndCheatCommands('try version update 0.9.0', ctx);
    expect(logs.some(l => l.includes('Admin mode is inactive'))).toBe(true);

    // Admin mode: block standard user command
    logs = [];
    useFlowStore.setState({ isAdminAuthenticated: true });
    handleAdminAndCheatCommands('kubectl get pods', ctx);
    expect(logs.some(l => l.includes('You are currently in Admin Mode'))).toBe(true);
  });

  it('handles logout and exit commands in admin mode', () => {
    useFlowStore.setState({ isAdminAuthenticated: true });
    const handled = handleAdminAndCheatCommands('logout', ctx);
    expect(handled).toBe(true);
    expect(useFlowStore.getState().isAdminAuthenticated).toBe(false);
    expect(logs.some(l => l.includes('Logged out from admin mode'))).toBe(true);
  });

  it('renders isolated help outputs depending on user vs admin mode', () => {
    // Standard User Mode Help
    handleHelpCommand('help', ctx);
    expect(logs.some(l => l.includes('Available educational Kubernetes commands'))).toBe(true);
    expect(logs.some(l => l.includes('try version update'))).toBe(false);

    // Admin Mode Help
    logs = [];
    useFlowStore.setState({ isAdminAuthenticated: true });
    handleHelpCommand('help', ctx);
    expect(logs.some(l => l.includes('Admin CLI Commands'))).toBe(true);
    expect(logs.some(l => l.includes('try version update'))).toBe(true);
    expect(logs.some(l => l.includes('try version current'))).toBe(true);
    expect(logs.some(l => l.includes('kubectl get pods'))).toBe(false);
  });

  it('filters autocomplete suggestions based on admin state', () => {
    // Awaiting password -> empty
    expect(getAutocompleteSuggestions('k', [], false, true)).toEqual([]);

    // Admin Mode -> admin try suggestions
    const adminSugg = getAutocompleteSuggestions('tr', [], true, false);
    expect(adminSugg.some(s => s.value.startsWith('try'))).toBe(true);
  });

  it('renders Update button in MenuBar when simulated update cheat is active', async () => {
    useFlowStore.setState({
      simulatedUpdateInfo: { latestVersion: '0.5.0', releaseUrl: 'https://example.com' },
    });

    render(
      <MenuBar
        onExportYaml={vi.fn()}
        onImportFile={vi.fn()}
        onSaveFile={vi.fn()}
        onOpenProjects={vi.fn()}
        onOpenScenarios={vi.fn()}
        onOpenAbout={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    const updateBtn = await screen.findByTestId('menubar-update-btn');
    expect(updateBtn).toBeInTheDocument();
    expect(updateBtn).toHaveTextContent('Update v0.5.0');
  });
});
