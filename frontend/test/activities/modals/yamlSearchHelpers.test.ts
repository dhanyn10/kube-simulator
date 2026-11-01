import { describe, it, expect } from 'vitest';
import {
  buildSearchSegmentsForLine,
  parseYamlSearchLines,
  getMatchCountDisplay,
  getNextMatchIndex,
} from '@/activities/modals/yamlSearchHelpers';

describe('yamlSearchHelpers', () => {
  describe('buildSearchSegmentsForLine', () => {
    it('returns single unmatching segment when query is empty', () => {
      const res = buildSearchSegmentsForLine('apiVersion: v1', '', 0);
      expect(res.segments).toEqual([{ text: 'apiVersion: v1', isMatch: false }]);
      expect(res.nextMatchIndex).toBe(0);
    });

    it('returns single unmatching segment when query is not found', () => {
      const res = buildSearchSegmentsForLine('apiVersion: v1', 'service', 0);
      expect(res.segments).toEqual([{ text: 'apiVersion: v1', isMatch: false }]);
      expect(res.nextMatchIndex).toBe(0);
    });

    it('splits line into matching and non-matching segments case-insensitively', () => {
      const line = 'name: my-app-service';
      const res = buildSearchSegmentsForLine(line, 'APP', 5);
      expect(res.segments).toHaveLength(3);
      expect(res.segments[0]).toEqual({ text: 'name: my-', isMatch: false });
      expect(res.segments[1]).toEqual({ text: 'app', isMatch: true, matchIndex: 5 });
      expect(res.segments[2]).toEqual({ text: '-service', isMatch: false });
      expect(res.nextMatchIndex).toBe(6);
    });

    it('handles multiple matches within the same line', () => {
      const line = 'port: 80, targetPort: 80';
      const res = buildSearchSegmentsForLine(line, '80', 2);
      expect(res.segments).toHaveLength(4);
      expect(res.segments[1]).toEqual({ text: '80', isMatch: true, matchIndex: 2 });
      expect(res.segments[3]).toEqual({ text: '80', isMatch: true, matchIndex: 3 });
      expect(res.nextMatchIndex).toBe(4);
    });
  });

  describe('parseYamlSearchLines', () => {
    it('returns empty result when query is empty or whitespace', () => {
      const content = 'apiVersion: v1\nkind: Pod';
      expect(parseYamlSearchLines(content, '')).toEqual({ totalMatches: 0, lines: [] });
      expect(parseYamlSearchLines(content, '   ')).toEqual({ totalMatches: 0, lines: [] });
    });

    it('returns empty result when content is empty', () => {
      expect(parseYamlSearchLines('', 'pod')).toEqual({ totalMatches: 0, lines: [] });
    });

    it('parses multiple lines and counts matches correctly', () => {
      const content = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: pod-1';
      const result = parseYamlSearchLines(content, 'pod');
      expect(result.totalMatches).toBe(2);
      expect(result.lines).toHaveLength(4);
      // Line 1 (kind: Pod)
      expect(result.lines[1].segments.some((s) => s.isMatch && s.matchIndex === 0)).toBe(true);
      // Line 3 (  name: pod-1)
      expect(result.lines[3].segments.some((s) => s.isMatch && s.matchIndex === 1)).toBe(true);
    });
  });

  describe('getMatchCountDisplay', () => {
    it('returns empty string when hasQuery is false', () => {
      expect(getMatchCountDisplay(0, 0, false)).toBe('');
      expect(getMatchCountDisplay(5, 2, false)).toBe('');
    });

    it('returns "No matches" when totalMatches is 0 and hasQuery is true', () => {
      expect(getMatchCountDisplay(0, 0, true)).toBe('No matches');
    });

    it('returns "X of Y" when matches exist', () => {
      expect(getMatchCountDisplay(5, 0, true)).toBe('1 of 5');
      expect(getMatchCountDisplay(5, 3, true)).toBe('4 of 5');
    });
  });

  describe('getNextMatchIndex', () => {
    it('returns 0 when total is 0 or negative', () => {
      expect(getNextMatchIndex(0, 0, 1)).toBe(0);
      expect(getNextMatchIndex(2, -1, 1)).toBe(0);
    });

    it('advances forward with wrapping', () => {
      expect(getNextMatchIndex(0, 3, 1)).toBe(1);
      expect(getNextMatchIndex(1, 3, 1)).toBe(2);
      expect(getNextMatchIndex(2, 3, 1)).toBe(0);
    });

    it('navigates backward with wrapping', () => {
      expect(getNextMatchIndex(0, 3, -1)).toBe(2);
      expect(getNextMatchIndex(2, 3, -1)).toBe(1);
      expect(getNextMatchIndex(1, 3, -1)).toBe(0);
    });
  });
});
