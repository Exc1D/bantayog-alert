import { useState } from 'react'
import { Button } from '../ui/Button'

interface Step3ReviewProps {
  onBack: () => void
  onSubmit: () => void
  reportData: {
    reportType: string
    location: { lat: number; lng: number }
    reporterName: string
    reporterMsisdn: string
    patientCount: number
  }
  isSubmitting?: boolean
}

const INCIDENT_EMOJIS: Record<string, string> = {
  flood: '🌊',
  fire: '🔥',
  road: '🚧',
  medical: '🚑',
  power: '⚡',
  landslide: '⛰',
  other: '+ Other',
}

export function Step3Review({
  onBack,
  onSubmit,
  reportData,
  isSubmitting = false,
}: Step3ReviewProps) {
  const [consent, setConsent] = useState(false)

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#001e40]"
        >
          ←
        </button>
        <span className="text-xs font-semibold text-[#43474f]">3 of 3</span>
      </div>

      <div className="flex gap-1 mb-4">
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
      </div>

      <div className="bg-gradient-to-br from-[#fff5ef] to-[#ffeee6] border border-[#f5d4bb] rounded-xl p-4 mb-4 relative overflow-hidden">
        <div className="absolute -top-5 -right-5 w-20 h-20 bg-[radial-gradient(circle,rgba(167,52,0,0.15)_0%,transparent_70%)]" />
        <div className="flex gap-2.5 items-start">
          <div className="w-8 h-8 bg-gradient-to-br from-[#a73400] to-[#d4522a] rounded-full flex items-center justify-center text-white flex-shrink-0">
            ♡
          </div>
          <p className="text-sm text-[#3d1300] leading-snug font-medium">
            <strong className="font-bold text-[#3d1300]">We heard you. We are here.</strong>{' '}
            We&apos;ll let you know when help is on the way. Please keep your line open.
          </p>
        </div>
      </div>

      <h2 className="text-base font-bold text-[#001e40] mb-2">Review your report</h2>

      <div className="bg-[#f2f4f6] rounded-lg p-2.5 mb-2">
        <p className="text-[9px] text-[#43474f] font-bold uppercase tracking-wider mb-0.5">
          Incident
        </p>
        <div className="text-sm font-semibold text-[#191c1e]">
          {INCIDENT_EMOJIS[reportData.reportType]}{' '}
          {reportData.reportType.charAt(0).toUpperCase() + reportData.reportType.slice(1)}
        </div>
        <div className="text-[10px] text-[#43474f] mt-0.5">
          {reportData.patientCount} {reportData.patientCount === 1 ? 'patient' : 'patients'}
        </div>
      </div>

      <div className="bg-[#f2f4f6] rounded-lg p-2.5 mb-4">
        <p className="text-[9px] text-[#43474f] font-bold uppercase tracking-wider mb-0.5">
          Contact
        </p>
        <div className="text-sm font-semibold text-[#191c1e]">{reportData.reporterName}</div>
        <div className="text-xs text-[#43474f]">{reportData.reporterMsisdn}</div>
      </div>

      <div className="bg-[#f2f4f6] rounded-lg p-2.5 mb-4">
        <p className="text-[9px] text-[#43474f] font-bold uppercase tracking-wider mb-0.5">
          Location
        </p>
        <div className="text-sm font-semibold text-[#191c1e]">
          {reportData.location.lat.toFixed(5)}, {reportData.location.lng.toFixed(5)}
        </div>
        <div className="text-[10px] text-[#43474f]">GPS coordinates</div>
      </div>

      <label className="block bg-[#eaf4fb] rounded-lg p-2.5 mb-4 flex gap-2 items-start">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked)
          }}
          className="w-4 h-4 border-2 border-[#001e40] bg-white rounded"
        />
        <span className="text-[10px] text-[#001e40] leading-snug">
          I confirm this report is true. Daet MDRRMO may contact me. <u>Privacy notice ›</u>
        </span>
      </label>

      <Button variant="primary" fullWidth onClick={onSubmit} disabled={!consent || isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit report'}
      </Button>
    </div>
  )
}
