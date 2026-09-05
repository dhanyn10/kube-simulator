import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  ConfigLabel,
  VisibilityToggle,
  YamlToggle,
  ConfigInput,
  ConfigSection,
  AdvancedSection,
  NumberStepper,
  RangeInput,
} from '../../../src/components/UI/ConfigUI';
import '@testing-library/jest-dom';

describe('ConfigUI Component Suite', () => {
  it('renders ConfigLabel with child text', () => {
    render(<ConfigLabel>Test Label</ConfigLabel>);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('renders VisibilityToggle and handles clicks', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<VisibilityToggle isVisible={true} onToggle={onToggle} />);
    expect(screen.getByTitle('Show/Hide on Card')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Show/Hide on Card'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<VisibilityToggle isVisible={false} onToggle={onToggle} />);
    expect(screen.getByTitle('Show/Hide on Card')).toBeInTheDocument();
  });

  it('renders YamlToggle disabled and active states', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<YamlToggle isEnabled={true} onToggle={onToggle} disabled={true} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    rerender(<YamlToggle isEnabled={true} onToggle={onToggle} disabled={false} />);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<YamlToggle isEnabled={false} onToggle={onToggle} disabled={false} />);
    expect(button).not.toBeDisabled();
  });

  it('renders ConfigInput and handles change events', () => {
    const onChange = vi.fn();
    render(
      <ConfigInput
        value="hello"
        onChange={onChange}
        placeholder="Enter text..."
        colorMode="dark"
      />
    );
    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toHaveValue('hello');

    fireEvent.change(input, { target: { value: 'world' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders ConfigSection with titles, toggles, and children', () => {
    const onToggle = vi.fn();
    const onYamlToggle = vi.fn();
    render(
      <ConfigSection
        title="CPU Budget"
        isVisible={true}
        onToggle={onToggle}
        isYamlEnabled={true}
        onYamlToggle={onYamlToggle}
      >
        <div>Content Inside Section</div>
      </ConfigSection>
    );

    expect(screen.getByText('CPU Budget')).toBeInTheDocument();
    expect(screen.getByText('Content Inside Section')).toBeInTheDocument();
  });

  it('renders AdvancedSection and toggles content expansion', () => {
    render(
      <AdvancedSection colorMode="dark">
        <div>Hidden Advanced Content</div>
      </AdvancedSection>
    );

    expect(screen.queryByText('Hidden Advanced Content')).toBeNull();

    const toggleBtn = screen.getByRole('button', { name: /Advanced Options/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Hidden Advanced Content')).toBeInTheDocument();
  });

  it('renders NumberStepper and handles stepper increment/decrement/direct input', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={5} onChange={onChange} min={1} max={10} colorMode="dark" />);

    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons[0];
    const plusBtn = buttons[1];

    fireEvent.click(minusBtn);
    expect(onChange).toHaveBeenCalledWith(4);

    fireEvent.click(plusBtn);
    expect(onChange).toHaveBeenCalledWith(6);

    const numInput = screen.getByRole('spinbutton');
    fireEvent.change(numInput, { target: { value: '8' } });
    expect(onChange).toHaveBeenCalledWith(8);

    fireEvent.change(numInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('renders RangeInput and handles value changes', () => {
    const onChange = vi.fn();
    render(<RangeInput value={50} onChange={onChange} min={0} max={100} step={1} unit="%" />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('50');

    fireEvent.change(slider, { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith(75);
  });
});
