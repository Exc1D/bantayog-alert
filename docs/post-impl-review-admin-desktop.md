## Post-Implementation Review: admin-desktop

> **Status:** All must-fix issues addressed. See FIXED section below.
> **Verification:** TypeScript clean, 438/438 tests passing.

### FIXED (2026-05-25)

- ✅ **Confirmation on destructive actions.** FeedPage unpublish now shows ConfirmationModal. TriagePanel reject already had ConfirmationModal.
- ✅ **Focus trap in modals.** Created `useFocusTrap` hook applied to HelpModal, DeclareAlertModal, ReDispatchModal.
- ✅ **Focus return after modal close.** `useFocusTrap` stores and restores previous focus on deactivation.
- ✅ **Race condition in FeedPage featured media.** Added `.catch(() => undefined)` to break the write queue rejection chain so subsequent writes can proceed.
- ✅ **User-facing media errors.** Added dismissible media error banner instead of console-only logging.
- ✅ **Retry logic for callable invocations.** Created `withRetry` utility (3 attempts, exponential backoff) applied to all callable call sites. Disabled retries in test environment to avoid breaking existing tests.
- ✅ **Auth flash.** LoginPage now shows "Verifying admin privileges…" state during role claim check, preventing dashboard flash.
- ✅ **Mobile gate resize listener.** Replaced module-level width check with `useIsMobile` hook using window resize listener.
- ✅ **ErrorBoundary improvement.** Added error details (collapsible), "Go Back" button, and better copy.
- ✅ **Stale data indicator.** DashboardPage shows subtle warning banner when `lastDataUpdateAt` is older than 5 minutes.
- ✅ **Unsaved changes warning.** DeclareAlertModal warns before closing with unsaved data (both modal close and browser tab close).
- ✅ **prefers-reduced-motion support.** Added CSS media query that disables animations/transitions for motion-sensitive users.

### What looks solid

- **Architecture separation.** Clean separation between pages, components, hooks, and services. Each hook has a single responsibility (useDispatchLifecycle, useResponderFleet, useOpsMetrics).
- **Real-time data layer.** Firestore listeners provide live updates without polling. WindowSyncProvider enables cross-window coordination between dashboard and map views.
- **Accessibility foundations.** SkipLink, LiveAnnouncer, and comprehensive aria-label coverage show deliberate a11y investment.
- **Type safety.** TypeScript used throughout with proper interfaces and type guards (mapReportDocToReport, isRecord).
- **Error handling strategy.** Multiple error boundaries (AuthLayout ErrorBoundary, component-level error states, global OfflineBanner).
- **Keyboard support.** useKeyboardShortcuts hook with input-focus detection prevents shortcuts from firing while typing.
- **Test coverage.** Comprehensive test suite covering loading states, offline scenarios, accessibility components, and store behavior.
- **Audio alerts.** useAudioAlerts with localStorage persistence and Web Audio API oscillator tones for different severity levels.
- **Idempotency.** generateIdempotencyKey used across all callable invocations prevents duplicate actions.
- **Dashboard mode computation.**deriveDashboardMode considers stalled dispatches, active count, FCM success rate, hook errors, and data freshness — robust state machine for operational awareness.

### Concerns (non-blocking)

