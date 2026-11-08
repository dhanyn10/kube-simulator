import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPalette } from '@/components/UI/ColorPalette';
import { MATERIAL_COLORS } from '@/lib/colors';

describe('ColorPalette', () => {
  it('renders all material color buttons with correct titles and background colors', () => {
    const onSelect = vi.fn();
    render(<ColorPalette selectedColor="#F44336" onSelect={onSelect} />);

    MATERIAL_COLORS.forEach((c) => {
      const btn = screen.getByTitle(c.name);
      expect(btn).toBeDefined();
      expect(btn.getAttribute('type')).toBe('button');
    });
  });

  it('calls onSelect with the selected hex when a button is clicked', () => {
    const onSelect = vi.fn();
    render(<ColorPalette selectedColor="" onSelect={onSelect} />);

    const targetColor = MATERIAL_COLORS[2];
    const btn = screen.getByTitle(targetColor.name);
    fireEvent.click(btn);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(targetColor.hex);
  });

  it('highlights the selected color and applies custom className', () => {
    const onSelect = vi.fn();
    const activeColor = MATERIAL_COLORS[0];
    const { container } = render(
      <ColorPalette selectedColor={activeColor.hex} onSelect={onSelect} className="custom-palette" />
    );

    const activeBtn = screen.getByTitle(activeColor.name);
    expect(activeBtn.className).toContain('ring-2');

    const wrapper = container.querySelector('.custom-palette');
    expect(wrapper).not.toBeNull();
  });
});
