import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ExternalTrafficPolicySection,
  EntryNodeSection,
} from '@/components/Config/ServiceWorkerConfigSections';
import '@testing-library/jest-dom';

describe('ServiceWorkerConfigSections', () => {
  describe('ExternalTrafficPolicySection', () => {
    const mockProps = {
      data: {
        externalTrafficPolicy: 'Cluster',
        displaySettings: { externalTrafficPolicy: true },
        yamlSettings: { externalTrafficPolicy: true },
      },
      colorMode: 'dark',
      performUpdate: vi.fn(),
      toggleVisibility: vi.fn(),
      toggleYaml: vi.fn(),
    };

    it('renders Cluster policy behavior description by default', () => {
      render(<ExternalTrafficPolicySection {...mockProps} />);
      expect(screen.getByText('Cluster Policy Behavior')).toBeInTheDocument();
      expect(
        screen.getByText(/kube-proxy may forward packets to target pods on other worker nodes/i)
      ).toBeInTheDocument();
    });

    it('allows toggling visibility, yaml, and switching to Local policy', () => {
      render(<ExternalTrafficPolicySection {...mockProps} />);

      const showHideBtn = screen.getByTitle('Show/Hide on Card');
      fireEvent.click(showHideBtn);
      expect(mockProps.toggleVisibility).toHaveBeenCalledWith('externalTrafficPolicy');

      const yamlBtn = screen.getByTitle('Include in YAML');
      fireEvent.click(yamlBtn);
      expect(mockProps.toggleYaml).toHaveBeenCalledWith('externalTrafficPolicy');

      const localOption = screen.getByText('Local');
      fireEvent.click(localOption);
      expect(mockProps.performUpdate).toHaveBeenCalledWith({ externalTrafficPolicy: 'Local' });
    });

    it('renders Local policy description when externalTrafficPolicy is Local', () => {
      const localProps = {
        ...mockProps,
        data: {
          externalTrafficPolicy: 'Local',
        },
      };
      render(<ExternalTrafficPolicySection {...localProps} />);
      expect(screen.getByText('Local Policy Behavior')).toBeInTheDocument();
      expect(
        screen.getByText(/Preserves client IP without SNAT/i)
      ).toBeInTheDocument();
    });
  });

  describe('EntryNodeSection', () => {
    const mockProps = {
      data: {
        entryNode: 'worker-1',
        displaySettings: { entryNode: true },
      },
      colorMode: 'dark',
      performUpdate: vi.fn(),
      toggleVisibility: vi.fn(),
    };

    it('renders worker node options and triggers update on select', () => {
      render(<EntryNodeSection {...mockProps} />);

      expect(screen.getByText(/Simulated Entry Node/i)).toBeInTheDocument();
      const worker3Btn = screen.getByText('worker-3 (192.168.1.103)');
      fireEvent.click(worker3Btn);
      expect(mockProps.performUpdate).toHaveBeenCalledWith({ entryNode: 'worker-3' });

      const showHideBtn = screen.getByTitle('Show/Hide on Card');
      fireEvent.click(showHideBtn);
      expect(mockProps.toggleVisibility).toHaveBeenCalledWith('entryNode');
    });
  });
});
