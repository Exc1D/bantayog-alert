import type { Firestore } from 'firebase-admin/firestore'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

export interface MunicipalityLookup {
  label(id: string): Promise<string>
}

export function createMunicipalityLookup(db: Firestore): MunicipalityLookup {
  let cache: Map<string, string> | null = null

  async function ensureLoaded(): Promise<Map<string, string>> {
    if (cache) return cache
    const snap = await db.collection('municipalities').get()
    const map = new Map<string, string>()
    for (const d of snap.docs) {
      const data = d.data() as { label: string }
      map.set(d.id, data.label)
    }
    cache = map
    return map
  }

  return {
    async label(id: string): Promise<string> {
      const map = await ensureLoaded()
      const v = map.get(id)
      if (v === undefined) {
        throw new BantayogError(
          BantayogErrorCode.MUNICIPALITY_NOT_FOUND,
          `Municipality '${id}' is not in jurisdiction.`,
        )
      }
      return v
    },
  }
}
