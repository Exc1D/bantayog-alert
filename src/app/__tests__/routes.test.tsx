import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

import { Navigation } from '../navigation'
import { MapView } from '@/features/map/components/MapView'
import { FeedList } from '@/features/feed/components/FeedList'
import { ReportForm } from '@/features/report/components/ReportForm'
import { AlertList } from '@/features/alerts/components/AlertList'
import { AnonymousProfile } from '@/features/profile/components/AnonymousProfile'
import { ReportDetailScreen } from '@/features/feed/components/ReportDetailScreen'

describe('Router Configuration', () => {
  const renderWithRouter = (path: string) => {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Navigation />
        <Routes>
          <Route path="/" element={<MapView />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/feed" element={<FeedList />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/alerts" element={<AlertList />} />
          <Route path="/profile" element={<AnonymousProfile />} />
          <Route path="/feed/:reportId" element={<ReportDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )
  }

  describe('root route', () => {
    it('should render MapView at root path', () => {
      renderWithRouter('/')

      expect(screen.getByTestId('map-view')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('map route', () => {
    it('should render MapView at /map', () => {
      renderWithRouter('/map')

      expect(screen.getByTestId('map-view')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('feed route', () => {
    it('should render FeedList at /feed', () => {
      renderWithRouter('/feed')

      expect(screen.getByTestId('feed-list')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('report route', () => {
    it('should render ReportForm at /report', () => {
      renderWithRouter('/report')

      expect(screen.getByTestId('report-form')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('alerts route', () => {
    it('should render AlertList at /alerts', () => {
      renderWithRouter('/alerts')

      expect(screen.getByTestId('alert-list')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('profile route', () => {
    it('should render AnonymousProfile at /profile', () => {
      renderWithRouter('/profile')

      expect(screen.getByTestId('anonymous-profile')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('report detail route', () => {
    it('should render ReportDetailScreen at /feed/:reportId', () => {
      renderWithRouter('/feed/test-report-123')

      expect(screen.getByTestId('report-detail-screen')).toBeInTheDocument()
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })

    it('should handle different report IDs', () => {
      const reportIds = ['abc-123', 'xyz-789', 'report-1']

      reportIds.forEach((id) => {
        const { unmount } = renderWithRouter(`/feed/${id}`)

        expect(screen.getByTestId('report-detail-screen')).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('navigation layout', () => {
    it('should render Navigation component on all routes', () => {
      const routes = ['/', '/map', '/feed', '/report', '/alerts', '/profile']

      routes.forEach((path) => {
        const { unmount } = renderWithRouter(path)

        expect(screen.getByTestId('navigation')).toBeInTheDocument()
        unmount()
      })
    })
  })
})
