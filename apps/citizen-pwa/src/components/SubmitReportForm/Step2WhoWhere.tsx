import { useState } from 'react'
import { Button } from '../ui/Button'

interface Step2WhoWhereProps {
  onNext: (data: {
    location: { lat: number; lng: number }
    reporterName: string
    reporterMsisdn: string
    patientCount: number
  }) => void
  onBack: () => void
}

export function Step2WhoWhere({ onNext, onBack }: Step2WhoWhereProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [reporterName, setReporterName] = useState('')
  const [reporterMsisdn, setReporterMsisdn] = useState('')
  const [anyoneHurt, setAnyoneHurt] = useState(false)
  const [patientCount, setPatientCount] = useState(0)
  const [locationError, setLocationError] = useState<string | null>(null)

  const handleGetLocation = async () => {
    setLocationError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    } catch {
      setLocationError('Could not get location. Please enable location services.')
    }
  }

  const handleNext = () => {
    if (!location) {
      setLocationError('Please capture your location first.')
      return
    }
    if (!reporterName.trim()) {
      alert('Please enter your name.')
      return
    }
    if (!reporterMsisdn.trim()) {
      alert('Please enter your phone number.')
      return
    }
    onNext({
      location,
      reporterName,
      reporterMsisdn,
      patientCount: anyoneHurt ? patientCount : 0,
    })
  }

  const canProceed = location && reporterName.trim() && reporterMsisdn.trim()

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#001e40]"
        >
          ←
        </button>
        <span className="text-xs font-semibold text-[#43474f]">2 of 3</span>
      </div>

      <div className="flex gap-1 mb-4">
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
      </div>

      <h2 className="text-xl font-bold text-[#001e40] mb-1">Where and who?</h2>
      <p className="text-xs text-[#43474f] mb-4">All fields below are required</p>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Location
        </p>
        <button
          type="button"
          onClick={() => {
            void handleGetLocation()
          }}
          className="w-full bg-[#f2f4f6] rounded-lg p-2.5 flex items-center gap-2.5 mb-2"
        >
          <div className="w-7 h-7 bg-[#001e40] rounded-lg flex items-center justify-center text-white">
            📍
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-semibold text-[#191c1e]">
              {location
                ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                : 'Capture location'}
            </div>
            {location && <div className="text-[9px] text-[#43474f]">GPS · accuracy varies</div>}
          </div>
          <span className="text-xs font-semibold text-[#001e40]">Change</span>
        </button>
        {locationError && <p className="text-xs text-red-600 mb-2">{locationError}</p>}
        <div className="bg-[#e8eef4] rounded-lg h-13 relative mb-4">
          {location && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#a73400] border-2 border-white rounded-full" />
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Your name
        </p>
        <input
          type="text"
          value={reporterName}
          onChange={(e) => {
            setReporterName(e.target.value)
          }}
          placeholder="Maria Dela Cruz"
          className="w-full bg-[#f2f4f6] border-b-2 border-[#001e40] rounded-t-lg p-2.5 text-sm text-[#191c1e] mb-3"
          required
        />
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Phone number
        </p>
        <input
          type="tel"
          value={reporterMsisdn}
          onChange={(e) => {
            setReporterMsisdn(e.target.value)
          }}
          placeholder="+63 912 345 6789"
          className="w-full bg-[#f2f4f6] border-b-2 border-[#001e40] rounded-t-lg p-2.5 text-sm text-[#191c1e] mb-1"
          required
        />
        <p className="text-[10px] text-[#43474f]">
          <span className="font-semibold text-[#001e40]">Gives you faster help.</span> Admins call
          this number if they need more details. <em>Mas mabilis kang matutulungan.</em>
        </p>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-[#001e40] uppercase tracking-wider mb-1">
          Is anyone hurt?
        </p>
        <div className="flex gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => {
              setAnyoneHurt(true)
            }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold ${
              anyoneHurt ? 'bg-[#001e40] text-white' : 'bg-[#f2f4f6] text-[#191c1e]'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setAnyoneHurt(false)
            }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold ${
              !anyoneHurt ? 'bg-[#001e40] text-white' : 'bg-[#f2f4f6] text-[#191c1e]'
            }`}
          >
            No
          </button>
        </div>

        {anyoneHurt && (
          <div className="bg-[#fff5ef] rounded-lg p-2.5 animate-slideIn">
            <p className="text-[10px] font-bold text-[#5e1f00] uppercase tracking-wider mb-1">
              How many patients?
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPatientCount(Math.max(0, patientCount - 1))
                }}
                className="w-7 h-7 bg-white text-[#5e1f00] rounded-lg flex items-center justify-center font-bold text-sm border border-[#e0c5b5]"
                disabled={patientCount === 0}
              >
                −
              </button>
              <div className="flex-1 bg-white p-2 rounded-lg text-center font-bold text-[#5e1f00]">
                {patientCount}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPatientCount(patientCount + 1)
                }}
                className="w-7 h-7 bg-[#5e1f00] text-white rounded-lg flex items-center justify-center font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      <Button variant="primary" fullWidth onClick={handleNext} disabled={!canProceed}>
        Continue
      </Button>
    </div>
  )
}
