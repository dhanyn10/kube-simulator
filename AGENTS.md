# AI Agent Guidelines for Kube Simulator

## Code Quality & SonarQube Standards
- **React Component Keys**: Do not use raw Array index in React component `key` props (e.g. `key={index}`). Always use unique string IDs or composite keys (e.g., `key={`part-${part}-${index}`}`) to prevent React rendering bugs and satisfy SonarQube rules.
- **Cognitive Complexity**: All functions, methods, handlers, and React components must observe a maximum Cognitive Complexity limit of 15.
- **SonarQube Compliance**:
  - Do not use redundant empty object spreads.
  - Specify explicit `type` attributes on `<button>` elements (e.g., `type="button"`).
  - Use cryptographically safe random generator `safeRandom()` from `@/lib/utils` instead of `Math.random()`.
  - Use `window` instead of `globalThis` in frontend browser code.
  - Avoid regexes with backtracking risks; use bounded prefixes and `.slice()`.

## Testing
- Run Vitest tests with `cd frontend && pnpm test`.
- Run Go backend tests with `go test -v ./...`.