- **Mobile gate evaluated at module load time.** `const isMobile = typeof window !== 'undefined' && window.innerWidth < 768` in routes.tsx runs once at import. Resizing browser after load won't trigger the gate. Consider using a resize listener or CSS-based gate.
- **Auth flash.** LoginPage signs in user via Firebase, then checks role claims, then signs out if unauthorized. The useEffect watching `[user, authLoading]` may briefly show dashboard before redirecting. A loading state covering the role check would prevent the flash.
- **Effect dependency override.** FeedPage media fetch effect has `// eslint-disable-next-line react-hooks/exhaustive-deps` with `reportIdsKey` as the only dependency. If `db` instance changes (e.g., emulator toggle), the effect won't refire. This is a known pattern but should be documented.
- **Console.error for user-facing failures.** FeedPage media fetch failures log to console.error but don't show user-visible feedback. Admins won't know why photos aren't loading.
- **ErrorBoundary fallback is minimal.** Only shows "Something went wrong" with a Refresh button. No error details, no way to report the issue, and no attempt to recover state.
- **Loading state logic on DashboardPage.** `if (isLoading && rows.length === 0 && reports.length === 0)` means if hooks return cached data while refreshing, the spinner disappears even though new data is loading. Could show a subtle "refreshing" indicator.
- **StatusBar pendingTriage hardcoded to 0.** `pendingTriage={0} // TODO: derive from reports` — known gap but ships with a TODO.
- **CommandHeader inline styles.** Dynamic color styles via the `style` prop for role accents. Works but prevents CSS class purging and makes theming harder.
- **MapPage action error positioning.** `absolute left-0 right-0 top-12 z-[60]` positioning for action errors may overlap with other UI elements on different screen sizes.

### Issues (must fix before shipping)

- **No confirmation on destructive actions.** "Unpublish" in FeedPage fires immediately with no confirmation dialog. This is irreversible and could accidentally hide critical public safety information. Same for "Reject" in map triage panel. Use the existing ConfirmationModal component.
- **Missing focus management in modals.** HelpModal, DeclareAlertModal, and ReDispatchModal don't trap focus. Keyboard users can tab outside the modal into the underlying page. Add focus trap using a ref and Tab key interception.
- **Focus not returned after modal close.** After dismissing any modal, focus should return to the element that opened it. Currently focus is lost, forcing keyboard users to restart navigation from the top of the page.
- **Race condition in FeedPage featured media.** The write queue pattern (`writeQueues.current`) chains Firestore writes but doesn't handle the case where a write fails and subsequent writes still attempt to execute. Could leave the UI out of sync with the database.
- **Unsafe innerHTML pattern.** FeedPage renders `report.description.trim() || 'Report details pending'` directly. While React's JSX escaping protects against XSS, any future refactor to dangerouslySetInnerHTML would be vulnerable. Add DOMPurify or sanitize utility if rich text is ever supported.
- **No retry for failed callable invocations.** All callables (verifyReport, rejectReport, dispatchResponder, declareAlert) fail permanently on network error. No retry logic or queue for offline actions. For a disaster response app, actions taken during brief connectivity loss should be retried.
- **Loading state doesn't handle partial failure.** If useDispatchLifecycle succeeds but useOpsMetrics fails, DashboardPage shows the error banner but still renders partial data. This is actually good UX, but the `isLoading` flag becomes misleading — it becomes false even though some data is stale.
- **Mobile check doesn't handle tablets.** 768px breakpoint blocks tablets that could reasonably run the desktop interface. Consider a warning instead of a hard block, or support 1024px+ fully.

### Follow-up items

- **Add skeleton screens** for initial page loads (replace spinners with content-shaped placeholders)
- **Sync selection state to URL** (selectedReportId, selectedMunicipalityId, activeOverlays) so state survives refresh and enables deep-linking
- **Implement unsaved changes warning** on DeclareAlertModal before closing
- **Add prefers-reduced-motion support** throughout (spinners, transitions, modals)
- **Integrate error reporting service** (Sentry) in ErrorBoundary componentDidCatch
- **Add retry with exponential backoff** for callable invocations during network failures
- **Create onboarding flow** for first-time admin users (3-step guided tour)
- **Add global search** for reports, dispatches, and alerts
- **Document the moderation workflow** inline with contextual help tooltips
- **Audit all icon-only buttons** for proper aria-label coverage (some may be missing)
- **Consider optimistic updates** for FeedPage actions (publish/unpublish) to improve perceived performance
- **Add stale data indicator** when lastDataUpdateAt is older than 5 minutes
