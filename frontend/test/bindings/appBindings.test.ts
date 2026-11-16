import { describe, it, expect, vi } from 'vitest';
import * as appBindings from '../../bindings/build-wails/app';
import { Call } from '@wailsio/runtime';

describe('Wails v3 Generated App Bindings', () => {
  it('invokes Call.ByID with correct identifiers for each exported binding function', async () => {
    const callSpy = vi.spyOn(Call, 'ByID');

    await appBindings.CalculateAppHeight(1080);
    expect(callSpy).toHaveBeenCalledWith(995818161, 1080);

    await appBindings.CheckForUpdates('1.0.0');
    expect(callSpy).toHaveBeenCalledWith(2675659504, '1.0.0');

    await appBindings.ClearAllAutosaves();
    expect(callSpy).toHaveBeenCalledWith(3829228188);

    await appBindings.CloseWindow();
    expect(callSpy).toHaveBeenCalledWith(3642446947);

    await appBindings.DeleteInternetProfile('custom');
    expect(callSpy).toHaveBeenCalledWith(4199442796, 'custom');

    await appBindings.DeleteProject(42);
    expect(callSpy).toHaveBeenCalledWith(3379369923, 42);

    await appBindings.ExportProjectFile('p1', '{}', '---');
    expect(callSpy).toHaveBeenCalledWith(4004121950, 'p1', '{}', '---');

    await appBindings.FetchDockerHubPopular();
    expect(callSpy).toHaveBeenCalledWith(1875874067);

    await appBindings.FetchDockerHubTags('nginx');
    expect(callSpy).toHaveBeenCalledWith(739209003, 'nginx');

    await appBindings.FileExists('/tmp/test');
    expect(callSpy).toHaveBeenCalledWith(2577714203, '/tmp/test');

    await appBindings.GenerateYaml('[]', '[]');
    expect(callSpy).toHaveBeenCalledWith(2553906425, '[]', '[]');

    await appBindings.GetAutosaveProfiles();
    expect(callSpy).toHaveBeenCalledWith(439603931);

    await appBindings.GetCurrentHistoryIndex();
    expect(callSpy).toHaveBeenCalledWith(3591036500);

    await appBindings.GetHistoryLogs();
    expect(callSpy).toHaveBeenCalledWith(1069874554);

    await appBindings.GetInternetProfiles();
    expect(callSpy).toHaveBeenCalledWith(3029177180);

    await appBindings.GetProjects();
    expect(callSpy).toHaveBeenCalledWith(540785005);

    await appBindings.GetSetting('theme');
    expect(callSpy).toHaveBeenCalledWith(48053349, 'theme');

    await appBindings.GetSystemInfo();
    expect(callSpy).toHaveBeenCalledWith(1347250254);

    await appBindings.GetSystemResources();
    expect(callSpy).toHaveBeenCalledWith(3108850015);

    await appBindings.GetTargetScreen([]);
    expect(callSpy).toHaveBeenCalledWith(3732947438, []);

    await appBindings.GetTargetScreenHeight([]);
    expect(callSpy).toHaveBeenCalledWith(780713317, []);

    await appBindings.Greet('Kube');
    expect(callSpy).toHaveBeenCalledWith(2659711170, 'Kube');

    await appBindings.ImportProjectFile();
    expect(callSpy).toHaveBeenCalledWith(76068231);

    await appBindings.JumpToHistory(2);
    expect(callSpy).toHaveBeenCalledWith(3262643732, 2);

    await appBindings.LoadProject(10);
    expect(callSpy).toHaveBeenCalledWith(2543493242, 10);

    await appBindings.MaximizeWindow();
    expect(callSpy).toHaveBeenCalledWith(92655239);

    await appBindings.MinimizeWindow();
    expect(callSpy).toHaveBeenCalledWith(1130157197);

    await appBindings.OpenFileFolder('/path/folder');
    expect(callSpy).toHaveBeenCalledWith(686216323, '/path/folder');

    await appBindings.OpenLogFile();
    expect(callSpy).toHaveBeenCalledWith(1954701323);

    await appBindings.PushHistory('state');
    expect(callSpy).toHaveBeenCalledWith(3948749391, 'state');

    await appBindings.Redo();
    expect(callSpy).toHaveBeenCalledWith(1931447713);

    await appBindings.SaveInternetProfile('prof', '{}');
    expect(callSpy).toHaveBeenCalledWith(1871457990, 'prof', '{}');

    await appBindings.SaveProject('name', 'content');
    expect(callSpy).toHaveBeenCalledWith(1642150229, 'name', 'content');

    await appBindings.SaveSetting('key', 'val');
    expect(callSpy).toHaveBeenCalledWith(577053244, 'key', 'val');

    await appBindings.SearchDockerHub('redis');
    expect(callSpy).toHaveBeenCalledWith(2826427320, 'redis');

    await appBindings.SetInitialFile('/path/file.infra');
    expect(callSpy).toHaveBeenCalledWith(2025817103, '/path/file.infra');

    await appBindings.Undo();
    expect(callSpy).toHaveBeenCalledWith(2201783959);

    await appBindings.UpdateProject(5, 'new-content');
    expect(callSpy).toHaveBeenCalledWith(1522260689, 5, 'new-content');

    await appBindings.WriteLog('app', 'info', 'message');
    expect(callSpy).toHaveBeenCalledWith(1800746550, 'app', 'info', 'message');
  });
});
