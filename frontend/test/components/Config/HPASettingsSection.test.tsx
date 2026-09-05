import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { HPASettingsSection } from '@/components/Config/HPASettingsSection';

describe('HPASettingsSection', () => {
  it('returns null if node has no attached hpas', () => {
    const { container } = render(
      <HPASettingsSection
        data={{ label: 'dep-1', type: 'Deployment' }}
        nodeId="dep-1"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders HPA settings button when node has attached hpas', () => {
    render(
      <HPASettingsSection
        data={{
          label: 'dep-1',
          type: 'Deployment',
          hpas: [
            {
              id: 'hpa-1',
              name: 'app-hpa',
              minReplicas: 2,
              maxReplicas: 10,
              targetCPU: 80,
            },
          ],
        }}
        nodeId="dep-1"
      />
    );

    expect(screen.getByTitle('Attached HPAs (1)')).toBeInTheDocument();
  });
});
