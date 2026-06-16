// test-utils.tsx — shared test utilities for admin-desktop
// Centralises repeated mock factories, render wrappers, and store reset helpers
// used across __tests__/*.test.tsx to reduce duplication.

import { vi, type Mock } from 'vitest'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter, BrowserRouter } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import type { DispatchLifecycleRow } from './hooks/useDispatchLifecycle'
import type { ResponderFleetMember } from './hooks/useResponderFleet'
import type { WindowSyncMessage } from './stores/commandCenterStore'

export type { WindowSyncMessage } from './stores/commandCenterStore'

export interface WindowSyncContextMock {
  sendSync: Mock<(msg: WindowSyncMessage) => void>
  subscribe: Mock<(handler: (msg: WindowSyncMessage) => void) => () => void>
}

export function createWindowSyncContextMock(overrides: Partial<WindowSyncContextMock> = {}) {
  return {
    sendSync: overrides.sendSync ?? vi.fn<(msg: WindowSyncMessage) => void>(),
    subscribe:
      overrides.subscribe ??
      vi
        .fn<(handler: (msg: WindowSyncMessage) => void) => () => void>()
        .mockReturnValue(() => undefined),
    ...overrides,
  }
}

export function createWindowSyncProviderModuleMock(overrides: Partial<WindowSyncContextMock> = {}) {
  const context = createWindowSyncContextMock(overrides)
  return {
    useWindowSyncContext: () => context,
  }
}

export function resetWindowSyncContextMock(context: WindowSyncContextMock) {
  context.sendSync.mockReset()
  context.subscribe.mockReset()
  context.subscribe.mockReturnValue(() => undefined)
}

/* ------------------------------------------------------------------ */
//  Render wrappers
/* ------------------------------------------------------------------ */

export function renderWithMemoryRouter(ui: ReactElement): RenderResult {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

export function MemoryRouterWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

export function BrowserRouterWrapper({ children }: { children: ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>
}

/* ------------------------------------------------------------------ */
//  DispatchLifecycleRow factory (cloned in 5+ test files)
/* ------------------------------------------------------------------ */

export function makeRow(overrides: Partial<DispatchLifecycleRow> = {}): DispatchLifecycleRow {
  return {
    dispatchId: overrides.dispatchId ?? 'd1',
    reportId: overrides.reportId ?? 'rep-12345-abcde',
    status: overrides.status ?? 'pending',
    responderName: overrides.responderName ?? 'Juan Dela Cruz',
    responderAgency: overrides.responderAgency ?? 'BFP',
    dispatchedAt: overrides.dispatchedAt ?? Date.now(),
    deadlineAt: overrides.deadlineAt ?? Date.now() + 3600000,
    escalationCount: overrides.escalationCount ?? 0,
    fcmResult: overrides.fcmResult ?? null,
    fcmWarnings: overrides.fcmWarnings ?? null,
    timeline: overrides.timeline ?? [],
    assignedTo: overrides.assignedTo ?? { uid: 'r1' },
    previouslyNotifiedResponderUids: overrides.previouslyNotifiedResponderUids ?? [],
    ...overrides,
  }
}

export const defaultRows: DispatchLifecycleRow[] = [makeRow()]

export const calmRows: DispatchLifecycleRow[] = []
export const activeRows: DispatchLifecycleRow[] = [makeRow({ status: 'pending' })]
export const surgeRows: DispatchLifecycleRow[] = Array.from({ length: 21 }, (_, i) =>
  makeRow({ dispatchId: `d${String(i)}`, status: 'pending' }),
)

/* ------------------------------------------------------------------ */
//  ResponderFleet fixtures (cloned in 3+ test files)
/* ------------------------------------------------------------------ */

export const defaultResponders: ResponderFleetMember[] = [
  {
    uid: 'r1',
    displayName: 'Alice',
    availabilityStatus: 'available',
    lastActivityAt: Date.now(),
    onlineStatus: 'online',
  },
]

/* ------------------------------------------------------------------ */
//  OpsMetrics fixtures (cloned in 3+ test files)
/* ------------------------------------------------------------------ */

export interface OpsMetricsFixture {
  metrics: {
    avgAcceptSeconds: number
    fcmSuccessRate: number
    totalDispatches: number
    acceptedCount: number
    declinedCount: number
    escalatedCount: number
    needsAdminCount: number
  }
  loading: boolean
  error: string | null
}

export const defaultMetrics: OpsMetricsFixture = {
  metrics: {
    avgAcceptSeconds: 42,
    fcmSuccessRate: 0.95,
    totalDispatches: 100,
    acceptedCount: 80,
    declinedCount: 10,
    escalatedCount: 5,
    needsAdminCount: 5,
  },
  loading: false,
  error: null,
}

/* ------------------------------------------------------------------ */
//  FirestoreListeners fixtures (cloned in Dashboard tests)
/* ------------------------------------------------------------------ */

export interface FirestoreListenersFixture {
  reports: Record<string, unknown>[]
  loading: boolean
  error: string | null
  alerts: Record<string, unknown>[]
}

export const defaultFirestoreListeners: FirestoreListenersFixture = {
  reports: [],
  loading: false,
  error: null,
  alerts: [],
}

/* ------------------------------------------------------------------ */
//  Mock-return helpers — so tests don't repeat object literals
/* ------------------------------------------------------------------ */

export function createMockedDispatchLifecycle(rows: DispatchLifecycleRow[] = defaultRows) {
  return { rows, loading: false, error: null }
}

export function createMockedResponderFleet(responders: ResponderFleetMember[] = defaultResponders) {
  return { responders, loading: false, error: null }
}

export function createMockedOpsMetrics(metrics: OpsMetricsFixture = defaultMetrics) {
  return metrics
}

export function createMockedFirestoreListeners(
  listeners: FirestoreListenersFixture = defaultFirestoreListeners,
) {
  return listeners
}
