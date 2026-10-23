export const RUNTIMES = {
  none: { label: 'None', frameworks: [] },
  php: { label: 'PHP', frameworks: ['Laravel', 'Symfony', 'WordPress', 'Slim'] },
  nodejs: { label: 'Node.js', frameworks: ['Express', 'NestJS', 'Next.js', 'Fastify'] },
  java: { label: 'Java', frameworks: ['Spring Boot', 'Quarkus', 'Micronaut'] },
  go: { label: 'Golang', frameworks: ['Gin', 'Echo', 'Fiber'] },
  python: { label: 'Python', frameworks: ['Django', 'FastAPI', 'Flask'] },
} as const;

export const WEBSERVERS = [{ id: 'none', label: 'None' }, { id: 'nginx', label: 'Nginx' }, { id: 'apache', label: 'Apache' }] as const;

export const CPU_OPTIONS = [
  { label: '100m', value: '100m' }, { label: '250m', value: '250m' }, { label: '500m', value: '500m' },
  { label: '1 Core', value: '1' }, { label: '2 Cores', value: '2' }
] as const;

export const MEMORY_OPTIONS = [
  { label: '128 Mi', value: '128Mi' }, { label: '256 Mi', value: '256Mi' }, { label: '512 Mi', value: '512Mi' },
  { label: '1 Gi', value: '1Gi' }, { label: '2 Gi', value: '2Gi' }
] as const;

export type RuntimeType = keyof typeof RUNTIMES;
export type WebserverType = typeof WEBSERVERS[number]['id'];

import { getImageCharacteristics, ImageCharacteristics } from '@/activities/ui/imageCharacteristicsHelpers';

export interface RegistryImageItem {
  name: string;
  desc: string;
  characteristics: ImageCharacteristics;
}

export const DEFAULT_REGISTRY_IMAGES: readonly RegistryImageItem[] = [
  { name: 'nginx:latest', desc: 'Official high-performance HTTP server & reverse proxy', characteristics: getImageCharacteristics('nginx:latest') },
  { name: 'redis:alpine', desc: 'In-memory data structure store, alpine edition', characteristics: getImageCharacteristics('redis:alpine') },
  { name: 'postgres:15-alpine', desc: 'Powerful, open-source object-relational database', characteristics: getImageCharacteristics('postgres:15-alpine') },
  { name: 'node:18-alpine', desc: 'JavaScript runtime built on Chrome\'s V8 engine', characteristics: getImageCharacteristics('node:18-alpine') },
  { name: 'python:3.11-slim', desc: 'Python programming language runtime environment', characteristics: getImageCharacteristics('python:3.11-slim') },
  { name: 'mysql:8.0', desc: 'Widely used open-source relational database management system', characteristics: getImageCharacteristics('mysql:8.0') },
  { name: 'golang:1.21-alpine', desc: 'Go programming language compiler and runtime', characteristics: getImageCharacteristics('golang:1.21-alpine') },
  { name: 'openjdk:17-jdk-slim', desc: 'Java Development Kit runtime environment', characteristics: getImageCharacteristics('openjdk:17-jdk-slim') },
  { name: 'nginx:alpine', desc: 'Nginx web server on lightweight Alpine Linux', characteristics: getImageCharacteristics('nginx:alpine') }
] as const;
