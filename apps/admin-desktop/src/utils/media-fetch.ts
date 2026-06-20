import { collection, getDocs, type Firestore } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref } from 'firebase/storage'

export interface MediaItem {
  uploadId: string
  url: string
}

/**
 * Run async tasks with a bounded concurrency pool.
 *
 * `Promise.all` over N reports × M media docs fires every read at once, which
 * during a live event spams Firestore/storage and stalls the UI. This drains a
 * queue with at most `concurrency` tasks in flight.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      const item = items[index]
      cursor += 1
      if (item === undefined) continue
      results[index] = await worker(item)
    }
  }

  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(lanes)
  return results
}

async function resolveOne(
  db: Firestore,
  reportId: string,
): Promise<{ reportId: string; items: MediaItem[]; failed: boolean }> {
  try {
    const mediaSnap = await getDocs(collection(db, 'reports', reportId, 'media'))
    const settled = await Promise.allSettled(
      mediaSnap.docs.map(async (docSnap) => {
        const data = docSnap.data()
        if (typeof data.storagePath !== 'string') return null
        try {
          const url = await getDownloadURL(ref(getStorage(), data.storagePath))
          return { uploadId: docSnap.id, url }
        } catch {
          return null
        }
      }),
    )
    const items = settled
      .filter((r): r is PromiseFulfilledResult<MediaItem | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is MediaItem => v !== null)
    return { reportId, items, failed: false }
  } catch {
    // Whole subcollection read failed (permissions, network). Skip this report;
    // the caller surfaces a soft error rather than aborting the entire batch.
    return { reportId, items: [], failed: true }
  }
}

export interface ReportMediaResult {
  byReport: Record<string, MediaItem[]>
  failedCount: number
}

/**
 * Resolve media items for a set of reports with bounded concurrency.
 *
 * Returns a map keyed by reportId plus a count of reports whose media read
 * failed (permissions, network). Reports that fail are present with an empty
 * array so callers can distinguish "no media" from "fetch error", and the
 * failedCount lets them surface a soft warning without aborting the batch.
 */
export async function resolveReportMedia(
  db: Firestore,
  reportIds: readonly string[],
  concurrency = 6,
): Promise<ReportMediaResult> {
  const results = await mapWithConcurrency(reportIds, concurrency, (reportId) =>
    resolveOne(db, reportId),
  )
  const byReport: Record<string, MediaItem[]> = {}
  let failedCount = 0
  for (const { reportId, items, failed } of results) {
    byReport[reportId] = items
    if (failed) failedCount += 1
  }
  return { byReport, failedCount }
}
