import { useEffect, useRef } from 'react'

interface ShortcutConfig {
  key: string
  shift?: boolean
  ctrl?: boolean
  handler: () => void
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  )
}

export function useKeyboardShortcuts(configs: ShortcutConfig[]) {
  const configsRef = useRef(configs)

  useEffect(() => {
    configsRef.current = configs
  }, [configs])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return
      for (const cfg of configsRef.current) {
        if (e.key.toLowerCase() !== cfg.key.toLowerCase()) continue
        if (cfg.shift && !e.shiftKey) continue
        if (cfg.ctrl && !e.ctrlKey) continue
        e.preventDefault()
        cfg.handler()
        break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
