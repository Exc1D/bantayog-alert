interface ContactFieldsProps {
  reporterName: string
  onReporterNameChange: (name: string) => void
  nameError: string | null
  onNameErrorClear: () => void

  reporterMsisdn: string
  onReporterMsisdnChange: (msisdn: string) => void
  phoneError: string | null
  onPhoneErrorClear: () => void

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
    </div>
  )
}
