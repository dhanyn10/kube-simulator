export const RUNTIMES = {
  none: { label: 'None', frameworks: [] },
  php: { label: 'PHP', frameworks: ['Laravel', 'Symfony', 'WordPress', 'Slim'] },
  nodejs: { label: 'Node.js', frameworks: ['Express', 'NestJS', 'Next.js', 'Fastify'] },
  java: { label: 'Java', frameworks: ['Spring Boot', 'Quarkus', 'Micronaut'] },
  go: { label: 'Golang', frameworks: ['Gin', 'Echo', 'Fiber'] },
  python: { label: 'Python', frameworks: ['Django', 'FastAPI', 'Flask'] },
} as const;

export const WEBSERVERS = [
  { id: 'none', label: 'None' },
  { id: 'nginx', label: 'Nginx' },
  { id: 'apache', label: 'Apache' },
] as const;

export const CPU_OPTIONS = [
  { label: '100m', value: '100m' },
  { label: '250m', value: '250m' },
  { label: '500m', value: '500m' },
  { label: '1 Core', value: '1' },
  { label: '2 Cores', value: '2' },
] as const;

export const MEMORY_OPTIONS = [
  { label: '128 Mi', value: '128Mi' },
  { label: '256 Mi', value: '256Mi' },
  { label: '512 Mi', value: '512Mi' },
  { label: '1 Gi', value: '1Gi' },
  { label: '2 Gi', value: '2Gi' },
] as const;

export type RuntimeType = keyof typeof RUNTIMES;
export type WebserverType = typeof WEBSERVERS[number]['id'];

export const DEFAULT_REGISTRY_IMAGES = [
  { name: 'nginx:latest', desc: 'Official high-performance HTTP server & reverse proxy' },
  { name: 'redis:alpine', desc: 'In-memory data structure store, alpine edition' },
  { name: 'postgres:15-alpine', desc: 'Powerful, open-source object-relational database' },
  { name: 'node:18-alpine', desc: 'JavaScript runtime built on Chrome\'s V8 engine' },
  { name: 'python:3.11-slim', desc: 'Python programming language runtime environment' },
  { name: 'mysql:8.0', desc: 'Widely used open-source relational database management system' },
  { name: 'golang:1.21-alpine', desc: 'Go programming language compiler and runtime' },
  { name: 'openjdk:17-jdk-slim', desc: 'Java Development Kit runtime environment' },
  { name: 'nginx:alpine', desc: 'Nginx web server on lightweight Alpine Linux' }
] as const;
