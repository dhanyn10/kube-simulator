/**
 * @file mocks.test.ts
 * @description Unit tests for Wails browser mocks (`frontend/src/lib/mocks.ts`).
 *
 * Why `mocks.ts` needs unit testing:
 * 1. API Contract Verification: `mocks.ts` provides mock implementations for Wails backend Go methods (`go.main.App`)
 *    and runtime events (`runtime.EventsOn`, `LogInfo`, etc.) when running in browser mode. Testing ensures the mock
 *    interface matches expected signatures and returns standard data structures without breaking frontend components.
 * 2. State & Persistence Integrity: It manages `localStorage` operations for simulated projects (`mock_projects`) and
 *    history logs (`mock_history`). Testing verifies CRUD logic, correct JSON serialization/deserialization, timestamp
 *    handling, and filtering/updating edge cases.
 * 3. Development & Test Stability: In browser or testing environments where the compiled Wails Go binary is absent,
 *    frontend components rely on these mocks. Ensuring `mocks.ts` behaves consistently prevents false failure cascades
 *    in UI tests.
 * 4. Exception Safety: Tests verify that logging fallbacks (`LogPrint`, `LogError`, `LogFatal`) safely route messages
 *    to original console methods without throwing unhandled errors or crashing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { initWailsMocks } from "@/lib/mocks";

describe("initWailsMocks", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).go;
    delete (window as any).runtime;
    (window as any)._originalConsoleLog = vi.fn();
    (window as any)._originalConsoleWarn = vi.fn();
    (window as any)._originalConsoleError = vi.fn();
  });

  it("does nothing if window.go is already defined", () => {
    (window as any).go = { already: "exists" };
    initWailsMocks();
    expect((window as any).runtime).toBeUndefined();
  });

  it("initializes runtime and go mocks when window.go is not defined", async () => {
    initWailsMocks();

    expect((window as any).runtime).toBeDefined();
    expect((window as any).go).toBeDefined();

    // Test runtime methods
    const runtime = (window as any).runtime;
    const unsub1 = runtime.EventsOnMultiple("test-event", vi.fn(), 5);
    expect(typeof unsub1).toBe("function");
    unsub1();

    const unsub2 = runtime.EventsOn("test-event", vi.fn());
    expect(typeof unsub2).toBe("function");
    unsub2();

    runtime.EventsOff();
    runtime.EventsEmit();

    runtime.LogPrint("print msg");
    runtime.LogTrace("trace msg");
    runtime.LogDebug("debug msg");
    runtime.LogInfo("info msg");
    runtime.LogWarning("warn msg");
    runtime.LogError("error msg");
    runtime.LogFatal("fatal msg");

    expect((window as any)._originalConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("print msg")
    );
    expect((window as any)._originalConsoleWarn).toHaveBeenCalledWith("warn msg");
    expect((window as any)._originalConsoleError).toHaveBeenCalledWith("error msg");
    expect((window as any)._originalConsoleError).toHaveBeenCalledWith("[FATAL] fatal msg");

    // Test App methods
    const app = (window as any).go.main.App;

    // GetProjects on empty
    let projects = await app.GetProjects();
    expect(projects).toEqual([]);

    // SaveProject
    const id1 = await app.SaveProject("Project 1", '{"nodes":[]}');
    expect(typeof id1).toBe("number");

    projects = await app.GetProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Project 1");

    // LoadProject
    const loaded = await app.LoadProject(id1);
    expect(loaded.name).toBe("Project 1");

    // Load non-existent project
    const notFound = await app.LoadProject(99999);
    expect(notFound).toBeUndefined();

    // UpdateProject
    const updatedSuccess = await app.UpdateProject(id1, '{"nodes":[{"id":"1"}]}');
    expect(updatedSuccess).toBe(true);

    const updatedFail = await app.UpdateProject(99999, "{}");
    expect(updatedFail).toBe(false);

    // DeleteProject
    const deleted = await app.DeleteProject(id1);
    expect(deleted).toBe(true);
    expect(await app.GetProjects()).toEqual([]);

    // GetHistoryLogs and GetCurrentHistoryIndex on empty
    let history = await app.GetHistoryLogs();
    expect(history).toEqual([]);
    expect(await app.GetCurrentHistoryIndex()).toBe(0);

    // PushHistory with timestamp
    await app.PushHistory(JSON.stringify({ actionName: "Add Node", timestamp: 123456789 }));
    history = await app.GetHistoryLogs();
    expect(history).toHaveLength(1);
    expect(history[0].actionName).toBe("Add Node");
    expect(await app.GetCurrentHistoryIndex()).toBe(0);

    // PushHistory without timestamp (fallback to Date.now())
    await app.PushHistory(JSON.stringify({ actionName: "Delete Node" }));
    history = await app.GetHistoryLogs();
    expect(history).toHaveLength(2);
    expect(history[1].timestamp).toBeGreaterThan(0);
    expect(await app.GetCurrentHistoryIndex()).toBe(1);

    // JumpToHistory
    const targetState = await app.JumpToHistory(0);
    expect(JSON.parse(targetState)).toEqual({
      index: 0,
      actionName: "Add Node",
      timestamp: 123456789,
    });

    // Undo / Redo / Export / Import / Settings
    expect(await app.Undo()).toBeNull();
    expect(await app.Redo()).toBeNull();
    expect(await app.ExportProjectFile()).toBe(true);
    expect(await app.ImportProjectFile()).toBe("");
    expect(await app.GetSetting()).toBe("");
    expect(await app.SaveSetting()).toBe(true);

    // GetSystemResources & GetSystemInfo
    const sysRes = await app.GetSystemResources();
    expect(sysRes).toEqual({
      cpuCores: 8,
      cpuUsage: 25,
      totalMemoryGB: 16,
      freeMemoryGB: 12,
    });

    const sysInfo = await app.GetSystemInfo();
    expect(sysInfo).toEqual({
      os: "windows",
      arch: "amd64",
      goVersion: "go1.25.0",
      version: "0.3.0",
    });

    // Window controls
    await app.MinimizeWindow();
    await app.MaximizeWindow();
    await app.CloseWindow();
    expect((window as any)._originalConsoleLog).toHaveBeenCalledWith("Minimize Window");
  });
});
