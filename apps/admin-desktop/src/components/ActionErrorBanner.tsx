interface Props {
  message: string
  onDismiss: () => void
}

export function ActionErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      className="mb-4 border border-[var(--color-danger)] bg-[var(--color-danger)]/20 px-4 py-2 text-sm text-[var(--color-danger)]"
      role="alert"
    >
      {message}
      <button onClick={onDismiss} className="ml-2 underline">
        Dismiss
      </button>
    </div>
  )
}
