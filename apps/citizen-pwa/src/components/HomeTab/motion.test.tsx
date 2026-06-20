import '@testing-library/jest-dom/vitest'
import type { HTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertDoc } from '@bantayog/shared-types'
import type { MyReport } from '../MapTab/types.js'
import { HomeDataProvider, type HomeDataContextValue } from './HomeDataContext.js'
import { HomeTab } from './index.js'

const publicIncidentsResultMock = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/usePublicIncidents.js', () => ({
  usePublicIncidents: publicIncidentsResultMock,
}))

vi.mock('framer-motion', () => {
  function motionElement({
    animate,
    children,
    initial,
    transition,
    whileTap,
    ...props
  }: HTMLAttributes<HTMLElement> & {
    animate?: unknown
    children?: ReactNode
    initial?: unknown
    transition?: unknown
    whileTap?: unknown
  }) {
    return (
      <div
        {...props}
        data-motion-animate={JSON.stringify(animate)}
        data-motion-initial={JSON.stringify(initial)}
        data-motion-transition={JSON.stringify(transition)}
        data-motion-while-tap={JSON.stringify(whileTap)}
      >
        {children}
      </div>
    )
  }

  return {
    motion: new Proxy(
      {},
      {
        get: () => motionElement,
      },
    ),
  }
})

const report = {
  publicRef: 'ref-1234',
  reportType: 'flood',
  severity: 'high',
  lat: 14.112,
  lng: 122.956,
  submittedAt: 1_713_350_000_000,
  status: 'verified',
  municipalityLabel: 'Daet',
} satisfies MyReport

const alert = {
  id: 'alert-1',
  title: 'Flood warning for low-lying barangays',
  body: 'Avoid riverside roads until responders clear the area.',
  severity: 'critical',
  publishedAt: 1_713_350_500_000,
  publishedBy: 'ops-1',
} satisfies AlertDoc

const defaultHomeData = {
  alerts: [],
  alertsError: null,
  alertsLoading: false,
  reports: [report],
  reportsError: null,
  reportsLoading: false,
  unreadAlertCount: 0,
} satisfies HomeDataContextValue

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

function renderHome(homeData: HomeDataContextValue = defaultHomeData) {
  return render(
    <MemoryRouter>
      <HomeDataProvider value={homeData}>
        <HomeTab />
      </HomeDataProvider>
    </MemoryRouter>,
  )
}

describe('Home motion layer', () => {
  beforeEach(() => {
    publicIncidentsResultMock.mockReset()
    publicIncidentsResultMock.mockReturnValue({ error: null, incidents: [], loading: false })
    setReducedMotion(false)
  })

  it('uses immediate opacity-only motion when reduced motion is requested', () => {
    setReducedMotion(true)
    renderHome()

    const hero = screen.getByTestId('home-motion-hero')
    const reportCard = screen.getByTestId('home-motion-report')

    expect(hero.dataset.motionInitial).toBe(JSON.stringify({ opacity: 0 }))
    expect(hero.dataset.motionAnimate).toBe(JSON.stringify({ opacity: 1 }))
    expect(hero.dataset.motionTransition).toBe(JSON.stringify({ duration: 0 }))
    expect(reportCard.dataset.motionInitial).toBe(JSON.stringify({ opacity: 0 }))
    expect(reportCard.dataset.motionTransition).toBe(JSON.stringify({ duration: 0 }))
  })

  it('keeps the one-shot entrance node mounted across ordinary Home state updates', () => {
    const { rerender } = renderHome()
    const hero = screen.getByTestId('home-motion-hero')

    rerender(
      <MemoryRouter>
        <HomeDataProvider value={{ ...defaultHomeData, unreadAlertCount: 1 }}>
          <HomeTab />
        </HomeDataProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('home-motion-hero')).toBe(hero)
    expect(hero.dataset.motionInitial).toBe(JSON.stringify({ opacity: 0, y: 12 }))
  })

  it('uses a single-shot emergency cue and recedes secondary modules', () => {
    renderHome({ ...defaultHomeData, alerts: [alert], unreadAlertCount: 1 })

    const hero = screen.getByTestId('home-motion-hero')
    const reportCard = screen.getByTestId('home-motion-report')
    const nearbyCard = screen.getByTestId('home-motion-nearby')

    expect(hero.dataset.motionInitial).toBe(JSON.stringify({ opacity: 0, scale: 0.985 }))
    expect(hero.dataset.motionAnimate).toBe(JSON.stringify({ opacity: 1, scale: 1 }))
    expect(reportCard.dataset.motionAnimate).toBe(JSON.stringify({ opacity: 0.68, y: 0 }))
    expect(nearbyCard.dataset.motionAnimate).toBe(JSON.stringify({ opacity: 0.68, y: 0 }))
  })
})
