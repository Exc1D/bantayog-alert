export default function MobileGate() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[var(--color-surface)] p-6 text-center">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Command Center</h1>
      <p className="mt-4 text-[var(--color-text-secondary)]">
        The Command Center requires a desktop browser (1024px or wider).
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Please open on a laptop or desktop computer.
      </p>
    </div>
  )
}
