import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import {
  RecentProjectsLoadingRow,
  RecentProjectsEmptyRow,
  RecentProjectsTableRow,
  renderRecentProjectsBody,
  getRowHighlightClass,
  getProjectIconBadgeClass,
  ProjectFileIcon,
} from '@/components/Layout/RecentProjectsRow';
import { RecentFileItem } from '@/activities/layout/fileBackstageHelpers';

describe('RecentProjectsRow components & helpers', () => {
  const dummyFile: RecentFileItem = {
    id: 101,
    name: 'Sample Architecture',
    location: '~/.kube-simulator/projects/sample.infra',
    fullPath: '/full/path/sample.infra',
    updatedAt: '01/01/2026 10:00:00',
    isAutosave: false,
  };

  const autosaveFile: RecentFileItem = {
    id: 'autosave-123',
    name: 'autosave-123',
    location: '~/.kube-simulator/autosaves/autosave-123.infra',
    fullPath: '/full/path/autosave-123.infra',
    updatedAt: '01/01/2026 11:00:00',
    isAutosave: true,
  };

  it('renders RecentProjectsLoadingRow correctly with custom and default testId', () => {
    const { rerender } = render(
      <table>
        <tbody>
          <RecentProjectsLoadingRow isDark={true} />
        </tbody>
      </table>
    );
    expect(screen.getByTestId('recent-files-loading')).toBeInTheDocument();
    expect(screen.getByText('Reading current profiles...')).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <RecentProjectsLoadingRow isDark={false} testId="custom-loading-id" />
        </tbody>
      </table>
    );
    expect(screen.getByTestId('custom-loading-id')).toBeInTheDocument();
  });

  it('renders RecentProjectsEmptyRow correctly', () => {
    render(
      <table>
        <tbody>
          <RecentProjectsEmptyRow />
        </tbody>
      </table>
    );
    expect(screen.getByText('No recent files or auto-saved profiles found')).toBeInTheDocument();
  });

  it('renders RecentProjectsTableRow with normal project, active badge, and triggers actions', () => {
    const onContextMenu = vi.fn();
    const onRestoreFile = vi.fn();

    render(
      <table>
        <tbody>
          <RecentProjectsTableRow
            file={dummyFile}
            isDark={true}
            isContextMenuActive={true}
            isCurrentActive={true}
            isFileLoading={false}
            onContextMenu={onContextMenu}
            onRestoreFile={onRestoreFile}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('Sample Architecture')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    const row = screen.getByText('Sample Architecture').closest('tr')!;
    expect(row.className).toContain('bg-blue-900/40');

    fireEvent.contextMenu(row);
    expect(onContextMenu).toHaveBeenCalledWith(expect.any(Object), dummyFile);

    fireEvent.doubleClick(row);
    expect(onRestoreFile).toHaveBeenCalledWith(dummyFile);

    const openBtn = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(openBtn);
    expect(onRestoreFile).toHaveBeenCalledWith(dummyFile);
  });

  it('renders RecentProjectsTableRow with autosave project and loading spinner state', () => {
    const onContextMenu = vi.fn();
    const onRestoreFile = vi.fn();

    render(
      <table>
        <tbody>
          <RecentProjectsTableRow
            file={autosaveFile}
            isDark={false}
            isContextMenuActive={false}
            isCurrentActive={false}
            isFileLoading={true}
            onContextMenu={onContextMenu}
            onRestoreFile={onRestoreFile}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('autosave-123')).toBeInTheDocument();
    expect(screen.getByText('Auto-Save')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    const row = screen.getByText('autosave-123').closest('tr')!;
    expect(row.className).toContain('opacity-75 pointer-events-none');
  });

  it('renders renderRecentProjectsBody correctly for loading, empty, and populated states', () => {
    const onContextMenu = vi.fn();
    const onRestoreFile = vi.fn();

    // 1. Loading state
    const { rerender } = render(
      <table>
        <tbody>
          {renderRecentProjectsBody({
            isLoading: true,
            recentFiles: [],
            isDark: true,
            onContextMenu,
            onRestoreFile,
            loadingTestId: 'test-loading',
          })}
        </tbody>
      </table>
    );
    expect(screen.getByTestId('test-loading')).toBeInTheDocument();

    // 2. Empty state
    rerender(
      <table>
        <tbody>
          {renderRecentProjectsBody({
            isLoading: false,
            recentFiles: [],
            isDark: true,
            onContextMenu,
            onRestoreFile,
          })}
        </tbody>
      </table>
    );
    expect(screen.getByText('No recent files or auto-saved profiles found')).toBeInTheDocument();

    // 3. Populated state
    rerender(
      <table>
        <tbody>
          {renderRecentProjectsBody({
            isLoading: false,
            recentFiles: [dummyFile, autosaveFile],
            isDark: false,
            currentProjectId: 101,
            activeContextId: 'autosave-123',
            loadingFileId: null,
            onContextMenu,
            onRestoreFile,
          })}
        </tbody>
      </table>
    );
    expect(screen.getByText('Sample Architecture')).toBeInTheDocument();
    expect(screen.getByText('autosave-123')).toBeInTheDocument();
  });

  it('evaluates helper functions correctly', () => {
    expect(getRowHighlightClass(false, true)).toBe('');
    expect(getRowHighlightClass(true, true)).toContain('bg-blue-900/40');
    expect(getRowHighlightClass(true, false)).toContain('bg-blue-100/80');

    expect(getProjectIconBadgeClass(true, false)).toContain('bg-blue-500/20');
    expect(getProjectIconBadgeClass(false, true)).toContain('bg-amber-500/10');
    expect(getProjectIconBadgeClass(false, false)).toContain('bg-blue-500/10');
  });

  it('renders K8s resource badges for projects with nodes or content', () => {
    const fileWithNodes: RecentFileItem = {
      id: 201,
      name: 'E-Commerce Cluster',
      location: '~/.kube-simulator/projects/project_201.infra',
      fullPath: '/full/path/project_201.infra',
      updatedAt: '01/01/2026 12:00:00',
      nodes: [
        { id: 'p1', type: 'Pod', data: {} },
        { id: 's1', type: 'Service', data: { serviceType: 'ClusterIP' } },
        { id: 'i1', type: 'Ingress', data: {} },
      ],
    };

    const fileWithContent: RecentFileItem = {
      id: 202,
      name: 'Database Cluster',
      location: '~/.kube-simulator/projects/project_202.infra',
      fullPath: '/full/path/project_202.infra',
      updatedAt: '01/01/2026 12:30:00',
      content: JSON.stringify({
        nodes: [
          { id: 'sts1', type: 'StatefulSet', data: { resourceLimits: [{ id: 'lim1' }] } },
          { id: 'pvc1', type: 'PVC', data: {} },
        ],
      }),
    };

    const { rerender } = render(
      <table>
        <tbody>
          <RecentProjectsTableRow
            file={fileWithNodes}
            isDark={true}
            isContextMenuActive={false}
            isCurrentActive={false}
            onContextMenu={vi.fn()}
            onRestoreFile={vi.fn()}
          />
        </tbody>
      </table>
    );

    const badgesContainer = screen.getByTestId('project-badges-201');
    expect(badgesContainer).toBeInTheDocument();
    expect(badgesContainer).toHaveTextContent('Ingress');
    expect(badgesContainer).toHaveTextContent('Service');
    expect(badgesContainer).toHaveTextContent('Pod');
    expect(badgesContainer).not.toHaveTextContent('×');

    // Rerender with fileWithContent (StatefulSet + ResourceLimit + PVC)
    rerender(
      <table>
        <tbody>
          <RecentProjectsTableRow
            file={fileWithContent}
            isDark={false}
            isContextMenuActive={false}
            isCurrentActive={false}
            onContextMenu={vi.fn()}
            onRestoreFile={vi.fn()}
          />
        </tbody>
      </table>
    );

    const badgesContainer2 = screen.getByTestId('project-badges-202');
    expect(badgesContainer2).toBeInTheDocument();
    expect(badgesContainer2).toHaveTextContent('StatefulSet');
    expect(badgesContainer2).toHaveTextContent('ResourceLimit');
    expect(badgesContainer2).toHaveTextContent('PVC');
    expect(badgesContainer2).not.toHaveTextContent('×');
  });

  it('renders ProjectFileIcon variants correctly', () => {
    const { container, rerender } = render(<ProjectFileIcon isFileLoading={true} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    rerender(<ProjectFileIcon isFileLoading={false} isAutosave={true} />);
    expect(container.querySelector('svg')).toBeInTheDocument();

    rerender(<ProjectFileIcon isFileLoading={false} isAutosave={false} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
