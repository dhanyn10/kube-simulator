import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimulationControls } from '../../../src/components/Layout/SimulationControls';
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

    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Play');
    expect(button.title).toBe('Start Simulation');

    fireEvent.click(button);
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

    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Stop');
    expect(button.title).toBe('Stop Simulation');

    fireEvent.click(button);
    expect(stopSimulation).toHaveBeenCalled();
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

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.title).toBe('Add an Internet card to start simulation');
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

    const button = screen.getByRole('button');
    expect(button.title).toBe('HPA requires Resource Limits on target workloads');
  });
});
