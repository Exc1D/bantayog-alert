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
    <>
      {hasMemory && <p className="memory-hint">Pre-filled from your last report</p>}
      <div className="field-group">
        <p className="field-label">Your name</p>
        <input
          type="text"
          value={reporterName}
          onChange={(e) => {
            onReporterNameChange(e.target.value)
            onNameErrorClear()
          }}
          placeholder="Maria Dela Cruz"
          className="text-input"
          required
        />
        {nameError && (
          <p className="field-error" data-testid="name-error">
            {nameError}
          </p>
        )}
      </div>

      <div className="field-group">
        <p className="field-label">Phone number</p>
        <input
          type="tel"
          value={reporterMsisdn}
          onChange={(e) => {
            onReporterMsisdnChange(e.target.value)
            onPhoneErrorClear()
          }}
          placeholder="+63 912 345 6789"
          className="text-input"
          required
        />
        {phoneError && (
          <p className="field-error" data-testid="phone-error">
            {phoneError}
          </p>
        )}
        <p className="phone-hint">
          <strong>Gives you faster help.</strong> Admins call this number if they need more details.{' '}
          <em>Mas mabilis kang matutulungan.</em>
        </p>
      </div>

      <div className="field-group field-group--urgent">
        <p className="field-label">
          Is anyone hurt?
          <em className="field-label-optional"> May injured ba?</em>
        </p>
        <div className="toggle-group">
          <button
            type="button"
            onClick={() => {
              onAnyoneHurtChange(true)
            }}
            className={`toggle-btn${anyoneHurt ? ' toggle-btn--selected' : ''}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              onAnyoneHurtChange(false)
            }}
            className={`toggle-btn${!anyoneHurt ? ' toggle-btn--selected' : ''}`}
          >
            No
          </button>
        </div>

        {anyoneHurt && (
          <div className="patient-advisory">
            <p className="patient-advisory-label">How many patients?</p>
            <div className="patient-counter">
              <button
                type="button"
                onClick={() => {
                  onPatientCountChange(Math.max(0, patientCount - 1))
                }}
                className="counter-btn"
                disabled={patientCount === 0}
              >
                −
              </button>
              <div className="counter-display">{patientCount}</div>
              <button
                type="button"
                onClick={() => {
                  onPatientCountChange(patientCount + 1)
                }}
                className="counter-increment-btn"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
