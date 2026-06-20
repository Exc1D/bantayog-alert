import { createContext, useContext, type ReactNode } from 'react'
import type { AlertDoc } from '@bantayog/shared-types'
import type { MyReport } from '../MapTab/types.js'

export interface HomeDataContextValue {
  alerts: AlertDoc[]
  alertsLoading: boolean
  alertsError: Error | null
  reports: MyReport[]
  reportsLoading: boolean
  reportsError: string | null
  unreadAlertCount: number
}

const EMPTY_HOME_DATA: HomeDataContextValue = {
  alerts: [],
  alertsLoading: false,
  alertsError: null,
  reports: [],
  reportsLoading: false,
  reportsError: null,
  unreadAlertCount: 0,
}

const HomeDataContext = createContext<HomeDataContextValue | null>(null)

export function HomeDataProvider({
  children,
  value,
}: {
  children: ReactNode
  value: HomeDataContextValue
}) {
  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>
}

export function useHomeData(): HomeDataContextValue {
  return useContext(HomeDataContext) ?? EMPTY_HOME_DATA
}

export function useOptionalHomeData(): HomeDataContextValue | null {
  return useContext(HomeDataContext)
}
