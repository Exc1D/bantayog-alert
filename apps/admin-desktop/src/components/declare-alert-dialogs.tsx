import { formatShortList } from './declare-alert-options'

interface SubmitConfirmDialogProps {
  submitting: boolean
  alertTypeLabel: string
  selectedMunicipalityLabels: string[]
  onGoBack: () => void
  onSubmit: () => void
}

export function DeclareAlertSubmitConfirmDialog({
  submitting,
  alertTypeLabel,
  selectedMunicipalityLabels,
  onGoBack,
  onSubmit,
}: SubmitConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60"
      role="presentation"
      onClick={(e) => {
        if (!submitting && e.target === e.currentTarget) onGoBack()
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="declare-confirm-title"
        aria-describedby="declare-confirm-copy"
      >
        <h2
          id="declare-confirm-title"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Declare public alert?
        </h2>
        <p id="declare-confirm-copy" className="mt-2 text-sm text-[var(--color-text-secondary)]">
          This publishes an official alert to citizens and responders in the selected scope. Confirm
          only when the details are ready.
        </p>
        <div className="mt-4 space-y-2 rounded-md border border-white/10 bg-[var(--color-surface)] p-3 text-sm">
          <div>
            <p className="text-xs uppercase text-[var(--color-text-muted)]">Alert type</p>
            <p className="font-medium text-[var(--color-text-primary)]">{alertTypeLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[var(--color-text-muted)]">Municipalities</p>
            <p className="font-medium text-[var(--color-text-primary)]">
              {formatShortList(selectedMunicipalityLabels)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onGoBack}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50"
          >
            Go back
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {submitting ? 'Declaring alert...' : 'Declare public alert'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface UnsavedChangesDialogProps {
  onKeepEditing: () => void
  onDiscard: () => void
}

export function DeclareAlertUnsavedChangesDialog({
  onKeepEditing,
  onDiscard,
}: UnsavedChangesDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onKeepEditing()
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <h2 id="unsaved-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
          Unsaved Changes
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          You have unsaved changes in this alert form. Closing will discard them.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onKeepEditing}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10"
          >
            Keep Editing
          </button>
          <button
            onClick={onDiscard}
            className="rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  )
}
