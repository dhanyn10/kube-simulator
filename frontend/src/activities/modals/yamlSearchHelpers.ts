export interface YamlSearchSegment {
  text: string;
  isMatch: boolean;
  matchIndex?: number;
}

export interface YamlSearchLine {
  lineIndex: number;
  segments: YamlSearchSegment[];
}

export interface YamlSearchResult {
  totalMatches: number;
  lines: YamlSearchLine[];
}

/**
 * Splits a single line into plain text segments and match segments based on case-insensitive query.
 * Avoids regular expressions to prevent any ReDoS or special character escaping issues.
 */
export const buildSearchSegmentsForLine = (
  line: string,
  query: string,
  startMatchIndex: number
): { segments: YamlSearchSegment[]; nextMatchIndex: number } => {
  if (!query) {
    return { segments: [{ text: line, isMatch: false }], nextMatchIndex: startMatchIndex };
  }

  const lowerLine = line.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryLen = query.length;
  const segments: YamlSearchSegment[] = [];
  let curIndex = 0;
  let matchIndex = startMatchIndex;

  while (curIndex < line.length) {
    const foundIndex = lowerLine.indexOf(lowerQuery, curIndex);
    if (foundIndex === -1) {
      segments.push({ text: line.slice(curIndex), isMatch: false });
      break;
    }
    if (foundIndex > curIndex) {
      segments.push({ text: line.slice(curIndex, foundIndex), isMatch: false });
    }
    segments.push({
      text: line.slice(foundIndex, foundIndex + queryLen),
      isMatch: true,
      matchIndex: matchIndex++,
    });
    curIndex = foundIndex + queryLen;
  }

  return { segments, nextMatchIndex: matchIndex };
};

/**
 * Parses full YAML content into lines with search segments and total match count.
 */
export const parseYamlSearchLines = (content: string, query: string): YamlSearchResult => {
  const trimmed = query.trim();
  if (!trimmed || !content) {
    return { totalMatches: 0, lines: [] };
  }

  const rawLines = content.split('\n');
  let currentMatchIndex = 0;

  const lines: YamlSearchLine[] = rawLines.map((line, lineIndex) => {
    const { segments, nextMatchIndex } = buildSearchSegmentsForLine(line, trimmed, currentMatchIndex);
    currentMatchIndex = nextMatchIndex;
    return { lineIndex, segments };
  });

  return { totalMatches: currentMatchIndex, lines };
};

/**
 * Formats match status string (e.g. "2 of 5" or "No matches").
 */
export const getMatchCountDisplay = (totalMatches: number, activeIndex: number, hasQuery: boolean): string => {
  if (!hasQuery) return '';
  if (totalMatches === 0) return 'No matches';
  return `${activeIndex + 1} of ${totalMatches}`;
};

/**
 * Calculates next or previous match index safely wrapping around.
 */
export const getNextMatchIndex = (current: number, total: number, step: 1 | -1): number => {
  if (total <= 0) return 0;
  return (current + step + total) % total;
};
