import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useFlowStore } from '../../../src/store';

// We can just import directly or resolve the correct path. Let's see if ImageDropdown can be imported from '../../src/components/UI/ImageDropdown'
import { ImageDropdown as TargetImageDropdown } from '../../../src/components/UI/ImageDropdown';

describe('ImageDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      customImages: ['my-local-image:latest'],
      addCustomImage: vi.fn((img) => {
        const current = useFlowStore.getState().customImages;
        useFlowStore.setState({ customImages: [...current, img] });
      })
    });
  });

  it('renders trigger button correctly with current value', () => {
    const onChange = vi.fn();
    render(<TargetImageDropdown value="nginx:latest" onChange={onChange} colorMode="dark" />);

    expect(screen.getByText('nginx:latest')).toBeDefined();
  });

  it('renders placeholder when no value is provided', () => {
    const onChange = vi.fn();
    render(<TargetImageDropdown value="" onChange={onChange} colorMode="light" />);

    expect(screen.getByText('Select container image...')).toBeDefined();
  });

  it('opens and displays options when clicked', async () => {
    const onChange = vi.fn();
    render(<TargetImageDropdown value="" onChange={onChange} colorMode="dark" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByPlaceholderText('Search or type custom image...')).toBeDefined();
    expect(screen.getByText('my-local-image:latest')).toBeDefined();
    // Default registries like "nginx:latest" should also be present
    expect(screen.getByText('nginx:latest')).toBeDefined();
  });

  it('filters options and allows adding a custom image', async () => {
    const onChange = vi.fn();
    render(<TargetImageDropdown value="" onChange={onChange} colorMode="dark" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const input = screen.getByPlaceholderText('Search or type custom image...');
    fireEvent.change(input, { target: { value: 'custom-user-image:v1' } });

    const useCustomBtn = screen.getByText(/Use custom image:/i);
    expect(useCustomBtn).toBeDefined();

    fireEvent.click(useCustomBtn);
    expect(onChange).toHaveBeenCalledWith('custom-user-image:v1');
    expect(useFlowStore.getState().customImages).toContain('custom-user-image:v1');
  });

  it('selects option when clicked', async () => {
    const onChange = vi.fn();
    render(<TargetImageDropdown value="" onChange={onChange} colorMode="dark" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const localOpt = screen.getByText('my-local-image:latest');
    fireEvent.click(localOpt);

    expect(onChange).toHaveBeenCalledWith('my-local-image:latest');
  });

  it('closes dropdown when clicking outside', async () => {
    const onChange = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <TargetImageDropdown value="" onChange={onChange} colorMode="dark" />
      </div>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.queryByPlaceholderText('Search or type custom image...')).not.toBeNull();

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    expect(screen.queryByPlaceholderText('Search or type custom image...')).toBeNull();
  });
});
