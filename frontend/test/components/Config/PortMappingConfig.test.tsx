import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PortMappingConfig } from '@/components/Config/PortMappingConfig';
import '@testing-library/jest-dom';

describe('PortMappingConfig', () => {
  it('renders correctly with dark theme, default labels, and without targetPort handler', () => {
    const onPortChange = vi.fn();

    render(
      <PortMappingConfig
        port=""
        onPortChange={onPortChange}
        colorMode="dark"
      />
    );

    expect(screen.getByText('Service Port')).toBeInTheDocument();
    expect(screen.queryByText('Target Port (Container)')).not.toBeInTheDocument();

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(80);
  });

  it('renders correctly with light theme, custom labels, and with targetPort handler', () => {
    const onPortChange = vi.fn();
    const onTargetPortChange = vi.fn();

    render(
      <PortMappingConfig
        port={8080}
        targetPort={3000}
        onPortChange={onPortChange}
        onTargetPortChange={onTargetPortChange}
        colorMode="light"
        portLabel="Custom Service Port"
        targetPortLabel="Custom Target Port"
      />
    );

    expect(screen.getByText('Custom Service Port')).toBeInTheDocument();
    expect(screen.getByText('Custom Target Port')).toBeInTheDocument();

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(8080);
    expect(inputs[1]).toHaveValue(3000);
  });

  it('triggers change handlers and fallback to 80 on invalid or zero input', () => {
    const onPortChange = vi.fn();
    const onTargetPortChange = vi.fn();

    render(
      <PortMappingConfig
        port={80}
        targetPort={80}
        onPortChange={onPortChange}
        onTargetPortChange={onTargetPortChange}
        colorMode="dark"
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '443' } });
    expect(onPortChange).toHaveBeenCalledWith(443);

    fireEvent.change(inputs[0], { target: { value: '' } });
    expect(onPortChange).toHaveBeenCalledWith(80);

    fireEvent.change(inputs[1], { target: { value: '8080' } });
    expect(onTargetPortChange).toHaveBeenCalledWith(8080);

    fireEvent.change(inputs[1], { target: { value: '' } });
    expect(onTargetPortChange).toHaveBeenCalledWith(80);
  });
});
