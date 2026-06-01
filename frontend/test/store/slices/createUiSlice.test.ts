import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '../../../src/store';

describe('createUiSlice via useFlowStore', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      customImages: ['my-web-app:v1.0', 'backend-api:latest'],
      isAutosaveEnabled: false,
    });

    globalThis.go = {
        main: {
          App: {
            SaveSetting: vi.fn().mockResolvedValue(true)
          }
        }
      } as any;
  });

  it('should toggle color mode', () => {
    useFlowStore.getState().toggleColorMode();
    expect(useFlowStore.getState().colorMode).toBe('light');
  });

  it('should add custom image', () => {
    useFlowStore.getState().addCustomImage('test:latest');
    expect(useFlowStore.getState().customImages).toContain('test:latest');
  });

  it('should delete custom image', () => {
    useFlowStore.getState().deleteCustomImage('my-web-app:v1.0');
    expect(useFlowStore.getState().customImages).not.toContain('my-web-app:v1.0');
  });

  it('should toggle autosave', () => {
    useFlowStore.getState().toggleAutosave();
    expect(useFlowStore.getState().isAutosaveEnabled).toBe(true);
  });
});
