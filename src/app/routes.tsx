import { createBrowserRouter } from 'react-router-dom'
import { Navigation } from './navigation'
import { MapView } from '@/features/map/components/MapView'
import { FeedList } from '@/features/feed/components/FeedList'
import { ReportForm } from '@/features/report/components/ReportForm'
import { AlertList } from '@/features/alerts/components/AlertList'
import { AnonymousProfile } from '@/features/profile/components/AnonymousProfile'
import { LinkReportsByPhone } from '@/features/profile/components/LinkReportsByPhone'
import { ReportDetailScreen } from '@/features/feed/components/ReportDetailScreen'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { Signup } from './Signup'
import { submitCitizenReport } from '@/features/report/services/reportSubmission.service'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigation />,
    children: [
      { index: true, element: <MapView /> },
      { path: 'map', element: <MapView /> },
      { path: 'feed', element: <FeedList /> },
      {
        path: 'report',
        element: (
          <ReportForm
            onSubmit={(data) =>
              submitCitizenReport(data).then((result) => result.reportId)
            }
          />
        ),
      },
      { path: 'alerts', element: <AlertList /> },
      {
        path: 'profile',
        element: <AnonymousProfile />,
      },
      {
        path: 'profile/link-reports',
        element: <LinkReportsByPhone />,
      },
      {
        path: 'feed/:reportId',
        element: <ReportDetailScreen />,
      },
      {
        path: 'privacy-policy',
        element: <PrivacyPolicy />,
      },
      {
        path: 'signup',
        element: <Signup />,
      },
    ],
  },
])
