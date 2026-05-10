import { describe, it, expect, beforeEach } from 'vitest'
import { useCommandCenterStore } from '../stores/commandCenterStore'

describe('commandCenterStore', () => {
  beforeEach(() => {
    useCommandCenterStore.setState(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      useCommandCenterStore.getInitialState?.() ?? {
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
      },
    )
  })

  it('selects a municipality', () => {
    const { selectMunicipality } = useCommandCenterStore.getState()
    selectMunicipality('daet')
    expect(useCommandCenterStore.getState().selectedMunicipalityId).toBe('daet')
  })

  it('toggles status bar expanded respecting surge state', () => {
    const { toggleStatusBarExpanded } = useCommandCenterStore.getState()
    toggleStatusBarExpanded()
    expect(useCommandCenterStore.getState().statusBarExpandedOverride).toBe(true)
  })

  it('toggles overlays', () => {
    const { toggleOverlay } = useCommandCenterStore.getState()
    toggleOverlay('heatmap')
    expect(useCommandCenterStore.getState().activeOverlays.has('heatmap')).toBe(true)
    toggleOverlay('heatmap')
    expect(useCommandCenterStore.getState().activeOverlays.has('heatmap')).toBe(false)
  })
})
