import { HistoryLog, Project } from "./types";

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

interface WailsApp {
  Greet(name: string): Promise<string>;
  PushHistory(state: string): Promise<void>;
  Undo(): Promise<string>;
  Redo(): Promise<string>;
  JumpToHistory(index: number): Promise<string>;
  GetHistoryLogs(): Promise<HistoryLog[]>;
  SaveProject(name: string, content: string): Promise<number>;
  UpdateProject(id: number, content: string): Promise<boolean>;
  ExportProjectFile(name: string, canvasContent: string, yamlContent: string): Promise<boolean>;
  ImportProjectFile(): Promise<string>;
  GetProjects(): Promise<Project[]>;
  LoadProject(id: number): Promise<Project>;
  DeleteProject(id: number): Promise<boolean>;
  SaveSetting(key: string, value: string): Promise<boolean>;
  GetSetting(key: string): Promise<string>;
  MinimizeWindow(): Promise<void>;
  MaximizeWindow(): Promise<void>;
  CloseWindow(): Promise<void>;
}

declare global {
  interface Window {
    go: {
      main: {
        App: WailsApp;
      };
    };
    runtime: {
      EventsEmit(eventName: string, ...args: any[]): void;
      EventsOn(eventName: string, callback: (...args: any[]) => void): void;
      WindowSetTitle(title: string): void;
      // Add other Wails runtime methods if needed
    };
  }
}
