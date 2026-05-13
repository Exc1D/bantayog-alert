import { useEffect, useRef, useState } from 'react'
import { Preferences } from '@capacitor/preferences'

export function useFieldNoteDraft(dispatchId: string | undefined) {
  const key = dispatchId ? `field-notes/${dispatchId}` : null
  const [value, setStoredValue] = useState('')
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const [dirtyKey, setDirtyKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const dirtyRef = useRef(false)
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<Promise<void> | null>(null)
  const loaded = key === null || hydratedKey === key
  const hasLocalEdit = key !== null && dirtyKey === key

  const setValue = (nextValue: string) => {
    dirtyRef.current = true
    setDirtyKey(key)
    setStoredValue(nextValue)
  }

  useEffect(() => {
    if (key === null) {
      dirtyRef.current = false
      return
    }

    let active = true
    dirtyRef.current = false

    Preferences.get({ key })
      .then(({ value: saved }) => {
        if (!active) return
        setLoadError(null)
        setHydratedKey(key)
        setStoredValue((currentValue) => (dirtyRef.current ? currentValue : (saved ?? '')))
      })
      .catch((error: unknown) => {
        if (!active) return
        console.error('[useFieldNoteDraft] failed to hydrate draft:', error)
        setLoadError(error instanceof Error ? error : new Error('Failed to hydrate draft'))
        setHydratedKey(key)
      })

    return () => {
      active = false
    }
  }, [key])

  useEffect(() => {
    if (key === null || !loaded || !hasLocalEdit) return
    const savedKey = key
    autosaveTimeoutRef.current = setTimeout(() => {
      const savePromise = Preferences.set({ key: savedKey, value })
        .catch((err: unknown) => {
          console.error('[useFieldNoteDraft] autosave failed:', err)
          if (savedKey === key) {
            setDirtyKey(null)
          }
        })
        .finally(() => {
          if (pendingSaveRef.current === savePromise) {
            pendingSaveRef.current = null
          }
        })
      pendingSaveRef.current = savePromise
    }, 500)

    return () => {
      if (autosaveTimeoutRef.current !== null) {
        clearTimeout(autosaveTimeoutRef.current)
        autosaveTimeoutRef.current = null
      }
    }
  }, [hasLocalEdit, key, loaded, value])

  const clear = async () => {
    if (key === null) return
    if (autosaveTimeoutRef.current !== null) {
      clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }
    await pendingSaveRef.current
    await Preferences.remove({ key })
    dirtyRef.current = false
    setDirtyKey(null)
    setStoredValue('')
    setHydratedKey(key)
    setLoadError(null)
  }

  return {
    value: key === null ? '' : loaded || hasLocalEdit ? value : '',
    setValue,
    clear,
    loaded,
    loadError,
  }
}
