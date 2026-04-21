# Citizen PWA - Component Documentation

This document provides an overview of the citizen-facing PWA components and their usage.

## Components

### SubmitReportForm

3-step submission form with evidence capture, location/contact input, and review.

**Usage:**

```tsx
import { SubmitReportFormNew } from './components/SubmitReportForm'
;<SubmitReportFormNew />
```

**State Machine:**

- `idle` → `submitting` → `success` | `queued` | `failed_retryable`
- Transitions managed by `useSubmissionMachine` hook

### RevealSheet

Bottom sheet modal showing submission result with three variants: success, queued, failed_retryable.

**States:**

- Success: Green banner, server reference code, "Track this report" CTA
- Queued: Amber banner, draft reference, "Try sending now" CTA
- Failed: Rose banner, draft reference, "Try again" CTA + elevated hotline

**Usage:**

```tsx
import { RevealSheet } from './components/RevealSheet'
;<RevealSheet state="success" referenceCode="BA-7K3M-24" onClose={() => console.log('closed')} />
```

### TrackingScreen

Live-updating report detail screen with timeline and status.

**Data Source:**

- Firestore real-time listener via `useReport` hook
- Auto-updates when admin changes status

### UI Components

- **Button**: Primary, secondary, amber, red variants
- **StatusBanner**: Success (mint), queued (amber), failed (rose)
- **FallbackCards**: Call + SMS paired cards, emphasized variant
- **Timeline**: Vertical timeline with state-indicating dots

## Architecture

- **State Management**: Zustand for UI state, TanStack Query for server state
- **Persistence**: localForage for drafts, IndexedDB for query cache
- **Offline Support**: Drafts saved locally, auto-retry when online
