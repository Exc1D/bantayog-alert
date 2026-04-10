/**
 * Shared Firestore Service
 *
 * Provides common Firestore operations used across all domains.
 * Wraps Firestore SDK with consistent error handling and typing.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  QueryConstraint,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore'
import { db } from '@/app/firebase/config'

/**
 * Generic document fetcher
 *
 * Fetches a single document by ID from a collection.
 */
export async function getDocument<T extends DocumentData>(
  collectionPath: string,
  docId: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionPath, docId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as unknown as T
    }

    return null
  } catch (error) {
    throw new Error(`Failed to fetch document ${docId} from ${collectionPath}`, {
      cause: error,
    })
  }
}

/**
 * Generic collection fetcher
 *
 * Fetches multiple documents from a collection with optional query constraints.
 */
export async function getCollection<T extends DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  try {
    const collectionRef = collection(db, collectionPath) as CollectionReference<T>

    const q = constraints.length > 0
      ? query(collectionRef, ...constraints)
      : collectionRef

    const querySnap = await getDocs(q)

    return querySnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as T[]
  } catch (error) {
    throw new Error(`Failed to fetch collection ${collectionPath}`, {
      cause: error,
    })
  }
}

/**
 * Generic document creator
 *
 * Adds a new document to a collection with auto-generated ID.
 */
export async function addDocument<T extends DocumentData>(
  collectionPath: string,
  data: Omit<T, 'id'>
): Promise<string> {
  try {
    const collectionRef = collection(db, collectionPath)
    const docRef = await addDoc(collectionRef, data)

    return docRef.id
  } catch (error) {
    throw new Error(`Failed to add document to ${collectionPath}`, {
      cause: error,
    })
  }
}

/**
 * Generic document creator with specific ID
 *
 * Creates a new document with a specific ID (or overwrites if exists).
 */
export async function setDocument<T extends DocumentData>(
  collectionPath: string,
  docId: string,
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, docId)
    await setDoc(docRef, data)
  } catch (error) {
    throw new Error(
      `Failed to set document ${docId} in ${collectionPath}`,
      { cause: error }
    )
  }
}

/**
 * Generic document updater
 *
 * Updates specific fields in a document.
 */
export async function updateDocument<T extends DocumentData>(
  collectionPath: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, docId)
    await updateDoc(docRef, data)
  } catch (error) {
    throw new Error(
      `Failed to update document ${docId} in ${collectionPath}`,
      { cause: error }
    )
  }
}

/**
 * Generic document deleter
 *
 * Deletes a document from a collection.
 */
export async function deleteDocument(
  collectionPath: string,
  docId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, docId)
    await deleteDoc(docRef)
  } catch (error) {
    throw new Error(
      `Failed to delete document ${docId} from ${collectionPath}`,
      { cause: error }
    )
  }
}

/**
 * Query builder helper
 *
 * Builds Firestore queries with type safety.
 */
export function buildQuery(
  collectionPath: string,
  constraints: QueryConstraint[]
): Query {
  const collectionRef = collection(db, collectionPath)
  return query(collectionRef, ...constraints)
}
