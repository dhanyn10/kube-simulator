# Frontend Styling Standards & Component CSS Architecture

This document establishes the styling standards and CSS architecture for React components in this project.

---

## 1. Core Principles

1. **Keep JSX Clean Without Over-Engineering**:
   - Extract CSS into a dedicated component CSS file **only when component styling is large, highly specific, or contains long repetitive utility class chains**.
   - Compact components with simple, concise inline utility classes (e.g. `WindowControls`, `SimulationControls`) **should remain inline** to avoid unnecessary boilerplate.
2. **Component Co-location**: Place component-specific CSS files alongside their corresponding TSX files when extracted (e.g. `TerminalPanel.tsx` -> `TerminalPanel.css`).
3. **Semantic Naming**: Use clear, component-prefixed CSS class names following the `.[component-name]-[element-name]` convention (e.g. `.terminal-panel-container`, `.sidebar-container`).
4. **Theme Support**: Utilize Tailwind utility tokens or CSS custom properties for seamless light and dark mode transitions (`.dark` / `colorMode`).

---

## 2. When to Extract CSS vs. Keep Inline

### Extract to a dedicated `.css` file when:
- **High Complexity / Large Scope**: Components with deep nested layout structures and extensive utility class chains (e.g. `TerminalPanel.tsx`, `RightSidebar.tsx`, `Sidebar.tsx`, `MenuBar.tsx`).
- **Repetitive Component Elements**: Component list items, cards, toolbar containers, or sticky pagination bars rendered repeatedly.

### Keep inline (Do NOT create a `.css` file) when:
- **Compact / Simple Controls**: Components with short, straightforward inline utilities (e.g. small icon button wrappers like `WindowControls.tsx` or `SimulationControls.tsx`).

---

## 3. Class Naming Convention

| Component | Extracted CSS File | Sample CSS Classes |
| :--- | :--- | :--- |
| `TerminalPanel.tsx` | `TerminalPanel.css` | `.terminal-panel-container`, `.terminal-toolbar`, `.terminal-pagination-bar` |
| `Sidebar.tsx` | `Sidebar.css` | `.sidebar-container`, `.sidebar-header-area`, `.sidebar-item-card` |
| `RightSidebar.tsx` | `RightSidebar.css` | `.right-sidebar-container`, `.right-sidebar-card`, `.right-sidebar-tab-bar` |
| `MenuBar.tsx` | `MenuBar.css` | `.menubar-container`, `.menubar-dropdown-panel`, `.menubar-dropdown-item` |

---

## 4. Maintenance Checklist

- [ ] Complex components with heavy styling have co-located `.css` files.
- [ ] Compact components keep styling simple and inline without over-engineering.
- [ ] Extracted CSS classes follow `.[component]-[element]` naming.
- [ ] All interactive buttons retain explicit `type="button"` attributes.
- [ ] Light and dark themes continue to transition smoothly.
- [ ] Unit tests (`pnpm vitest run`) pass cleanly.
