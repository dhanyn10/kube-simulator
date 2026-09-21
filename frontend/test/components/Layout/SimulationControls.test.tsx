import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimulationControls } from '@/components/Layout/SimulationControls';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('SimulationControls', () => {
  it('renders start button when not simulating', () => {
    const startSimulation = vi.fn();
    const stopSimulation = vi.fn();
    render(
      <SimulationControls
        isSimulating={false}
        startSimulation={startSimulation}
        stopSimulation={stopSimulation}
        hasInternet={true}
        hasHpaValidationError={false}
        colorMode="dark"
      />
    );

    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton.textContent).toContain('Play');
    expect(playButton.title).toBe('Start Simulation');

    fireEvent.click(playButton);
    expect(startSimulation).toHaveBeenCalled();
  });

  it('renders stop button when simulating', () => {
    const startSimulation = vi.fn();
    const stopSimulation = vi.fn();
    render(
      <SimulationControls
        isSimulating={true}
        startSimulation={startSimulation}
        stopSimulation={stopSimulation}
        hasInternet={true}
        hasHpaValidationError={false}
        colorMode="dark"
      />
    );

    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton.textContent).toContain('Stop');
    expect(stopButton.title).toBe('Stop Simulation');

    fireEvent.click(stopButton);
    expect(stopSimulation).toHaveBeenCalled();
  });

  it('shows red pulsing button when simulating with HPA validation error in light mode', () => {
    render(
      <SimulationControls
        isSimulating={true}
        startSimulation={vi.fn()}
        stopSimulation={vi.fn()}
        hasInternet={true}
        hasHpaValidationError={true}
        colorMode="light"
      />
    );

    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton.className).toContain('bg-red-600 animate-pulse');
  });

  it('disables button when no internet', () => {
    render(
      <SimulationControls
        isSimulating={false}
        startSimulation={vi.fn()}
        stopSimulation={vi.fn()}
        hasInternet={false}
        hasHpaValidationError={false}
        colorMode="dark"
      />
    );

    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton).toBeDisabled();
    expect(playButton.title).toBe('Add an Internet card to start simulation');
  });

  it('shows warning title when HPA validation error exists', () => {
    render(
      <SimulationControls
        isSimulating={false}
        startSimulation={vi.fn()}
        stopSimulation={vi.fn()}
        hasInternet={true}
        hasHpaValidationError={true}
        colorMode="dark"
      />
    );

    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton.title).toBe('HPA requires Resource Limits on target workloads');
  });

  it('renders Cities Skylines 1 style speed controls when simulating with an active internet profile', () => {
    useFlowStore.setState({
      nodes: [
        {
          id: 'int1',
          type: 'Internet',
          data: {
            label: 'Internet',
            connectionProfile: { name: 'E-Commerce', hourly: {} }
          }
        } as any
      ],
      simulationSpeed: 1
    });

    render(
      <SimulationControls
        isSimulating={true}
        startSimulation={vi.fn()}
        stopSimulation={vi.fn()}
        hasInternet={true}
        hasHpaValidationError={false}
        colorMode="dark"
      />
    );

    expect(screen.getByTestId('speed-controls-group')).toBeDefined();
    const btn1x = screen.getByTestId('speed-btn-1x');
    const btn5x = screen.getByTestId('speed-btn-5x');
    const btn10x = screen.getByTestId('speed-btn-10x');

    expect(btn1x).toBeDefined();
    expect(btn5x).toBeDefined();
    expect(btn10x).toBeDefined();

    fireEvent.click(btn5x);
    expect(useFlowStore.getState().simulationSpeed).toBe(5);

    fireEvent.click(btn10x);
    expect(useFlowStore.getState().simulationSpeed).toBe(10);
  });
});
