import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import {
  VisibilityToggle,
  YamlToggle,
  ConfigInput,
  ConfigSection,
  AdvancedSection,
  NumberStepper,
  RangeInput,
} from '@/components/UI/ConfigUI';

describe('ConfigUI uncovered conditions', () => {
  it('covers YamlToggle disabled, enabled, and disabled=false/isEnabled=false states', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<YamlToggle isEnabled={false} onToggle={onToggle} disabled={true} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.className).toContain('cursor-not-allowed');

    rerender(<YamlToggle isEnabled={true} onToggle={onToggle} disabled={true} />);
    expect(btn).toBeDisabled();

    rerender(<YamlToggle isEnabled={false} onToggle={onToggle} disabled={false} />);
    expect(btn).not.toBeDisabled();
    expect(btn.className).toContain('text-slate-500');

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

  it('covers ConfigSection optional props fallback branches and disableYamlToggle', () => {
    render(<ConfigSection title="Section Title" onYamlToggle={vi.fn()} disableYamlToggle={true}><div>Child Content</div></ConfigSection>);
    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('covers ConfigSection with Icon, onToggle provided, and onYamlToggle omitted', () => {
    const MockIcon = () => <span data-testid="mock-icon" />;
    const onToggle = vi.fn();
    const { rerender } = render(
      <ConfigSection title="Full Section" icon={MockIcon as any} onToggle={onToggle} onYamlToggle={vi.fn()}>
        <div>Full Content</div>
      </ConfigSection>
    );
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    expect(screen.getByText('Full Section')).toBeInTheDocument();

    // ConfigSection with onYamlToggle omitted
    rerender(
      <ConfigSection title="No Yaml Section">
        <div>No Yaml Content</div>
      </ConfigSection>
    );
    expect(screen.getByText('No Yaml Section')).toBeInTheDocument();
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

  it('covers NumberStepper empty input, dark mode, NaN input, disabled limits, and bound clamping', () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumberStepper value={5} onChange={onChange} colorMode="light" min={1} max={100} />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(0);

    // Override input.value to non-numeric string 'abc' to bypass jsdom HTMLInputElement[type=number] sanitization
    // and exercise the !Number.isNaN(val) === false branch on line 151
    onChange.mockClear();
    Object.defineProperty(input, 'value', { value: 'abc', configurable: true, writable: true });
    fireEvent.change(input);
    expect(onChange).not.toHaveBeenCalled();

    // Reset input property and test valid numeric change
    Object.defineProperty(input, 'value', { value: '25', configurable: true, writable: true });
    fireEvent.change(input);
    expect(onChange).toHaveBeenCalledWith(25);

    // NumberStepper decrement and increment buttons click
    let buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // decrement
    expect(onChange).toHaveBeenCalledWith(4);

    fireEvent.click(buttons[1]); // increment
    expect(onChange).toHaveBeenCalledWith(6);

    // Boundary limits testing: value <= min and value >= max
    rerender(<NumberStepper value={1} onChange={onChange} colorMode="light" min={1} max={100} />);
    buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();

    rerender(<NumberStepper value={100} onChange={onChange} colorMode="light" min={1} max={100} />);
    buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).toBeDisabled();

    rerender(<NumberStepper value={5} onChange={onChange} colorMode="dark" min={1} max={100} />);
    expect(input.className).toContain('bg-slate-900/50');
  });

  it('covers RangeInput onChange handler', () => {
    const onChange = vi.fn();
    render(<RangeInput value={50} onChange={onChange} min={0} max={100} step={1} unit="%" />);
    const range = screen.getByRole('slider');
    fireEvent.change(range, { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('covers VisibilityToggle button click', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<VisibilityToggle isVisible={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalled();

    rerender(<VisibilityToggle isVisible={false} onToggle={onToggle} />);
    expect(screen.getByRole('button').className).toContain('text-slate-500');
  });
});
