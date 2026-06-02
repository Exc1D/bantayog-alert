interface ContactFieldsProps {
  reporterName: string
  onReporterNameChange: (name: string) => void
  nameError: string | null
  onNameErrorClear: () => void

  reporterMsisdn: string
  onReporterMsisdnChange: (msisdn: string) => void
  phoneError: string | null
  onPhoneErrorClear: () => void

  anyoneHurt: boolean
  onAnyoneHurtChange: (hurt: boolean) => void

  patientCount: number
  onPatientCountChange: (count: number) => void

  hasMemory?: boolean
}

export function ContactFields({
  reporterName,
  onReporterNameChange,
  nameError,
  onNameErrorClear,
  reporterMsisdn,
  onReporterMsisdnChange,
  phoneError,
  onPhoneErrorClear,
  anyoneHurt,
  onAnyoneHurtChange,
  patientCount,
  onPatientCountChange,
  hasMemory = false,
}: ContactFieldsProps) {
  return (
    <div className="space-y-5">
      {hasMemory && (
        <p className="memory-hint text-xs text-success-500 font-semibold">
          Pre-filled from your last report
        </p>
      )}

      {/* Name */}
      <div>
        <label
          htmlFor="reporter-name"
          className="text-sm font-semibold text-surface-700 block mb-2"
        >
          Your name <span className="font-normal text-surface-400 text-xs ml-1">/ Pangalan</span>
        </label>
        <input
          id="reporter-name"
          type="text"
          value={reporterName}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? 'reporter-name-error' : undefined}
          onChange={(e) => {
            onReporterNameChange(e.target.value)
            onNameErrorClear()
          }}
          placeholder="Maria Dela Cruz"
          className="w-full min-h-[56px] rounded-xl border-2 border-surface-200 bg-white px-4 text-base text-surface-900 placeholder:text-surface-300 focus:border-brand-500 focus:outline-none transition-colors"
          required
        />
        {nameError && (
          <p
            id="reporter-name-error"
            className="field-error text-xs text-danger-500 mt-1.5"
            data-testid="name-error"
          >
            {nameError}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor="reporter-msisdn"
          className="text-sm font-semibold text-surface-700 block mb-2"
        >
          Phone number{' '}
          <span className="font-normal text-surface-400 text-xs ml-1">/ Numero ng telepono</span>
        </label>
        <input
          id="reporter-msisdn"
          type="tel"
          value={reporterMsisdn}
          aria-invalid={Boolean(phoneError)}
          aria-describedby={
            phoneError ? 'reporter-msisdn-hint reporter-msisdn-error' : 'reporter-msisdn-hint'
          }
          onChange={(e) => {
            onReporterMsisdnChange(e.target.value)
            onPhoneErrorClear()
          }}
          placeholder="+63 912 345 6789"
          className="w-full min-h-[56px] rounded-xl border-2 border-surface-200 bg-white px-4 text-base text-surface-900 placeholder:text-surface-300 focus:border-brand-500 focus:outline-none transition-colors"
          required
        />
        {phoneError && (
          <p
            id="reporter-msisdn-error"
            className="field-error text-xs text-danger-500 mt-1.5"
            data-testid="phone-error"
          >
            {phoneError}
          </p>
        )}
        <p id="reporter-msisdn-hint" className="text-xs text-surface-500 mt-1.5 leading-relaxed">
          <span className="font-semibold text-surface-700">Gives you faster help.</span> Admins call
          this number if they need more details.{' '}
          <em className="text-surface-400">Mas mabilis kang matutulungan.</em>
        </p>
      </div>

      {/* Is anyone hurt? */}
      <div className="bg-danger-500/5 border-2 border-danger-500/20 rounded-xl p-4">
        <p className="text-sm font-semibold text-surface-700 mb-3">
          Is anyone hurt?
          <em className="font-normal text-surface-400 ml-1">May injured ba?</em>
        </p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            aria-pressed={anyoneHurt}
            onClick={() => {
              onAnyoneHurtChange(true)
            }}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98] ${
              anyoneHurt
                ? 'bg-danger-500 border-danger-500 text-white'
                : 'bg-white border-surface-200 text-surface-700'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            aria-pressed={!anyoneHurt}
            onClick={() => {
              onAnyoneHurtChange(false)
            }}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98] ${
              !anyoneHurt
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-white border-surface-200 text-surface-700'
            }`}
          >
            No
          </button>
        </div>

        {anyoneHurt && (
          <div className="bg-white rounded-xl p-3 mt-2 animate-[slideIn_0.2s_ease]">
            <p className="text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
              How many patients?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onPatientCountChange(Math.max(0, patientCount - 1))
                }}
                className="w-11 h-11 rounded-xl bg-surface-100 text-surface-700 border border-surface-200 flex items-center justify-center font-bold text-lg disabled:opacity-40"
                disabled={patientCount === 0}
                aria-label="−"
              >
                −
              </button>
              <div className="flex-1 h-11 rounded-xl bg-surface-100 flex items-center justify-center font-bold text-surface-900">
                {patientCount}
              </div>
              <button
                type="button"
                onClick={() => {
                  onPatientCountChange(patientCount + 1)
                }}
                className="w-11 h-11 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold text-lg active:bg-brand-600"
                aria-label="+"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
