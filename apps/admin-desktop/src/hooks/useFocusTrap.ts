import { useEffect, useRef, useCallback } from 'react'

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const selector =
    'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) =>
      !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled') && el.offsetParent !== null,
  )
}

interface UseFocusTrapOptions {
  isActive: boolean
  onEscape?: () => void
}

export function useFocusTrap({ isActive, onEscape }: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusable = getFocusableElements(containerRef.current)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (
        document.activeElement === first ||
        !containerRef.current?.contains(document.activeElement)
      ) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (
        document.activeElement === last ||
        !containerRef.current?.contains(document.activeElement)
      ) {
        e.preventDefault()
        first?.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (!isActive) return

    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus first focusable element when trap activates, but only if focus
    // is not already inside the container (prevents stealing focus from a
    // user- or test-selected element).
    const focusable = getFocusableElements(containerRef.current)
    if (focusable.length > 0) {
      requestAnimationFrame(() => {
        const current = document.activeElement
        if (!containerRef.current?.contains(current)) {
          focusable[0]?.focus()
        }
      })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
        return
      }
      handleTabKey(e)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, onEscape, handleTabKey])

  // Return focus to trigger when trap deactivates
  useEffect(() => {
    if (!isActive) {
      previousFocusRef.current?.focus()
    }
  }, [isActive])

  return containerRef
}
