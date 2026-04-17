import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore'
import type { FirebaseApp } from 'firebase/app'
import type { AlertDoc, MinAppVersionDoc } from '@bantayog/shared-types'

export function getFirebaseDb(app: FirebaseApp): Firestore {
  return getFirestore(app)
}

export function subscribeMinAppVersion(
  db: Firestore,
  callback: (value: MinAppVersionDoc | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'system_config', 'min_app_version'),
    (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as MinAppVersionDoc) : null)
    },
    (error) => {
      console.error('subscribeMinAppVersion error:', error)
      callback(null)
    },
  )
}

export function subscribeAlerts(db: Firestore, callback: (value: AlertDoc[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'alerts'), orderBy('publishedAt', 'desc'), limit(5)),
    (snapshot) => {
      callback(snapshot.docs.map((item) => item.data() as AlertDoc))
    },
    (error) => {
      console.error('subscribeAlerts error:', error)
      callback([])
    },
  )
}
