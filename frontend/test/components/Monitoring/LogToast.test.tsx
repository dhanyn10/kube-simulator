import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LogToast } from '@/components/Monitoring/LogToast';

describe('LogToast', () => {
  it('renders null as notification popup is replaced by MenuBar bell icon', () => {
    const { container } = render(<LogToast />);
    expect(container.firstChild).toBeNull();
  });
});
