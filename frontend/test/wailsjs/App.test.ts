import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Greet,
  GetSystemResources,
  OpenLogFile,
  FetchDockerHubPopular,
  SearchDockerHub,
  FetchDockerHubTags,
  WriteLog,
  GetSetting,
} from '@/wailsjs/go/main/App';

describe('wailsjs/go/main/App.js', () => {
  const mockApp = {
    Greet: vi.fn(),
    GetSystemResources: vi.fn(),
    OpenLogFile: vi.fn(),
    FetchDockerHubPopular: vi.fn(),
    SearchDockerHub: vi.fn(),
    FetchDockerHubTags: vi.fn(),
    WriteLog: vi.fn(),
    GetSetting: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (window as any).go = {
      main: {
        App: mockApp,
      },
    };
  });

  it('calls Greet with correct argument', () => {
    mockApp.Greet.mockReturnValue('Hello World');
    const res = Greet('World');
    expect(mockApp.Greet).toHaveBeenCalledWith('World');
    expect(res).toBe('Hello World');
  });

  it('calls GetSystemResources', () => {
    mockApp.GetSystemResources.mockReturnValue({ cpuCores: 4 });
    const res = GetSystemResources();
    expect(mockApp.GetSystemResources).toHaveBeenCalled();
    expect(res).toEqual({ cpuCores: 4 });
  });

  it('calls OpenLogFile with filepath', () => {
    mockApp.OpenLogFile.mockReturnValue(true);
    const res = OpenLogFile('/path/to/log');
    expect(mockApp.OpenLogFile).toHaveBeenCalledWith('/path/to/log');
    expect(res).toBe(true);
  });

  it('calls FetchDockerHubPopular', () => {
    mockApp.FetchDockerHubPopular.mockReturnValue(['nginx', 'redis']);
    const res = FetchDockerHubPopular();
    expect(mockApp.FetchDockerHubPopular).toHaveBeenCalled();
    expect(res).toEqual(['nginx', 'redis']);
  });

  it('calls SearchDockerHub with query', () => {
    mockApp.SearchDockerHub.mockReturnValue([{ name: 'postgres' }]);
    const res = SearchDockerHub('postgres');
    expect(mockApp.SearchDockerHub).toHaveBeenCalledWith('postgres');
    expect(res).toEqual([{ name: 'postgres' }]);
  });

  it('calls FetchDockerHubTags with image name', () => {
    mockApp.FetchDockerHubTags.mockReturnValue(['latest', 'alpine']);
    const res = FetchDockerHubTags('nginx');
    expect(mockApp.FetchDockerHubTags).toHaveBeenCalledWith('nginx');
    expect(res).toEqual(['latest', 'alpine']);
  });

  it('calls WriteLog with scope, level, and message', () => {
    mockApp.WriteLog.mockReturnValue(true);
    const res = WriteLog('UI', 'INFO', 'test message');
    expect(mockApp.WriteLog).toHaveBeenCalledWith('UI', 'INFO', 'test message');
    expect(res).toBe(true);
  });

  it('calls GetSetting with key', () => {
    mockApp.GetSetting.mockReturnValue('dark');
    const res = GetSetting('theme');
    expect(mockApp.GetSetting).toHaveBeenCalledWith('theme');
    expect(res).toBe('dark');
  });
});
