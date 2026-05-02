import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, hasFirebaseConfig } from '../services/firebase.js'

export interface MunicipalityContact {
  label: string
  hotline: string
  smsShortCode: string
}

// Project-wide fallback shown when:
// - Firebase isn't configured
// - municipalityId is unknown
// - the municipality doc lacks the new contact fields (pre-migration window)
export const DEFAULT_CONTACT: MunicipalityContact = {
  label: 'Daet MDRRMO',
  hotline: '(054) 721-1216',
  smsShortCode: '2933',
}

interface MunicipalityDocLike {
  mdrrmoLabel?: unknown
  mdrrmoHotline?: unknown
  mdrrmoSmsShortCode?: unknown
  label?: unknown
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function toContact(data: MunicipalityDocLike | undefined): MunicipalityContact {
  if (!data) return DEFAULT_CONTACT
  const label = pickString(data.mdrrmoLabel) ?? `${pickString(data.label) ?? 'MDRRMO'} MDRRMO`
  const hotline = pickString(data.mdrrmoHotline) ?? DEFAULT_CONTACT.hotline
  const smsShortCode = pickString(data.mdrrmoSmsShortCode) ?? DEFAULT_CONTACT.smsShortCode
  return { label, hotline, smsShortCode }
}

/**
 * Live-subscribes to `municipalities/{id}` and returns the contact info,
 * falling back to DEFAULT_CONTACT while loading or for unknown jurisdictions.
 */
export function useMunicipalityContact(municipalityId: string | undefined): MunicipalityContact {
  const [contact, setContact] = useState<MunicipalityContact>(DEFAULT_CONTACT)

  useEffect(() => {
    if (!hasFirebaseConfig() || !municipalityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContact(DEFAULT_CONTACT)
      return
    }
    const ref = doc(db(), 'municipalities', municipalityId)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as MunicipalityDocLike) : undefined
        setContact(toContact(data))
      },
      (err) => {
        console.warn('[useMunicipalityContact] snapshot error:', err)
        setContact(DEFAULT_CONTACT)
      },
    )
    return unsubscribe
  }, [municipalityId])

  return contact
}
