/**
 * Test Helper Utilities
 *
 * Common helper functions for integration tests.
 * Provides utilities for creating and cleaning up test data.
 */

import { db } from '@/app/firebase/config'
import { doc, deleteDoc, getDoc } from 'firebase/firestore'
import { deleteAuthUsers } from '../helpers/firebase-admin'
import type { UserProfile, Municipality, Report } from '@/shared/types'

/**
 * Cleanup test users from both Firestore and Firebase Auth
 *
 * @param uids - Array of user UIDs to clean up
 */
export async function cleanupTestUsers(uids: string[]): Promise<void> {
  for (const uid of uids) {
    await deleteDoc(doc(db, 'users', uid)).catch(() => undefined)
    await deleteDoc(doc(db, 'responders', uid)).catch(() => undefined)
  }
  await deleteAuthUsers(uids)
}

/**
 * Cleanup test municipalities
 *
 * @param municipalityIds - Array of municipality IDs to clean up
 */
export async function cleanupTestMunicipalities(
  municipalityIds: string[]
): Promise<void> {
  for (const municipalityId of municipalityIds) {
    try {
      await deleteDoc(doc(db, 'municipalities', municipalityId))
    } catch (error) {
      console.debug(`Failed to cleanup municipality ${municipalityId}:`, error)
    }
  }
}

/**
 * Cleanup test reports (all three tiers)
 *
 * @param reportIds - Array of report IDs to clean up
 */
export async function cleanupTestReports(reportIds: string[]): Promise<void> {
  for (const reportId of reportIds) {
    try {
      await deleteDoc(doc(db, 'reports', reportId))
      await deleteDoc(doc(db, 'report_private', reportId)).catch(() => {})
      await deleteDoc(doc(db, 'report_ops', reportId)).catch(() => {})
    } catch (error) {
      console.debug(`Failed to cleanup report ${reportId}:`, error)
    }
  }
}

/**
 * Generate unique test email
 *
 * @param prefix - Email prefix (e.g., 'responder')
 * @returns Unique email address for testing
 */
export function generateTestEmail(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${prefix}-${timestamp}-${random}@test.bantayog-alert.ph`
}

/**
 * Generate unique test phone number
 *
 * @returns Unique phone number for testing
 */
export function generateTestPhoneNumber(): string {
  const timestamp = Date.now()
  const last4 = timestamp % 10000
  return `+639${String(last4).padStart(4, '0')}`
}

/**
 * Create a test municipality
 *
 * @param name - Municipality name
 * @param overrides - Optional field overrides
 * @returns Municipality ID
 */
export async function createTestMunicipality(
  name: string,
  overrides?: Partial<Municipality>
): Promise<string> {
  const { addDocument } = await import('@/shared/services/firestore.service')

  const municipalityData: Omit<Municipality, 'id'> = {
    name,
    province: 'Camarines Norte',
    population: 50000,
    area: 150,
    coordinates: { latitude: 14.0, longitude: 122.9 },
    totalResponders: 0,
    activeIncidents: 0,
    ...overrides,
  }

  return await addDocument<Municipality>('municipalities', municipalityData)
}

/**
 * Create a test report
 *
 * @param municipality - Municipality name
 * @param overrides - Optional field overrides
 * @returns Report ID
 */
export async function createTestReport(
  municipality: string,
  overrides?: Partial<Report>
): Promise<string> {
  const { addDocument } = await import('@/shared/services/firestore.service')

  const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
    approximateLocation: {
      barangay: 'Test Barangay',
      municipality,
      approximateCoordinates: { latitude: 14.0, longitude: 122.9 },
    },
    incidentType: 'flood',
    severity: 'medium',
    description: 'Test report',
    isAnonymous: false,
    ...overrides,
  }

  const reportId = await addDocument<Report>('reports', {
    ...reportData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'pending',
  })

  // Create operational tier
  await addDocument('report_ops', {
    reportId,
    assignedTo: null,
    assignedAt: null,
    assignedBy: null,
    timeline: [],
  })

  return reportId
}

/**
 * Wait for a condition to be true
 *
 * @param condition - Function that returns boolean
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @param interval - Check interval in milliseconds (default: 100)
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Assert that a document exists in Firestore
 *
 * @param collectionPath - Collection path
 * @param docId - Document ID
 */
export async function assertDocumentExists(
  collectionPath: string,
  docId: string
): Promise<void> {
  const docSnap = await getDoc(doc(db, collectionPath, docId))
  if (!docSnap.exists()) {
    throw new Error(`Document ${docId} does not exist in ${collectionPath}`)
  }
}

/**
 * Assert that a document does not exist in Firestore
 *
 * @param collectionPath - Collection path
 * @param docId - Document ID
 */
export async function assertDocumentNotExists(
  collectionPath: string,
  docId: string
): Promise<void> {
  const docSnap = await getDoc(doc(db, collectionPath, docId))
  if (docSnap.exists()) {
    throw new Error(`Document ${docId} exists in ${collectionPath} but should not`)
  }
}

/**
 * Get user profile with automatic error handling
 *
 * @param uid - User ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  try {
    const docSnap = await getDoc(doc(db, 'users', uid))
    if (!docSnap.exists()) {
      return null
    }
    return docSnap.data() as UserProfile
  } catch (_error) {
    return null
  }
}

/**
 * Assert user has specific role
 *
 * @param uid - User ID
 * @param expectedRole - Expected role
 */
export async function assertUserRole(
  uid: string,
  expectedRole: UserProfile['role']
): Promise<void> {
  const profile = await getUserProfile(uid)
  if (!profile) {
    throw new Error(`User ${uid} not found`)
  }
  if (profile.role !== expectedRole) {
    throw new Error(
      `Expected role ${expectedRole}, got ${profile.role} for user ${uid}`
    )
  }
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 100)
 * @returns Function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  }

  throw lastError
}
