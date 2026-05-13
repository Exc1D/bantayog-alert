import { useEffect, useRef, useState } from 'react'
import { Preferences } from '@capacitor/preferences'

export function useFieldNoteDraft(dispatchId: string | undefined) {
  const key = dispatchId ? `field-notes/${dispatchId}` : null
  const [value, setStoredValue] = useState('')
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const [dirtyKey, setDirtyKey] = useState<string | null>(null)
  const dirtyRef = useRef(false)
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
        setHydratedKey(key)
        setStoredValue((currentValue) => (dirtyRef.current ? currentValue : (saved ?? '')))
      })
      .catch(() => {
        if (!active) return
        setHydratedKey(key)
        setStoredValue((currentValue) => (dirtyRef.current ? currentValue : ''))
      })

    return () => {
      active = false
    }
  }, [key])

  useEffect(() => {
    if (key === null || !loaded || !hasLocalEdit) return
    const timeoutId = setTimeout(() => {
      Preferences.set({ key, value }).catch(() => undefined)
    }, 500)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [hasLocalEdit, key, loaded, value])

  const clear = async () => {
    if (key === null) return
    await Preferences.remove({ key })
    dirtyRef.current = false
    setDirtyKey(null)
    setStoredValue('')
    setHydratedKey(key)
  }

  return {
    value: key === null ? '' : loaded || hasLocalEdit ? value : '',
    setValue,
    clear,
    loaded,
  }
}
