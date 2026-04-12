/**
 * Signup Page
 *
 * Renders the multi-step SignUpFlow wizard.
 * Parses ?phone= query param for pre-filled phone from LinkReportsByPhone.
 */

import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { SignUpFlow } from '@/features/auth/components/SignUpFlow'

export function Signup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const prefillPhone = searchParams.get('phone') || undefined

  const handleComplete = (_userId: string) => {
    // Redirect to profile after successful signup
    navigate('/profile')
  }

  const handleCancel = () => {
    navigate('/profile')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto">
        <SignUpFlow
          onComplete={handleComplete}
          onCancel={handleCancel}
          initialPhone={prefillPhone}
        />
      </div>
    </div>
  )
}
