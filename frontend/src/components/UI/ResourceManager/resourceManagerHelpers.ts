export const mapProjectNodes = (nodes: any[]): any[] => {
  return (nodes || []).map((n: any) => ({
    ...n,
    id: String(n.id),
    parentId: n.parentId ? String(n.parentId) : undefined
  }));
};

export const mapProjectEdges = (edges: any[]): any[] => {
  return (edges || []).map((e: any) => ({
    ...e,
    id: String(e.id),
    source: String(e.source),
    target: String(e.target),
    type: 'custom'
  }));
};

export const generateTimestampedProjectName = (): string => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dmyhis = `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `Project-${dmyhis}`;
};
