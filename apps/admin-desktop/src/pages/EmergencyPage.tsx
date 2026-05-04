import { useState, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReportType, Severity } from '@/types'
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Wind,
  Waves,
  Flame,
  Mountain,
  Activity,
  AlertOctagon,
  ChevronRight,
  Check,
} from 'lucide-react'

const EMERGENCY_TYPES: {
  id: ReportType
  label: string
  tagalog: string
  icon: typeof Wind
  color: string
}[] = [
  { id: 'FLOOD', label: 'FLOOD', tagalog: 'BAHA', icon: Waves, color: 'text-accent' },
  { id: 'FIRE', label: 'FIRE', tagalog: 'SUNOG', icon: Flame, color: 'text-red-700' },
  { id: 'LANDSLIDE', label: 'LANDSLIDE', tagalog: 'GUHO', icon: Mountain, color: 'text-amber-700' },
  { id: 'OTHER', label: 'TYPHOON / STORM', tagalog: 'BAGYO', icon: Wind, color: 'text-purple-700' },
  {
    id: 'ACCIDENT',
    label: 'EARTHQUAKE',
    tagalog: 'LINDOL',
    icon: Activity,
    color: 'text-amber-700',
  },
  {
    id: 'MEDICAL',
    label: 'OTHER',
    tagalog: 'IBA PA',
    icon: AlertOctagon,
    color: 'text-muted-foreground',
  },
]

const SEVERITY_OPTIONS: {
  value: Severity
  label: string
  color: string
  bg: string
  border: string
}[] = [
  {
    value: 'HIGH',
    label: 'CRITICAL',
    color: 'text-red-700',
    bg: 'bg-red-700',
    border: 'border-red-700',
  },
  {
    value: 'MEDIUM',
    label: 'EMERGENCY',
    color: 'text-amber-700',
    bg: 'bg-amber-700',
    border: 'border-amber-700',
  },
  {
    value: 'LOW',
    label: 'WARNING',
    color: 'text-green-700',
    bg: 'bg-green-700',
    border: 'border-green-700',
  },
]

const TEMPLATES = [
  {
    label: 'Typhoon warning',
    text: 'A severe typhoon is approaching Camarines Norte. All residents in low-lying and coastal areas are advised to evacuate immediately to designated evacuation centers. Stay tuned for updates.',
  },
  {
    label: 'Flooding emergency',
    text: 'Due to continuous heavy rainfall, widespread flooding is affecting multiple municipalities. Residents in affected areas must evacuate now. Roads are impassable in several areas.',
  },
  {
    label: 'Landslide alert',
    text: 'Landslide warnings are in effect for mountainous and hilly areas. Avoid travel near slopes and riverbanks. Report any ground movement or cracks immediately.',
  },
  {
    label: 'Mass evacuation',
    text: 'Mass evacuation is ordered for all residents in high-risk zones. Proceed calmly to the nearest evacuation center. Bring only essential items. Follow instructions from barangay officials.',
  },
]

const STEPS = [
  'Emergency Type',
  'Severity',
  'Affected Areas',
  'Declaration',
  'Verification',
  'Complete',
]

