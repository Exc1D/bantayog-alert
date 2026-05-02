const CACHE_NAME = 'bantayog_shell_v1'
// WARNING: This must match the localforage instance name in
// apps/citizen-pwa/src/services/draft-store.ts ('bantayog-drafts').
// The SW uses raw IndexedDB; localforage wraps IndexedDB with its own
// internal schema. Sharing data between them requires care — the SW
// reads the same DB name but accesses a separate object store created
// when the app explicitly writes sync-state metadata for the SW.
const DB_NAME = 'bantayog-drafts'
const DB_STORE = 'drafts'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                (name.startsWith('bantayog_shell_') || name.startsWith('bantayog-shell-')) &&
                name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        if (event.request.method === 'GET') {
          return caches.match(event.request)
        }
        throw new Error('not found')
      }),
  )
})

// Background Sync — complementary to in-app retry machine.
// Chrome/Edge only; iOS Safari falls back to in-app machine.
// Idempotency key (draft.id) on the write ensures dedup if both
// the SW and the in-app machine both succeed.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'submit-report') return
  event.waitUntil(submitQueuedDrafts())
})

async function openDraftsDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(DB_STORE, { keyPath: 'id' })
      store.createIndex('syncState', 'syncState', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function submitQueuedDrafts() {
  const db = await openDraftsDB()
  const tx = db.transaction(DB_STORE, 'readonly')
  const store = tx.objectStore(DB_STORE)
  const index = store.index('syncState')

  const syncingReq = index.getAll('syncing')
  const localOnlyReq = index.getAll('local_only')

  const syncingDrafts = await readRequest(syncingReq)
  const localOnlyDrafts = await readRequest(localOnlyReq)
  const queuedDrafts = [...syncingDrafts, ...localOnlyDrafts]

  await Promise.allSettled(
    queuedDrafts.map((draft) =>
      submitDraft(draft).then(() => updateDraftSyncState(db, draft.id, 'synced')),
    ),
  )
}

function readRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
}

async function submitDraft(draft) {
  const inboxDoc = {
    reporterUid: draft.reporterUid ?? '',
    clientCreatedAt: draft.clientCreatedAt,
    idempotencyKey: draft.idempotencyKey,
    publicRef: draft.publicRef,
    secretHash: draft.secretHash,
    correlationId: draft.correlationId,
    payload: {
      reportType: draft.reportType,
      description: draft.description,
      severity: draft.severity,
      source: 'web',
      clientDraftRef: draft.clientDraftRef,
      ...(draft.publicLocation ? { publicLocation: draft.publicLocation } : {}),
      ...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {}),
      ...(draft.barangayId ? { barangayId: draft.barangayId } : {}),
      ...(draft.nearestLandmark ? { nearestLandmark: draft.nearestLandmark } : {}),
      ...(draft.reporterName ? { reporterName: draft.reporterName } : {}),
      ...(draft.reporterMsisdnHash ? { reporterMsisdnHash: draft.reporterMsisdnHash } : {}),
    },
  }

  // Firebase Firestore REST API — no Firebase JS SDK bundle needed.
  const projectId = self.location.hostname.includes('localhost')
    ? 'demo-project'
    : self.location.hostname.includes('staging')
      ? 'bantayog-staging'
      : 'bantayog-alert'

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/report_inbox/${draft.id}?documentId=${draft.id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inboxDoc),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Firestore REST ${response.status}: ${text}`)
  }
}

async function updateDraftSyncState(db, draftId, syncState) {
  const tx = db.transaction(DB_STORE, 'readwrite')
  const store = tx.objectStore(DB_STORE)
  const getReq = store.get(draftId)
  const draft = await new Promise((resolve, reject) => {
    getReq.onsuccess = () => resolve(getReq.result)
    getReq.onerror = () => reject(getReq.error)
  })
  if (!draft) return
  draft.syncState = syncState
  draft.updatedAt = Date.now()
  await new Promise((resolve, reject) => {
    const putReq = store.put(draft)
    putReq.onsuccess = () => resolve(undefined)
    putReq.onerror = () => reject(putReq.error)
  })
}
