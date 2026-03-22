# Design Decisions

Key UI/UX decisions made during development.

## Color & Theme

### Terminal/hacker aesthetic (2026-03-22)
- Pure black (#000000) background, #0a0a0a cards
- Emerald (#10b981) primary accent
- Inspired by ai-news project
- Text: #e0e0e0 primary, #888888 secondary, #555555 muted
- Borders: #1f1f1f subtle

### Previous theme: Lunar Control (2026-03-21)
- Was teal primary on dark gray — felt too generic SaaS
- **Updated:** Switched to terminal/hacker style for consistency with developer audience

## Typography

### JetBrains Mono everywhere
- Monospace font for both body and code
- Reinforces terminal aesthetic
- Weight: 400-700

## Layout

### IDE-like 3-panel layout
- Left: sidebar (projects)
- Center: dashboard + boss terminal (tabs: Dashboard | Files)
- Right: agent panel (role tabs + pane view)
- All panels collapsible/resizable

### Focus mode
- Toggle button expands agent panel full width, hides dashboard
- For when user only wants to monitor agents

## Animation Philosophy

- Minimal animations — status-pulse for active indicators only
- Sharp 2px border-radius (not rounded)
- Subtle hover: background color change, not transform

## File Icons

- Lucide React icons (consistent with shadcn/ui)
- Color-coded by file type (blue=TS, yellow=JS, green=PY, etc.)
