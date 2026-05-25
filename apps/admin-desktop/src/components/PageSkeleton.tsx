interface Props {
  variant: 'dashboard' | 'map' | 'feed' | 'dispatch'
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      data-testid="skeleton-block"
      className={`animate-pulse rounded bg-white/5 ${className ?? ''}`}
    />
  )
}

export function PageSkeleton({ variant }: Props) {
  const label = `Loading ${variant}…`

  if (variant === 'dashboard') {
    return (
      <div
        role="status"
        aria-label={label}
        aria-live="polite"
        className="flex h-screen flex-col bg-[var(--color-surface)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <SkeletonBlock className="h-6 w-48" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="h-8 w-20" />
          </div>
        </div>
        {/* Status bar */}
        <div className="flex gap-4 border-b border-white/10 px-4 py-2">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 p-4">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </div>
        {/* Main content grid */}
        <div className="grid flex-1 grid-cols-[3fr_2fr] gap-4 p-4 pt-0">
          <div className="space-y-4">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-48" />
          </div>
          <div className="space-y-4">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'map') {
    return (
      <div
        role="status"
        aria-label={label}
        aria-live="polite"
        className="flex h-screen flex-col bg-[var(--color-surface)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="h-8 w-20" />
        </div>
        <SkeletonBlock className="flex-1" />
      </div>
    )
  }

  if (variant === 'feed') {
    return (
      <div
        role="status"
        aria-label={label}
        aria-live="polite"
        className="flex h-screen flex-col bg-[var(--color-surface)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <SkeletonBlock className="h-6 w-32" />
        </div>
        <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <div className="space-y-4">
            <SkeletonBlock className="h-32" />
            <SkeletonBlock className="h-32" />
            <SkeletonBlock className="h-32" />
          </div>
          <div className="space-y-4">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  // dispatch
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className="flex h-screen flex-col bg-[var(--color-surface)]"
    >
      <div className="flex-1 space-y-4 p-4">
        <div className="grid grid-cols-4 gap-4">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </div>
        <SkeletonBlock className="h-48" />
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-48" />
      </div>
    </div>
  )
}