export default function EmergencyPage() {
  const { municipalities } = useDataStore()
  const { addToast } = useUIStore()

  const [step, setStep] = useState(1)
  const [emergencyType, setEmergencyType] = useState<ReportType | null>(null)
  const [severity, setSeverity] = useState<Severity>('HIGH')
  const [scope, setScope] = useState<'province' | 'specific'>('province')
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([])
  const [declarationText, setDeclarationText] = useState('')
  const [notifyNdrmmc, setNotifyNdrmmc] = useState(true)
  const [affectedPopulation, setAffectedPopulation] = useState('')
  const [totp, setTotp] = useState(['', '', '', '', '', ''])
  const [totpError, setTotpError] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [declarationId, setDeclarationId] = useState('')

  const totpRefs = useRef<(HTMLInputElement | null)[]>([])

  const canContinue = () => {
    if (step === 1) return !!emergencyType
    if (step === 2) return !!severity
    if (step === 3) return scope === 'province' || selectedMunicipalities.length > 0
    if (step === 4) return declarationText.length > 10
    if (step === 5) return totp.every((d) => d.length === 1)
    return true
  }

  const handleNext = () => {
    if (step === 5) {
      const code = totp.join('')
      if (code !== '123456') {
        setTotpError(true)
        setTimeout(() => {
          setTotpError(false)
        }, 1000)
        return
      }
      setProcessing(true)
      setTimeout(() => {
        setProcessing(false)
        setSuccess(true)
        setDeclarationId(
          `DEC-${String(new Date().getFullYear())}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        )
        addToast({
          title: 'Emergency declared',
          message: 'Province-wide emergency protocol activated.',
          type: 'success',
        })
      }, 2000)
      return
    }
    setStep((s) => Math.min(6, s + 1))
  }

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1))
  }

  const toggleMunicipality = (name: string) => {
    setSelectedMunicipalities((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    )
  }

  const handleTotpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...totp]
    next[idx] = val
    setTotp(next)
    setTotpError(false)
    if (val && idx < 5) {
      totpRefs.current[idx + 1]?.focus()
    }
  }

  const handleTotpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totp[idx] && idx > 0) {
      totpRefs.current[idx - 1]?.focus()
    }
  }

  const insertTemplate = (text: string) => {
    setDeclarationText(text)
  }

  const selectedType = EMERGENCY_TYPES.find((t) => t.id === emergencyType)
  const selectedSev = SEVERITY_OPTIONS.find((s) => s.value === severity)

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-56px)] bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
          }}
          className="w-full max-w-[640px] bg-white border-2 border-red-700 rounded-xl overflow-hidden shadow-xl"
        >
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3 mb-2">
              {success ? (
                <CheckCircle className="w-8 h-8 text-green-700" />
              ) : step === 5 ? (
                <Lock className="w-8 h-8 text-red-700" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-700" />
              )}
              <div>
                <h2
                  className={cn(
                    'text-2xl font-semibold',
                    success ? 'text-green-700' : 'text-red-700',
                  )}
                >
                  {success
                    ? 'Emergency Declared'
                    : step === 5
                      ? 'Identity Verification Required'
                      : 'Emergency Declaration'}
                </h2>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {success
                    ? 'Declaration has been logged and protocols activated.'
                    : `Step ${String(step)} of 5 \u2014 ${STEPS[step - 1] ?? ''}`}
                </p>
              </div>
            </div>
            {!success && (
              <div className="mt-3 flex items-center gap-1">
                {STEPS.slice(0, 5).map((s, idx) => (
                  <div key={s} className="flex-1 flex items-center gap-1">
                    <div
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        idx + 1 <= step ? 'bg-red-700' : 'bg-border',
                      )}
                    />
                    {idx < 4 && <ChevronRight className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!success && step < 5 && (
            <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <p className="text-body-sm text-red-700 leading-relaxed">
                Declaring an emergency will: (1) Send province-wide alerts to all users, (2)
                Activate emergency response protocols, (3) Log this action with your identity and
                timestamp, (4) Notify NDRRMC automatically.
              </p>
            </div>
          )}

          <div className="p-5">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  >
                    <CheckCircle className="w-16 h-16 text-green-700 mx-auto mb-4" />
                  </motion.div>
                  <p className="text-body-lg text-foreground mb-1">
                    {selectedType?.label} emergency declared for{' '}
                    {scope === 'province'
                      ? 'Province-wide scope'
                      : `${String(selectedMunicipalities.length)} municipalities`}
                    .
                  </p>
                  <p className="text-sm font-mono text-accent mb-1">
                    Declaration ID: #{declarationId}
                  </p>
                  <p className="text-sm font-mono text-muted-foreground/70 mb-2">
                    {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                  </p>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <span className="text-body-sm text-green-700">
                      <Check className="w-4 h-4 inline mr-1" />
                      NDRRMC notified: Yes
                    </span>
                    <span className="text-body-sm text-green-700">
                      <Check className="w-4 h-4 inline mr-1" />
                      Alerts sent: 2,847 users
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setStep(1)
                      setSuccess(false)
                      setEmergencyType(null)
                      setSeverity('HIGH')
                      setScope('province')
                      setSelectedMunicipalities([])
                      setDeclarationText('')
                      setTotp(['', '', '', '', '', ''])
                      setDeclarationId('')
                    }}
                    className="mt-6 px-6 py-2.5 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                  >
                    Declare Another Alert
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {step === 1 && (
                    <div className="space-y-4">
                      <span className="text-body-sm text-muted-foreground block">
                        Emergency Type
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {EMERGENCY_TYPES.map((t) => {
                          const Icon = t.icon
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                setEmergencyType(t.id)
                              }}
                              className={cn(
                                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                                emergencyType === t.id
                                  ? 'border-2 border-red-700 bg-red-50'
                                  : 'border-border bg-muted hover:border-muted-foreground/30',
                              )}
                            >
                              <Icon className={cn('w-8 h-8', t.color)} />
                              <div className="text-center">
                                <p className="text-body-sm text-foreground font-medium">
                                  {t.label}
                                </p>
                                <p className="text-xs text-muted-foreground/70">({t.tagalog})</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <span className="text-body-sm text-muted-foreground block">
                        Severity Level
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {SEVERITY_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => {
                              setSeverity(s.value)
                            }}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                              severity === s.value
                                ? `${s.bg} ${s.border} border-2 text-white`
                                : 'border-border bg-muted hover:border-muted-foreground/30',
                            )}
                          >
                            <AlertTriangle
                              className={cn(
                                'w-6 h-6',
                                severity === s.value ? 'text-white' : s.color,
                              )}
                            />
                            <span
                              className={cn(
                                'text-body-sm font-medium',
                                severity === s.value ? 'text-white' : 'text-foreground',
                              )}
                            >
                              {s.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <span className="text-body-sm text-muted-foreground block">
                        Declaration Scope
                      </span>
                      <div className="flex gap-3 mb-4">
                        <button
                          onClick={() => {
                            setScope('province')
                          }}
                          className={cn(
                            'flex-1 p-4 rounded-lg border text-center transition-all',
                            scope === 'province'
                              ? 'border-red-700 bg-red-50'
                              : 'border-border bg-muted hover:border-muted-foreground/30',
                          )}
                        >
                          <p className="text-body-sm text-foreground font-medium">Province-wide</p>
                          <p className="text-xs text-muted-foreground/70">All 12 municipalities</p>
                        </button>
                        <button
                          onClick={() => {
                            setScope('specific')
                          }}
                          className={cn(
                            'flex-1 p-4 rounded-lg border text-center transition-all',
                            scope === 'specific'
                              ? 'border-red-700 bg-red-50'
                              : 'border-border bg-muted hover:border-muted-foreground/30',
                          )}
                        >
                          <p className="text-body-sm text-foreground font-medium">
                            Specific Municipalities
                          </p>
                          <p className="text-xs text-muted-foreground/70">Select affected areas</p>
                        </button>
                      </div>
                      {scope === 'specific' && (
                        <div className="bg-muted border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground">
                              {selectedMunicipalities.length} selected
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedMunicipalities(municipalities.map((m) => m.name))
                                }}
                                className="text-xs text-accent hover:underline"
                              >
                                Select all
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedMunicipalities([])
                                }}
                                className="text-xs text-muted-foreground/70 hover:underline"
                              >
                                Clear all
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                            {municipalities.map((m) => (
                              <label
                                key={m.id}
                                className={cn(
                                  'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                                  selectedMunicipalities.includes(m.name)
                                    ? 'bg-red-50 border border-red-200'
                                    : 'hover:bg-white',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMunicipalities.includes(m.name)}
                                  onChange={() => {
                                    toggleMunicipality(m.name)
                                  }}
                                  className="accent-red-700"
                                />
                                <span className="text-body-sm text-foreground">{m.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-4">
                      <span className="text-body-sm text-muted-foreground block">
                        Declaration Text
                      </span>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {TEMPLATES.map((t) => (
                          <button
                            key={t.label}
                            onClick={() => {
                              insertTemplate(t.text)
                            }}
                            className="px-3 py-1 rounded-md bg-muted border border-border text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={declarationText}
                        onChange={(e) => {
                          setDeclarationText(e.target.value)
                        }}
                        rows={8}
                        placeholder="Enter the official emergency declaration text..."
                        className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent resize-none"
                      />
                      <p className="text-xs text-muted-foreground/70 text-right">
                        {declarationText.length} / 1000
                      </p>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          checked={notifyNdrmmc}
                          onChange={(e) => {
                            setNotifyNdrmmc(e.target.checked)
                          }}
                          className="accent-accent"
                        />
                        <span className="text-body-sm text-muted-foreground">
                          Automatically notify NDRRMC of this declaration
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 ml-6">
                        Recommended for HIGH severity declarations
                      </p>

                      <div className="pt-2">
                        <span className="text-body-sm text-muted-foreground block mb-2">
                          Estimated Affected Population
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={affectedPopulation}
                            onChange={(e) => {
                              setAffectedPopulation(e.target.value)
                            }}
                            placeholder="e.g. 5000"
                            className="flex-1 px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent"
                          />
                          <span className="text-body-sm text-muted-foreground">individuals</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-5">
                      <div className="bg-muted border border-border rounded-lg p-5">
                        <p className="text-body-sm text-muted-foreground mb-3">
                          You are about to declare:
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {selectedType && (
                              <selectedType.icon className={cn('w-5 h-5', selectedType.color)} />
                            )}
                            <span className="text-body-lg text-foreground font-medium">
                              {selectedType?.label}{' '}
                              {selectedType?.tagalog && `(${selectedType.tagalog})`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium text-white',
                                selectedSev?.bg,
                              )}
                            >
                              {selectedSev?.label}
                            </span>
                          </div>
                          <p className="text-body-md text-foreground">
                            {scope === 'province'
                              ? 'Province-wide (12 municipalities)'
                              : `${String(selectedMunicipalities.length)} municipalities selected`}
                          </p>
                          <p className="text-body-sm text-muted-foreground italic line-clamp-2">
                            &ldquo;{declarationText}&rdquo;
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs text-red-700">Province-wide alerts</span>
                            <span className="text-xs text-red-700">&middot;</span>
                            <span className="text-xs text-red-700">Protocol activation</span>
                            <span className="text-xs text-red-700">&middot;</span>
                            <span className="text-xs text-red-700">NDRRMC notification</span>
                            <span className="text-xs text-red-700">&middot;</span>
                            <span className="text-xs text-red-700">Audit log entry</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-body-sm text-muted-foreground block mb-3">
                          Enter TOTP Code
                        </span>
                        <div className="flex items-center gap-3 justify-center">
                          {totp.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                totpRefs.current[idx] = el
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => {
                                handleTotpChange(idx, e.target.value)
                              }}
                              onKeyDown={(e) => {
                                handleTotpKeyDown(idx, e)
                              }}
                              className={cn(
                                'w-12 h-14 text-center text-2xl font-semibold text-foreground bg-white border-2 rounded-lg focus:outline-none transition-colors font-mono',
                                totpError
                                  ? 'border-red-700 focus:border-red-700'
                                  : 'border-border focus:border-accent',
                              )}
                            />
                          ))}
                        </div>
                        {totpError && (
                          <p className="text-xs text-red-700 text-center mt-2">
                            Invalid TOTP code. Please try again.
                          </p>
                        )}
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-body-sm text-red-700">
                          This action is irreversible and will be permanently logged. Ensure you
                          have authority to declare emergencies for Camarines Norte.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!success && (
            <div className="flex items-center justify-between p-5 border-t border-border">
              <button
                onClick={
                  step === 1
                    ? () => {
                        window.history.back()
                      }
                    : handleBack
                }
                className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {step === 1 ? (
                  'Cancel'
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4 inline mr-1" /> Go Back
                  </>
                )}
              </button>
              <button
                onClick={handleNext}
                disabled={!canContinue() || processing}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-md text-body-sm font-medium transition-all disabled:opacity-40',
                  step === 5
                    ? 'bg-red-700 text-white hover:bg-red-800'
                    : 'bg-accent text-white hover:bg-accent-hover',
                )}
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : step === 5 ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Declare Emergency
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  )
}
