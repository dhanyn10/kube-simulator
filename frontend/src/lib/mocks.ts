import { generateYamlClientSide } from './manifestGenerator';

export const initWailsMocks = () => {
    if (typeof globalThis === 'undefined' || (globalThis as any).go) return;

    const safeLog = (globalThis as any)._originalConsoleLog || console.log;
    const safeWarn = (globalThis as any)._originalConsoleWarn || console.warn;
    const safeError = (globalThis as any)._originalConsoleError || console.error;

    safeLog('[Mocks] Real Wails backend not detected. Initializing browser mocks...');

    (globalThis as any).runtime = {
        EventsOnMultiple: (eventName: string, _callback: any, _maxCallbacks: number) => {
            safeLog(`[Mocks] EventsOnMultiple called for: ${eventName}`);
            return () => {};
        },
        EventsOn: (eventName: string, _callback: any) => {
            safeLog(`[Mocks] EventsOn called for: ${eventName}`);
            return () => {};
        },
        EventsOff: () => {},
        EventsEmit: () => {},
        LogPrint: (msg: string) => safeLog(msg),
        LogTrace: (msg: string) => safeLog(msg),
        LogDebug: (msg: string) => safeLog(msg),
        LogInfo: (msg: string) => safeLog(msg),
        LogWarning: (msg: string) => safeWarn(msg),
        LogError: (msg: string) => safeError(msg),
        LogFatal: (msg: string) => {
            safeError(`[FATAL] ${msg}`);
            // Explicitly handle fatal if needed, but safeError interceptor will catch it
        }
    };

    (globalThis as any).go = {
        main: {
            App: {
                GetProjects: () => Promise.resolve(JSON.parse(localStorage.getItem('mock_projects') || '[]')),
                SaveProject: (name: string, content: string) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    const id = Date.now();
                    projects.push({ id, name, content, updatedAt: Date.now() / 1000 });
                    localStorage.setItem('mock_projects', JSON.stringify(projects));
                    return Promise.resolve(id);
                },
                LoadProject: (id: number) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    return Promise.resolve(projects.find((p: any) => p.id === id));
                },
                DeleteProject: (id: number) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    localStorage.setItem('mock_projects', JSON.stringify(projects.filter((p: any) => p.id !== id)));
                    return Promise.resolve(true);
                },
                UpdateProject: (id: number, content: string) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    const idx = projects.findIndex((p: any) => p.id === id);
                    if (idx !== -1) {
                        projects[idx].content = content;
                        projects[idx].updatedAt = Date.now() / 1000;
                        localStorage.setItem('mock_projects', JSON.stringify(projects));
                        return Promise.resolve(true);
                    }
                    return Promise.resolve(false);
                },
                GetHistoryLogs: () => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    return Promise.resolve(history);
                },
                GetCurrentHistoryIndex: () => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    return Promise.resolve(history.length > 0 ? history.length - 1 : 0);
                },
                PushHistory: (state: string) => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    const data = JSON.parse(state);
                    const index = history.length;
                    history.push({
                        index,
                        actionName: data.actionName,
                        timestamp: data.timestamp || Date.now()
                    });
                    localStorage.setItem('mock_history', JSON.stringify(history));
                    return Promise.resolve();
                },
                JumpToHistory: (index: number) => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    return Promise.resolve(JSON.stringify(history[index]));
                },
                Undo: () => Promise.resolve(null),
                Redo: () => Promise.resolve(null),
                ExportProjectFile: () => Promise.resolve(true),
                ImportProjectFile: () => Promise.resolve(""),
                GetSystemResources: () => Promise.resolve({
                    cpuCores: 8,
                    cpuUsage: 25,
                    totalMemoryGB: 16,
                    freeMemoryGB: 12
                }),
                GetSystemInfo: () => Promise.resolve({
                    os: 'windows',
                    arch: 'amd64',
                    goVersion: 'go1.25.0',
                    version: '0.4.0'
                }),
                MinimizeWindow: () => {
                    safeLog('Minimize Window');
                    return Promise.resolve();
                },
                MaximizeWindow: () => {
                    safeLog('Maximize Window');
                    return Promise.resolve();
                },
                CloseWindow: () => {
                    safeLog('Close Window');
                    return Promise.resolve();
                },
                GetSetting: () => Promise.resolve(""),
                SaveSetting: () => Promise.resolve(true),
                OpenFileFolder: () => Promise.resolve(true),
                FileExists: () => Promise.resolve(true),
                GetAutosaveProfiles: () => Promise.resolve([]),
                GetInternetProfiles: () => Promise.resolve(JSON.parse(localStorage.getItem('mock_internet_profiles') || '[]')),
                SaveInternetProfile: (name: string, profileJson: string) => {
                    const profiles = JSON.parse(localStorage.getItem('mock_internet_profiles') || '[]');
                    const parsed = JSON.parse(profileJson);
                    const idx = profiles.findIndex((p: any) => p.name === name);
                    if (idx !== -1) {
                        profiles[idx] = parsed;
                    } else {
                        profiles.push(parsed);
                    }
                    localStorage.setItem('mock_internet_profiles', JSON.stringify(profiles));
                    return Promise.resolve(true);
                },
                DeleteInternetProfile: (name: string) => {
                    const profiles = JSON.parse(localStorage.getItem('mock_internet_profiles') || '[]');
                    localStorage.setItem('mock_internet_profiles', JSON.stringify(profiles.filter((p: any) => p.name !== name)));
                    return Promise.resolve(true);
                },
                GenerateYaml: (nodesJson: string, edgesJson: string) => {
                    try {
                        const nodes = JSON.parse(nodesJson || '[]');
                        const edges = JSON.parse(edgesJson || '[]');
                        return Promise.resolve(generateYamlClientSide(nodes, edges));
                    } catch {
                        return Promise.resolve('');
                    }
                },
                WriteLog: (_category: string, _level: string, _message: string) => Promise.resolve(true),
                OpenLogFile: () => Promise.resolve(true),
                CheckForUpdates: (currentVersion: string) => Promise.resolve({
                    updateAvailable: false,
                    currentVersion,
                    latestVersion: currentVersion,
                    releaseUrl: '',
                    releaseNotes: '',
                    publishedAt: '',
                    isPrerelease: false
                }),
                FetchDockerHubPopular: () => Promise.resolve(JSON.stringify({
                    results: [
                        { name: 'nginx', description: 'Official build of Nginx.' },
                        { name: 'redis', description: 'In-memory data structure store' },
                        { name: 'postgres', description: 'The PostgreSQL database' }
                    ]
                })),
                FetchDockerHubTags: (_imageName: string) => Promise.resolve(JSON.stringify({
                    results: [
                        { name: 'latest' },
                        { name: 'alpine' },
                        { name: '1.25' }
                    ]
                })),
                SearchDockerHub: (query: string) => Promise.resolve(JSON.stringify({
                    results: [
                        { repo_name: query, short_description: `Search results for ${query}` }
                    ]
                })),
                Greet: (name: string) => Promise.resolve(`Hello ${name}!`),
                CalculateAppHeight: (screenHeight: number) => Promise.resolve(Math.round(screenHeight * 0.85)),
                GetTargetScreenHeight: () => Promise.resolve(1080),
                GetTargetScreen: () => Promise.resolve(false),
                SetInitialFile: () => Promise.resolve()
            }
        }
    };
};
