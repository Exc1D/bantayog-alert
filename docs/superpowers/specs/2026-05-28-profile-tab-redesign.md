# Profile Tab Redesign

**Date:** 2026-05-28
**Status:** Approved design

## Problem

The Profile tab scored 25/40 on heuristic evaluation. The page conflates two distinct user tasks — stats viewing and availability control — with neither given clear visual priority. It also carries dead weight sections (Personal Bests, Resolved by Type) that add cognitive load without serving the primary use case.

## Design Decision

**Primary purpose:** View personal stats and history. Availability control is secondary.

**Layout chosen:** Inline Status Switcher (Option C) — status chips embedded directly in the profile card, eliminating the standalone availability panel.

## Sections (top to bottom)

### 1. Profile Card (identity + status)

- Avatar (initials fallback when no photo)
- Name, agency, role
- Specialization tag chips
- **Inline segmented control:** Available / Unavailable / Off Duty
  - Available = 1 tap -> immediate `setAvailability('available')`
  - Non-available = reveal reason dropdown + "Apply Status" button
- Flat card (no gradient decoration)

### 2. KPI Stats Row

- 3 stat cards: Total Dispatches / Resolution Rate / Avg Response Time
- Flat cards, subtle border
- Color coding: green for positive rates

### 3. Utility Links

- Account Settings
- Report an Issue
- Sign Out (red-urgent color for destructive action)

## Removed Sections

- **Resolved by Type (mastery bars)** — removed per user decision
- **Personal Bests** (fastest response, most dispatches in a week) — removed per user decision

## Data Sources (unchanged)

- `useResponderProfile` — identity, specializations
- `useDispatchHistory` — dispatch count, resolution rate, avg response time
- `useAvailability` — current status, setAvailability
- Auth context — sign out

## States (unchanged from current)

- Loading: "Loading profile..." in heading, N/A for stats
- Empty: "No specialization tags. Contact your agency admin."
- Error: Banner with message (needs retry button — deferred)
- Success feedback: Banner on status update

## Deferred

- Retry buttons on error banners (requires hook API changes)
- Undo for status change
