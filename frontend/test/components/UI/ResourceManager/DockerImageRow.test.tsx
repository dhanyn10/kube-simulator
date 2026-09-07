import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import {
  DockerImageCard,
  LocalImageRow,
  parseDockerResults,
} from '@/components/UI/ResourceManager/DockerImageRow';

describe('DockerImageRow components and helpers', () => {
  describe('DockerImageCard', () => {
    it('renders card in dark and light modes and handles click', () => {
      const onClick = vi.fn();
      const img = { name: 'nginx:latest', desc: 'Official Nginx Docker image' };

      const { rerender } = render(
        <DockerImageCard img={img} colorMode="dark" onClick={onClick} />
      );

      expect(screen.getByText('nginx:latest')).toBeInTheDocument();
      expect(screen.getByText('Official Nginx Docker image')).toBeInTheDocument();
      expect(screen.getByText('PUBLIC REGISTRY')).toBeInTheDocument();

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);

      // Render in light mode
      rerender(<DockerImageCard img={img} colorMode="light" onClick={onClick} />);
      expect(screen.getByText('nginx:latest')).toBeInTheDocument();
    });
  });

  describe('LocalImageRow', () => {
    it('renders local image row in dark and light modes and handles delete', () => {
      const onDelete = vi.fn();

      const { rerender } = render(
        <LocalImageRow img="redis:7-alpine" onDelete={onDelete} colorMode="dark" />
      );

      expect(screen.getByText('redis:7-alpine')).toBeInTheDocument();
      expect(screen.getByText('LOCAL CACHE')).toBeInTheDocument();

      const deleteBtn = screen.getByTitle('Delete image option');
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledWith('redis:7-alpine');

      // Render in light mode
      rerender(<LocalImageRow img="redis:7-alpine" onDelete={onDelete} colorMode="light" />);
      expect(screen.getByText('redis:7-alpine')).toBeInTheDocument();
    });
  });

  describe('parseDockerResults', () => {
    it('parses search results with repo_name and short_description', () => {
      const rawJson = JSON.stringify({
        results: [
          { repo_name: 'library/ubuntu', short_description: 'Ubuntu base image' },
          { repo_name: 'library/alpine' }, // missing description
        ],
      });

      const parsed = parseDockerResults(rawJson, true);
      expect(parsed).toEqual([
        { name: 'library/ubuntu', desc: 'Ubuntu base image' },
        { name: 'library/alpine', desc: '' },
      ]);
    });

    it('parses standard repository tags with name and description, and handles missing results key', () => {
      const rawJsonStandard = JSON.stringify({
        results: [
          { name: 'latest', description: 'Latest tag' },
          { name: 'alpine', description: null },
        ],
      });

      const parsedStandard = parseDockerResults(rawJsonStandard, false);
      expect(parsedStandard).toEqual([
        { name: 'latest', desc: 'Latest tag' },
        { name: 'alpine', desc: '' },
      ]);

      // JSON without results key
      const rawEmpty = JSON.stringify({});
      expect(parseDockerResults(rawEmpty, false)).toEqual([]);
    });
  });
});
