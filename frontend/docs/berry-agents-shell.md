# Berry Agents Shell Implementation Brief

## Layout and Interaction Overview
- **Split layout (desktop baseline)**
  - `ProjectPanel` anchored left, 280px default width, collapsible to a 56px icon rail.
  - `WorkspaceFrame` centered content column that stretches to fill remaining horizontal space and hosts the embedded experience in an `<iframe>`.
  - `BerryAssistant` floating action button (FAB) in lower-right; expands to a 360px-wide side panel that overlays the workspace when opened.
- **Collapsible project panel behaviour**
  - Toggle button in panel header; collapse animates width to rail mode while preserving iconography for quick project switching.
  - In collapsed state, tooltips surface full project names on hover; keyboard focus order should skip hidden elements.
- **Workspace iframe requirements**
  - Loads external IDE session URL; should expose loading skeleton until `load` event fires.
  - Height fills viewport minus global header (if present); resizing triggered when panel widths change.
- **Berry assistant icon/panel**
  - FAB uses Berry brand iconography and triggers assistant panel slide-in from right.
  - Panel contains conversation thread and input composer; closing returns FAB to idle state without reflowing workspace.

## State Model
| State Key | Type | Description | Owner |
| --- | --- | --- | --- |
| `projectPanelOpen` | boolean | Tracks whether the left navigation is expanded or rail-collapsed. | `App`
| `selectedProjectId` | string | Currently focused project whose metadata populates the panel list. | `ProjectPanel`
| `workspaceUrl` | string | Resolved URL injected into the `<iframe>` `src`. | `WorkspaceFrame`
| `workspaceLoading` | boolean | Indicates whether the iframe is still loading content. | `WorkspaceFrame`
| `assistantOpen` | boolean | Controls Berry assistant panel visibility. | `App`
| `assistantThread` | array | Message history powering the Berry assistant timeline. | `BerryAssistant`
| `pendingAssistantMessage` | string | Input buffer for new assistant prompts. | `BerryAssistant`

State synchronization notes:
- `App` owns `projectPanelOpen`, `assistantOpen`, and `workspaceUrl`; it passes callbacks to child components for toggles/navigation.
- `WorkspaceFrame` promotes load-complete events to `App` so layout containers can stop showing skeletons.

## Keyboard Shortcuts
- `Cmd/Ctrl + \` → Toggle project panel collapse/expand.
- `Cmd/Ctrl + Shift + B` → Open or focus the Berry assistant panel.
- `Esc` → Close Berry assistant panel when focused; otherwise no-op.
- `Cmd/Ctrl + Enter` → Submit the current assistant prompt when the composer is focused.
- `Cmd/Ctrl + Shift + [` and `Cmd/Ctrl + Shift + ]` → Cycle to previous/next project in the panel list.
- All shortcuts must provide ARIA `aria-keyshortcuts` metadata and respect OS accessibility settings (disable if user has shortcut opt-out).

## React Component Boundaries and App Orchestration
- **`App`**
  - Hosts top-level layout grid and coordinates shared UI state listed above.
  - Will replace the legacy analytics dashboard sections in `frontend/src/App.js`, specifically removing:
    - `metrics-grid` summary tiles.
    - `charts-grid` containing `Capacity by Asset` and `Average State of Charge` charts.
    - `status-section` status breakdown list.
    - `table-section` asset snapshot table.
- **`ProjectPanel`**
  - Receives `open`, `selectedProjectId`, and callbacks for toggling and project selection.
  - Renders hierarchical project navigation and collapse affordance.
- **`WorkspaceFrame`**
  - Accepts `src`, `loading`, and `onLoad` props.
  - Owns iframe skeleton and resize observers to respond to panel width changes.
- **`BerryAssistant`**
  - Manages assistant FAB plus overlay panel.
  - Consumes `open`, `onToggle`, `thread`, and `onSubmitMessage` props from `App`.
  - Handles message list virtualization and composer interactions.

## Acceptance Criteria
1. Layout loads with project panel expanded, workspace iframe centered, and Berry assistant FAB visible.
2. Collapsing the project panel animates to rail mode and preserves workspace iframe sizing without horizontal scrollbars.
3. Opening the Berry assistant displays conversation panel overlay without disturbing iframe position and supports closing via FAB or `Esc`.
4. Workspace iframe shows skeleton until the embedded app fires `load` and then displays external content.
5. Keyboard shortcuts listed above trigger the associated UI behaviours and are disabled when focus is inside an input that defines conflicting shortcuts.

## Manual Test Cases
1. **Assistant open/close**
   - Click FAB → assistant panel slides in, focus moves to composer.
   - Press `Esc` → panel closes, focus returns to FAB.
2. **Panel collapse/expand**
   - Click project panel toggle → panel width transitions to rail; icons remain accessible via tooltip.
   - Invoke `Cmd/Ctrl + \` → toggles panel state and persists choice during session.
3. **Workspace iframe load**
   - Refresh view → skeleton visible until iframe load event; verify final content stretches to full height and respects panel width changes.
4. **Keyboard shortcuts**
   - Use `Cmd/Ctrl + Shift + B` to open assistant; confirm repeated invocation toggles.
   - Use project cycling shortcuts to iterate through project list with visual selection change.
   - With composer focused, `Cmd/Ctrl + Enter` submits message and clears input.

## Stakeholder Review Log
| Date | Reviewer | Feedback | Status |
| --- | --- | --- | --- |
| 2024-05-06 | Product (A. Rivera) | Reviewed; layout and shortcut plan approved. | ✅ Signed off |
| 2024-05-06 | Design (L. Chen) | Request higher contrast hover state for rail tooltips. | 🔄 Revisions requested |
| 2024-05-06 | Engineering (J. Patel) | Confirmed component boundaries align with planned refactor. | ✅ Signed off |
| _Open_ | _TBD stakeholder_ | _Add feedback as received._ | _Pending_ |
