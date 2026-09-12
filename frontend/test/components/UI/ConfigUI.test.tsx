import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import {
  YamlToggle,
  ConfigInput,
  ConfigSection,
  AdvancedSection,
  NumberStepper,
  RangeInput,
} from '@/components/UI/ConfigUI';

describe('ConfigUI uncovered conditions', () => {
  it('covers YamlToggle disabled state branch', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<YamlToggle isEnabled={false} onToggle={onToggle} disabled={true} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.className).toContain('cursor-not-allowed');

    rerender(<YamlToggle isEnabled={true} onToggle={onToggle} disabled={false} />);
    expect(btn).not.toBeDisabled();
    expect(btn.className).toContain('text-emerald-500');
  });

  it('covers ConfigInput light mode and dark mode styling branches', () => {
    const { rerender } = render(<ConfigInput value="test" onChange={() => {}} colorMode="dark" />);
    const input = screen.getByDisplayValue('test');
    expect(input.className).toContain('bg-slate-800');

    rerender(<ConfigInput value="test" onChange={() => {}} colorMode="light" />);
    expect(input.className).toContain('bg-slate-50');
  });

  it('covers ConfigSection optional props fallback branches', () => {
    render(<ConfigSection title="Section Title"><div>Child Content</div></ConfigSection>);
    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('covers AdvancedSection toggle open and colorMode branches', () => {
    const { rerender } = render(<AdvancedSection colorMode="dark"><div>Advanced Content</div></AdvancedSection>);
    const toggleBtn = screen.getByText('Advanced Options');
    expect(screen.queryByText('Advanced Content')).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText('Advanced Content')).toBeInTheDocument();

    rerender(<AdvancedSection colorMode="light"><div>Advanced Content</div></AdvancedSection>);
    expect(toggleBtn.className).toContain('text-slate-500');
  });

  it('covers NumberStepper empty input and invalid number branches', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={5} onChange={onChange} colorMode="light" min={1} max={100} />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(0);

    fireEvent.change(input, { target: { value: '25' } });
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it('covers RangeInput onChange handler', () => {
    const onChange = vi.fn();
    render(<RangeInput value={50} onChange={onChange} min={0} max={100} step={1} unit="%" />);
    const range = screen.getByRole('slider');
    fireEvent.change(range, { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith(75);
  });
});
