export const initWailsMocks = () => {
    if (typeof window === 'undefined' || (window as any).go) return;

    console.log('[Mocks] Real Wails backend not detected. Initializing browser mocks...');

    (window as any).go = {
        main: {
            App: {
                GetProjects: async () => JSON.parse(localStorage.getItem('mock_projects') || '[]'),
                SaveProject: async (name: string, content: string) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    const id = Date.now();
                    projects.push({ id, name, content, updatedAt: Date.now() / 1000 });
                    localStorage.setItem('mock_projects', JSON.stringify(projects));
                    return id;
                },
                LoadProject: async (id: number) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    return projects.find((p: any) => p.id === id);
                },
                DeleteProject: async (id: number) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    localStorage.setItem('mock_projects', JSON.stringify(projects.filter((p: any) => p.id !== id)));
                    return true;
                },
                UpdateProject: async (id: number, content: string) => {
                    const projects = JSON.parse(localStorage.getItem('mock_projects') || '[]');
                    const idx = projects.findIndex((p: any) => p.id === id);
                    if (idx !== -1) {
                        projects[idx].content = content;
                        projects[idx].updatedAt = Date.now() / 1000;
                        localStorage.setItem('mock_projects', JSON.stringify(projects));
                        return true;
                    }
                    return false;
                },
                GetHistoryLogs: async () => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    return history;
                },
                PushHistory: async (state: string) => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    const data = JSON.parse(state);
                    const index = history.length;
                    history.push({
                        index,
                        actionName: data.actionName,
                        timestamp: data.timestamp || Date.now()
                    });
                    localStorage.setItem('mock_history', JSON.stringify(history));
                },
                JumpToHistory: async (index: number) => {
                    const history = JSON.parse(localStorage.getItem('mock_history') || '[]');
                    return JSON.stringify(history[index]);
                },
                Undo: async () => null,
                Redo: async () => null,
                ExportProjectFile: async () => true,
                ImportProjectFile: async () => ""
            }
        }
    };
};
