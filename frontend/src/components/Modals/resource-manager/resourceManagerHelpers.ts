/**
 * Maps raw backend project node objects into React Flow node structures with stringified IDs.
 *
 * @param nodes Raw node array from saved project payload
 * @returns Array of mapped node objects with stringified ID references
 */
export const mapProjectNodes = (nodes: any[]): any[] => {
  return (nodes || []).map((n: any) => ({
    ...n,
    id: String(n.id),
    parentId: n.parentId ? String(n.parentId) : undefined
  }));
};

/**
 * Maps raw backend project edge objects into custom React Flow edges with stringified IDs.
 *
 * @param edges Raw edge array from saved project payload
 * @returns Array of mapped edge objects with 'custom' edge rendering type
 */
export const mapProjectEdges = (edges: any[]): any[] => {
  return (edges || []).map((e: any) => ({
    ...e,
    id: String(e.id),
    source: String(e.source),
    target: String(e.target),
    type: 'custom'
  }));
};

/**
 * Generates a default timestamped architecture project name in 'Project-DDMMYYYYHHMMSS' format.
 *
 * @returns Formatted timestamped default project name string
 */
export const generateTimestampedProjectName = (): string => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dmyhis = `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `Project-${dmyhis}`;
};
