import { create } from 'zustand'

export type PanelType = 'municipal' | 'incident' | 'user' | 'none'
export type FilterType = 'all' | 'incidents' | 'responders' | 'escalations' | 'system'

interface UIState {
  currentRoute: string
  setCurrentRoute: (route: string) => void
  selectedMunicipality: string | null
  selectedIncident: string | null
  selectedUser: string | null
  setSelectedMunicipality: (id: string | null) => void
  setSelectedIncident: (id: string | null) => void
  setSelectedUser: (id: string | null) => void
  activePanel: PanelType
  panelOpen: boolean
  panelWidth: number
  setActivePanel: (panel: PanelType, open: boolean) => void
  setPanelWidth: (width: number) => void
  closePanel: () => void
  municipalityFilter: string[]
  severityFilter: string[]
  typeFilter: string[]
  dateRange: string
  activityFilter: FilterType
  setMunicipalityFilter: (filter: string[]) => void
  setSeverityFilter: (filter: string[]) => void
  setTypeFilter: (filter: string[]) => void
  setDateRange: (range: string) => void
  setActivityFilter: (filter: FilterType) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
  confirmModalOpen: boolean
  confirmModalConfig: ConfirmModalConfig | null
  openConfirmModal: (config: ConfirmModalConfig) => void
  closeConfirmModal: () => void
  globalSearchOpen: boolean
  setGlobalSearchOpen: (open: boolean) => void
}

export interface ToastItem {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export interface ConfirmModalConfig {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: 'danger' | 'primary'
}

export const useUIStore = create<UIState>((set) => ({
  currentRoute: '/dashboard',
  setCurrentRoute: (route) => {
    set({ currentRoute: route })
  },
  selectedMunicipality: null,
  selectedIncident: null,
  selectedUser: null,
  setSelectedMunicipality: (id) => {
    set({ selectedMunicipality: id })
  },
  setSelectedIncident: (id) => {
    set({ selectedIncident: id })
  },
  setSelectedUser: (id) => {
    set({ selectedUser: id })
  },
  activePanel: 'none',
  panelOpen: false,
  panelWidth: 480,
  setActivePanel: (panel, open) => {
    set({ activePanel: panel, panelOpen: open })
  },
  setPanelWidth: (width) => {
    set({ panelWidth: width })
  },
  closePanel: () => {
    set({ activePanel: 'none', panelOpen: false })
  },
  municipalityFilter: [],
  severityFilter: [],
  typeFilter: [],
  dateRange: '7d',
  activityFilter: 'all',
  setMunicipalityFilter: (filter) => {
    set({ municipalityFilter: filter })
  },
  setSeverityFilter: (filter) => {
    set({ severityFilter: filter })
  },
  setTypeFilter: (filter) => {
    set({ typeFilter: filter })
  },
  setDateRange: (range) => {
    set({ dateRange: range })
  },
  setActivityFilter: (filter) => {
    set({ activityFilter: filter })
  },
  sidebarCollapsed: false,
  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
  },
  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
  },
  toasts: [],
  addToast: (toast) => {
    set((s) => ({
      toasts: [
        ...s.toasts,
        { ...toast, id: `toast-${String(Date.now())}-${String(Math.random())}` },
      ],
    }))
  },
  removeToast: (id) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }))
  },
  confirmModalOpen: false,
  confirmModalConfig: null,
  openConfirmModal: (config) => {
    set({ confirmModalOpen: true, confirmModalConfig: config })
  },
  closeConfirmModal: () => {
    set({ confirmModalOpen: false, confirmModalConfig: null })
  },
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) => {
    set({ globalSearchOpen: open })
  },
}))
