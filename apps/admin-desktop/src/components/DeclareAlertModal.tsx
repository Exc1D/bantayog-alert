import { AlertTriangle, X } from 'lucide-react'
import {
  DeclareAlertSubmitConfirmDialog,
  DeclareAlertUnsavedChangesDialog,
} from './declare-alert-dialogs'
import { AlertFormFields } from './AlertFormFields'
import { useDeclareAlert } from './useDeclareAlert'

interface Props {
  open: boolean
  prefill?:
    | {
        municipalityId: string | undefined
        reportId: string | undefined
      }
    | undefined
  onClose: () => void
  onSuccess: (alertId: string) => void
  onError: (message: string) => void
}

export function DeclareAlertModal({ open, prefill, onClose, onSuccess, onError }: Props) {
  const {
    trapRef,
    dialogRef,
    hazardType,
    selectedMunicipalityIds,
    showBarangaySelector,
    selectedBarangayIds,
    selectedSectors,
    effectiveFrom,
    effectiveUntil,
    expectedResolutionAt,
    roadName,
    message,
    submitting,
    showUnsavedWarning,
    showSubmitConfirm,
    submitError,
    validationErrors,
    isValid,
    handleRequestClose,
    handleBackdropClick,
    handleReviewSubmit,
    handleSubmit,
    handleHazardTypeChange,
    toggleMunicipality,
    toggleBarangay,
    toggleAllBarangaysForMunicipality,
    toggleSector,
    setShowBarangaySelector,
    setEffectiveFrom,
    setEffectiveUntil,
    setExpectedResolutionAt,
    setRoadName,
    setMessage,
    setShowSubmitConfirm,
    setShowUnsavedWarning,
    alertTypeLabel,
    selectedMunicipalityLabels,
    selectedMunicipalitySummary,
  } = useDeclareAlert({ open, prefill, onClose, onSuccess, onError })

  if (!open) return null

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--color-surface)]/80"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="declare-alert-title"
        aria-describedby="declare-alert-description"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />
              <h2
                id="declare-alert-title"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Declare Alert
              </h2>
            </div>
            <p
              id="declare-alert-description"
              className="mt-1 text-xs text-[var(--color-text-muted)]"
            >
              Publish an official public alert to the selected municipalities.
            </p>
          </div>
          <button
            onClick={handleRequestClose}
            disabled={submitting}
            className="rounded p-1 hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault()
            handleReviewSubmit()
          }}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <AlertFormFields
              hazardType={hazardType}
              selectedMunicipalityIds={selectedMunicipalityIds}
              showBarangaySelector={showBarangaySelector}
              selectedBarangayIds={selectedBarangayIds}
              selectedSectors={selectedSectors}
              effectiveFrom={effectiveFrom}
              effectiveUntil={effectiveUntil}
              expectedResolutionAt={expectedResolutionAt}
              roadName={roadName}
              message={message}
              submitError={submitError}
              validationErrors={validationErrors}
              selectedMunicipalitySummary={selectedMunicipalitySummary}
              onHazardTypeChange={handleHazardTypeChange}
              onToggleMunicipality={toggleMunicipality}
              onToggleBarangay={toggleBarangay}
              onToggleAllBarangaysForMunicipality={toggleAllBarangaysForMunicipality}
              onToggleSector={toggleSector}
              onSetShowBarangaySelector={setShowBarangaySelector}
              onSetEffectiveFrom={setEffectiveFrom}
              onSetEffectiveUntil={setEffectiveUntil}
              onSetExpectedResolutionAt={setExpectedResolutionAt}
              onSetRoadName={setRoadName}
              onSetMessage={setMessage}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-white/10 p-6">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={submitting}
              className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
            >
              {submitting && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {submitting ? 'Declaring alert...' : 'Review declaration'}
            </button>
          </div>
        </form>
      </div>
      {showSubmitConfirm && (
        <DeclareAlertSubmitConfirmDialog
          submitting={submitting}
          alertTypeLabel={alertTypeLabel}
          selectedMunicipalityLabels={selectedMunicipalityLabels}
          onGoBack={() => {
            setShowSubmitConfirm(false)
          }}
          onSubmit={() => {
            void handleSubmit()
          }}
        />
      )}
      {showUnsavedWarning && (
        <DeclareAlertUnsavedChangesDialog
          onKeepEditing={() => {
            setShowUnsavedWarning(false)
          }}
          onDiscard={() => {
            setShowUnsavedWarning(false)
            onClose()
          }}
        />
      )}
    </div>
  )
}
