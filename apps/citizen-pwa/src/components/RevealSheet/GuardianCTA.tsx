import { useNavigate } from 'react-router-dom'
import { CheckCircle, LogIn } from 'lucide-react'

const GUARDIAN_BENEFITS = [
  'Track reports across devices',
  'Earn Guardian badges',
  'Get status updates via app',
]

export function GuardianCTA() {
  const navigate = useNavigate()

  return (
    <div className="mt-4 mb-2 rounded-xl overflow-hidden bg-gradient-to-br from-brand-500 to-brand-600 p-4">
      <p className="text-white font-bold text-base mb-1">
        Maging Guardian. Samahan mo kaming magbantay.
      </p>
      <p className="text-brand-100 text-xs mb-3">
        Create a free account to track your reports, earn badges, and help protect your community.
      </p>
      <ul className="space-y-1 mb-3">
        {GUARDIAN_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2 text-white text-xs">
            <CheckCircle size={12} className="text-brand-200 shrink-0" />
            {benefit}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          void navigate('/register')
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-white text-brand-600 font-semibold text-sm border-none cursor-pointer active:bg-brand-50 transition-colors"
      >
        <LogIn size={14} />
        Create Account
      </button>
    </div>
  )
}
