import { useNavigate } from 'react-router-dom'
import { CheckCircle, Phone, UserCircle } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { LinkReportsByPhone } from './LinkReportsByPhone'

const ACCOUNT_BENEFITS = [
  'Track your report status',
  'Receive updates on your submitted reports',
  'Build a history of your community contributions',
]

interface AnonymousProfileProps {
  onCreateAccount?: () => void
  onContinue?: () => void
}

export function AnonymousProfile({ onCreateAccount, onContinue }: AnonymousProfileProps = {}) {
  const navigate = useNavigate()

  const handleCreateAccount = () => {
    if (onCreateAccount) {
      onCreateAccount()
    } else {
      navigate('/signup')
    }
  }

  return (
    <div
      data-testid="anonymous-profile"
      className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-8 gap-6 pb-20"
    >
      {/* Avatar + heading */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <UserCircle className="text-gray-400" size={72} strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-800">Not Signed In</h1>
        <p className="text-sm text-gray-500 text-center">
          You are browsing as an anonymous user.
        </p>
      </div>

      {/* Value proposition card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-700">
          Why create an account?
        </h2>
        <ul className="flex flex-col gap-2">
          {ACCOUNT_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle
                className="text-green-500 shrink-0 mt-0.5"
                size={16}
              />
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <Button variant="primary" className="w-full" onClick={handleCreateAccount}>
          Create Account
        </Button>
        <Button variant="secondary" className="w-full" onClick={onContinue}>
          Continue as Anonymous
        </Button>
      </div>

      {/* Link reports by phone section */}
      <div className="w-full max-w-sm">
        <LinkReportsByPhone />
      </div>

      {/* Admin contact section */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3">
        <Phone className="text-primary-blue shrink-0" size={20} />
        <p className="text-sm text-gray-600">
          Contact your admin for account assistance or to report issues.
        </p>
      </div>
    </div>
  )
}
