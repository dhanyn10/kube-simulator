import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MenuBar } from '@/components/Layout/MenuBar';
import { useFlowStore } from '@/store';
import { handleAdminAndCheatCommands, CommandContext } from '@/components/Layout/terminalCommands';

describe('Admin Authentication and GTA Cheat Code System', () => {
  beforeEach(() => {
    useFlowStore.setState({
      simulatedUpdateInfo: null,
      isAdminAuthenticated: false,
      isAwaitingAdminPassword: false,
      activityLogs: [],
    });
  });

  it('prompts for password when "kubesim admin" is executed', () => {
    const logs: string[] = [];
    const ctx: CommandContext = {
      nodes: [],
      isSimulating: false,
      updateNodeData: vi.fn(),
      addActivityLog: (msg) => logs.push(msg),
      deleteNodes: vi.fn(),
      getStoreState: () => useFlowStore.getState(),
      setStoreState: (state) => useFlowStore.setState(state),
    };

    const handled = handleAdminAndCheatCommands('kubesim admin', ctx);
    expect(handled).toBe(true);
    expect(logs).toContain('[Admin Authentication] Please enter admin password:');
    expect(useFlowStore.getState().isAwaitingAdminPassword).toBe(true);
  });

  it('authenticates admin when correct password is submitted and unlocks cheats', () => {
    useFlowStore.setState({ isAwaitingAdminPassword: true });

    const logs: string[] = [];
    const ctx: CommandContext = {
      nodes: [],
      isSimulating: false,
      updateNodeData: vi.fn(),
      addActivityLog: (msg) => logs.push(msg),
      deleteNodes: vi.fn(),
      getStoreState: () => useFlowStore.getState(),
      setStoreState: (state) => useFlowStore.setState(state),
    };

    const handled = handleAdminAndCheatCommands('kubesim123', ctx);
    expect(handled).toBe(true);
    expect(useFlowStore.getState().isAdminAuthenticated).toBe(true);
    expect(logs.some(l => l.includes('Access Granted'))).toBe(true);

    // Now test cheat command
    handleAdminAndCheatCommands('cheat update 0.5.0', ctx);
    expect(useFlowStore.getState().simulatedUpdateInfo?.latestVersion).toBe('0.5.0');
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
