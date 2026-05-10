import { create } from 'zustand'

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
export type ChartTimeRange = '24h' | '7d' | '30d'
export type TriageAge = 'new' | 'stale'

export interface TriageFilters {
  severity?: Severity
  municipality?: string
  age?: TriageAge
}

export type SyncMessage =
  | { type: 'select:report'; reportId: string; source: 'dashboard' | 'map' }
  | { type: 'select:municipality'; municipalityId: string; source: 'dashboard' | 'map' }
  | { type: 'triage:action'; reportId: string; action: 'verified' | 'rejected' | 'dispatched' }
  | { type: 'triage:bulk-action'; reportIds: string[]; action: 'verified' | 'rejected' }

interface CommandCenterState {
  // Selection
  selectedMunicipalityId: string | null
  selectedReportId: string | null

  // Dashboard UI
  triageFilters: TriageFilters
  chartTimeRange: ChartTimeRange
  statusBarExpanded: boolean
  statusBarExpandedOverride: boolean | null

  // Map UI
  mapBounds: { north: number; south: number; east: number; west: number } | null
  activeOverlays: Set<string>
  triagePanelOpen: boolean

  // Cross-window
  lastSyncMessage: SyncMessage | null

  // Actions
  selectMunicipality: (id: string | null) => void
  selectReport: (id: string | null) => void
  setTriageFilters: (filters: TriageFilters) => void
  setChartTimeRange: (range: ChartTimeRange) => void
  toggleStatusBarExpanded: () => void
  toggleOverlay: (overlayId: string) => void
  setTriagePanelOpen: (open: boolean) => void
  setLastSyncMessage: (msg: SyncMessage | null) => void
  setMapBounds: (
    bounds: { north: number; south: number; east: number; west: number } | null,
  ) => void
}

export const useCommandCenterStore = create<CommandCenterState>((set) => ({
  selectedMunicipalityId: null,
  selectedReportId: null,
  triageFilters: {},
  chartTimeRange: '7d',
  statusBarExpanded: false,
  statusBarExpandedOverride: null,
  mapBounds: null,
  activeOverlays: new Set(['all_incidents']),
  triagePanelOpen: false,
  lastSyncMessage: null,

  selectMunicipality: (id) => {
    set({ selectedMunicipalityId: id })
  },
  selectReport: (id) => {
    set({ selectedReportId: id, triagePanelOpen: id !== null })
  },
  setTriageFilters: (filters) => {
    set({ triageFilters: filters })
  },
  setChartTimeRange: (range) => {
    set({ chartTimeRange: range })
  },
  toggleStatusBarExpanded: () => {
    set((state) => ({
      statusBarExpandedOverride:
        state.statusBarExpandedOverride === null ? true : !state.statusBarExpandedOverride,
    }))
  },
  toggleOverlay: (overlayId) => {
    set((state) => {
      const next = new Set(state.activeOverlays)
      if (next.has(overlayId)) next.delete(overlayId)
      else next.add(overlayId)
      return { activeOverlays: next }
    })
  },
  setTriagePanelOpen: (open) => {
    set({ triagePanelOpen: open })
  },
  setLastSyncMessage: (msg) => {
    set({ lastSyncMessage: msg })
  },
  setMapBounds: (bounds) => {
    set({ mapBounds: bounds })
  },
}))
