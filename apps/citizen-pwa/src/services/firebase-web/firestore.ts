import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore'
import type { FirebaseApp } from 'firebase/app'
import type { AlertDoc } from '@bantayog/shared-types'

const HAZARD_TITLE: Record<string, string> = {
  flood: 'Flood Alert',
  fire: 'Fire Alert',
  typhoon: 'Typhoon Alert',
  landslide: 'Landslide Alert',
}

const HAZARD_SEVERITY: Record<string, AlertDoc['severity']> = {
  flood: 'high',
  fire: 'high',
  typhoon: 'high',
  landslide: 'high',
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function numberField(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key]
  return typeof value === 'number' ? value : undefined
}

function severityField(data: Record<string, unknown>, hazardType: string): AlertDoc['severity'] {
  const severity = stringField(data, 'severity')
  if (
    severity === 'info' ||
    severity === 'low' ||
    severity === 'medium' ||
    severity === 'high' ||
    severity === 'critical'
  ) {
    return severity
  }
  return HAZARD_SEVERITY[hazardType] ?? 'info'
}

// fallow-ignore-next-line complexity
function mapAlertDoc(id: string, data: Record<string, unknown>): AlertDoc {
  const hazardType = stringField(data, 'hazardType') ?? 'alert'
  return {
    id: stringField(data, 'id') ?? stringField(data, 'alertId') ?? id,
    title: stringField(data, 'title') ?? HAZARD_TITLE[hazardType] ?? 'Alert',
    body: stringField(data, 'body') ?? stringField(data, 'message') ?? '',
    severity: severityField(data, hazardType),
    publishedAt: numberField(data, 'publishedAt') ?? numberField(data, 'declaredAt') ?? 0,
    publishedBy: stringField(data, 'publishedBy') ?? stringField(data, 'declaredBy') ?? '',
  }
}

export function getFirebaseDb(app: FirebaseApp): Firestore {
  return getFirestore(app)
}

export function subscribeAlerts(
  db: Firestore,
  callback: (value: AlertDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'alerts'),
      where('visibility', '==', 'public'),
      orderBy('publishedAt', 'desc'),
      limit(5),
    ),
    (snapshot) => {
      callback(snapshot.docs.map((item) => mapAlertDoc(item.id, item.data())))
    },
    (error) => {
      console.error('subscribeAlerts error:', error)
      if (onError) {
        onError(error)
      } else {
        callback([])
      }
    },
  )
}
