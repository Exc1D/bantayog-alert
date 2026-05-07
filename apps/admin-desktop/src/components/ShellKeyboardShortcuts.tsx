import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Registers province-superadmin keyboard shortcuts.
 * N → /province/ndrrmc (NDRRMC Escalation Queue)
 * A → /province/emergency (Emergency Declaration)
 *
 * Shortcuts are suppressed when focus is in an input, textarea, or select.
 * Render this once inside AppLayout so shortcuts are active throughout the shell.
 */
export function ShellKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      switch (e.key) {
        case 'n':
        case 'N':
          void navigate('/province/ndrrmc')
          break
        case 'a':
        case 'A':
          void navigate('/province/emergency')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [navigate])

  // Renders nothing — side-effect only
  return null
}
