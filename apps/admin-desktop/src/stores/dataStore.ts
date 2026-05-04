import { create } from 'zustand'
import type {
  Report,
  User,
  Agency,
  Municipality,
  AuditLogEntry,
  EscalationRequest,
  DataErasureRequest,
  SystemHealthMetric,
  SmsOutboxEntry,
  ProviderHealth,
  ShiftHandoff,
  EmergencyDeclaration,
  ActivityEvent,
  Notification,
} from '@/types'
import {
  incidents,
  users,
  agencies,
  municipalities,
  auditLogEntries,
  escalationRequests,
  dataErasureRequests,
  systemHealthMetrics,
  smsOutbox,
  providerHealth,
  shiftHandoffs,
  emergencyDeclarations,
  activityEvents,
  notifications,
} from '@/data/mockData'

interface DataState {
  incidents: Report[]
  users: User[]
  agencies: Agency[]
  municipalities: Municipality[]
  auditLog: AuditLogEntry[]
  escalations: EscalationRequest[]
  erasureRequests: DataErasureRequest[]
  systemHealth: SystemHealthMetric[]
  smsOutbox: SmsOutboxEntry[]
  providerHealth: ProviderHealth[]
  shiftHandoffs: ShiftHandoff[]
  emergencyDeclarations: EmergencyDeclaration[]
  activityEvents: ActivityEvent[]
  notifications: Notification[]
  lastUpdated: string
  isLoading: boolean
  refreshData: () => void
  updateFreshness: () => void
  addActivityEvent: (event: ActivityEvent) => void
  dismissAnomaly: (id: string) => void
  markNotificationRead: (id: string) => void
}

export const useDataStore = create<DataState>((set) => ({
  incidents: [...incidents],
  users: [...users],
  agencies: [...agencies],
  municipalities: [...municipalities],
  auditLog: [...auditLogEntries],
  escalations: [...escalationRequests],
  erasureRequests: [...dataErasureRequests],
  systemHealth: [...systemHealthMetrics],
  smsOutbox: [...smsOutbox],
  providerHealth: [...providerHealth],
  shiftHandoffs: [...shiftHandoffs],
  emergencyDeclarations: [...emergencyDeclarations],
  activityEvents: [...activityEvents],
  notifications: [...notifications],
  lastUpdated: new Date().toISOString(),
  isLoading: false,
  refreshData: () => {
    set({ isLoading: true })
    setTimeout(() => {
      set({ lastUpdated: new Date().toISOString(), isLoading: false })
    }, 500)
  },
  updateFreshness: () => {
    set({ lastUpdated: new Date().toISOString() })
  },
  addActivityEvent: (event) => {
    set((s) => ({
      activityEvents: [event, ...s.activityEvents].slice(0, 50),
    }))
  },
  dismissAnomaly: (_id: string) => {
    void _id
  },
  markNotificationRead: (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
  },
}))
