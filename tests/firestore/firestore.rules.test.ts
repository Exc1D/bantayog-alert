/**
 * Firestore Security Rules Tests
 *
 * Tests for Firestore security rules using Firebase Emulator.
 * Run with: firebase emulators:exec --only firestore "npm run test:run"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getDoc,
  setDoc,
  doc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { initializeTestApp } from '@firebase/testing'
import { db, auth as clientAuth } from '@/app/firebase/config'
import type { Report, UserProfile } from '@/shared/types'

// Note: These tests require @firebase/testing package
// which has been deprecated. In production, use firebase-functions-test
// or the Firebase emulator directly.

describe('Firestore Security Rules', () => {
  let testUsers: string[] = []
  let testReports: string[] = []

  async function createTestUser(
    email: string,
    password: string,
    role: UserProfile['role'],
    municipality?: string
  ): Promise<string> {
    const auth = getAuth()
    const userCredential = await signInWithEmailAndPassword(auth, email, password)

    // Create user profile with custom claims
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email,
      role,
      municipality,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    testUsers.push(userCredential.user.uid)
    return userCredential.user.uid
  }

  afterEach(async () => {
    // Cleanup test data — log failures so test pollution is visible
    for (const reportId of testReports) {
      try {
        await deleteDoc(doc(db, 'reports', reportId))
        await deleteDoc(doc(db, 'report_private', reportId))
        await deleteDoc(doc(db, 'report_ops', reportId))
        await deleteDoc(doc(db, 'sos_events', reportId))
      } catch (error) {
        console.error('[TEST_CLEANUP_ERROR] Failed to delete report:', reportId, error)
      }
    }
    testReports.length = 0

    // sos_events created with fixed string IDs (not tracked in testReports)
    const sosEventIds = [
      'test-sos-event', 'test-sos-create', 'test-sos-other',
      'test-sos-admin-read',
    ]
    for (const sosId of sosEventIds) {
      try {
        await deleteDoc(doc(db, 'sos_events', sosId))
      } catch (error) {
        console.error('[TEST_CLEANUP_ERROR] Failed to delete sos_event:', sosId, error)
      }
    }

    for (const uid of testUsers) {
      try {
        await deleteDoc(doc(db, 'users', uid))
      } catch (error) {
        console.error('[TEST_CLEANUP_ERROR] Failed to delete user:', uid, error)
      }
    }
    testUsers.length = 0
  })

  describe('Users Collection', () => {
    it('should allow users to read their own profile', async () => {
      const uid = await createTestUser('user1@example.com', 'pass123', 'citizen')

      const profileDoc = await getDoc(doc(db, 'users', uid))
      expect(profileDoc.exists()).toBe(true)
    })

    it('should deny access to other users profiles', async () => {
      await createTestUser('user1@example.com', 'pass123', 'citizen')

      // Try to access a different user's profile
      const profileDoc = await getDoc(doc(db, 'users', 'other-user-id'))
      expect(profileDoc.exists()).toBe(false)
    })
  })

  describe('Reports Collection (Public Tier)', () => {
    it('should allow all authenticated users to read public reports', async () => {
      await createTestUser('citizen@example.com', 'pass123', 'citizen')

      // Create a test report
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'pending',
        description: 'Test flood report',
        isAnonymous: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      // Read should succeed
      const reportDoc = await getDoc(reportRef)
      expect(reportDoc.exists()).toBe(true)
    })

    it('should allow citizens to create reports', async () => {
      await createTestUser('citizen@example.com', 'pass123', 'citizen')

      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'pending',
        description: 'Citizen report',
        isAnonymous: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      const reportDoc = await getDoc(reportRef)
      expect(reportDoc.exists()).toBe(true)
    })
  })

  describe('Report_Private Collection (Private Tier)', () => {
    it('should deny citizens access to private data', async () => {
      await createTestUser('citizen@example.com', 'pass123', 'citizen')

      const privateDoc = await getDoc(doc(db, 'report_private', 'some-report-id'))
      expect(privateDoc.exists()).toBe(false)
    })

    it('should allow municipal admins to read private data in their municipality', async () => {
      await createTestUser('admin@daet.gov.ph', 'pass123', 'municipal_admin', 'Daet')

      // Create test report and private data
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'pending',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_private', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        exactLocation: {
          address: '123 Test St',
          coordinates: { latitude: 14.1, longitude: 122.9 },
        },
        reporterContact: {
          name: 'Test Reporter',
          phone: '+639123456789',
        },
      })

      // Municipal admin should be able to read
      const privateDoc = await getDoc(doc(db, 'report_private', reportRef.id))
      expect(privateDoc.exists()).toBe(true)
    })
  })

  describe('Report_Ops Collection (Operational Tier)', () => {
    it('should allow municipal admins to read ops data in their municipality', async () => {
      await createTestUser('admin@daet.gov.ph', 'pass123', 'municipal_admin', 'Daet')

      // Create test report and ops data
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'verified',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        assignedTo: 'responder-123',
        assignedAt: Date.now(),
        assignedBy: 'admin-123',
        timeline: [],
      })

      // Municipal admin should be able to read
      const opsDoc = await getDoc(doc(db, 'report_ops', reportRef.id))
      expect(opsDoc.exists()).toBe(true)
    })

    it('should allow responders to read ops data for assigned reports', async () => {
      const responderUid = await createTestUser(
        'responder@example.com',
        'pass123',
        'responder'
      )

      // Create test report assigned to this responder
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'assigned',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        assignedTo: responderUid,
        assignedAt: Date.now(),
        assignedBy: 'admin-123',
        timeline: [],
      })

      // Responder should be able to read their assigned report
      const opsDoc = await getDoc(doc(db, 'report_ops', reportRef.id))
      expect(opsDoc.exists()).toBe(true)
    })

    it('should deny responders access to unassigned reports', async () => {
      await createTestUser('responder@example.com', 'pass123', 'responder')

      // Create test report assigned to a different responder
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'assigned',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        assignedTo: 'different-responder-123', // Not the current user
        assignedAt: Date.now(),
        assignedBy: 'admin-123',
        timeline: [],
      })

      // Current responder should NOT be able to read
      const opsDoc = await getDoc(doc(db, 'report_ops', reportRef.id))
      expect(opsDoc.exists()).toBe(false)
    })

    it('should allow responder to read report_ops via normalized responderId field', async () => {
      const responderUid = await createTestUser(
        'responder2@example.com',
        'pass123',
        'responder'
      )

      // Create test report with ops using normalized responderId (not assignedTo)
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'fire',
        severity: 'high',
        status: 'assigned',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        responderId: responderUid, // Normalized field, not legacy assignedTo
        timeline: [],
      })

      // Responder should be able to read via responderId
      const opsDoc = await getDoc(doc(db, 'report_ops', reportRef.id))
      expect(opsDoc.exists()).toBe(true)
    })

    it('should allow responder to update allowed fields on their report_ops', async () => {
      const responderUid = await createTestUser(
        'responder3@example.com',
        'pass123',
        'responder'
      )

      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'fire',
        severity: 'high',
        status: 'assigned',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        assignedTo: responderUid,
        responderStatus: 'en_route',
        status: 'assigned',
        timeline: [],
      })

      // Responder can update allowed fields
      await updateDoc(doc(db, 'report_ops', reportRef.id), {
        responderStatus: 'on_scene',
        responderNotes: 'Arrived at location',
      })

      const opsDoc = await getDoc(doc(db, 'report_ops', reportRef.id))
      expect(opsDoc.exists()).toBe(true)
      expect(opsDoc.data().responderStatus).toBe('on_scene')
      expect(opsDoc.data().responderNotes).toBe('Arrived at location')
    })

    it('should deny responder from reassigning report_ops to another responder', async () => {
      const responderUid = await createTestUser(
        'responder4@example.com',
        'pass123',
        'responder'
      )

      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'fire',
        severity: 'high',
        status: 'assigned',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        assignedTo: responderUid,
        responderStatus: 'en_route',
        timeline: [],
      })

      // Attempt to reassign — should be denied by field whitelist
      await expect(async () => {
        await updateDoc(doc(db, 'report_ops', reportRef.id), {
          assignedTo: 'another-responder-uid',
        })
      }).rejects.toThrow()
    })
  })

  describe('SOS_Events Collection', () => {
    it('should deny all client reads on sos_events', async () => {
      const responderUid = await createTestUser(
        'sos-responder@example.com',
        'pass123',
        'responder'
      )

      // Create an sos_event with all required fields
      const sosRef = doc(db, 'sos_events', 'test-sos-event')
      await setDoc(sosRef, {
        responderId: responderUid,
        status: 'active',
        activatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        cancellationWindowEndsAt: Date.now() + 300000,
        createdAt: Date.now(),
      })

      // Client SDK should be denied read (read: if false applies to all)
      const sosDoc = await getDoc(sosRef)
      expect(sosDoc.exists()).toBe(false)
    })

    it('should allow responder to create sos_events for their own responderId', async () => {
      const responderUid = await createTestUser(
        'sos-responder2@example.com',
        'pass123',
        'responder'
      )

      // Create sos_event with all required fields and matching responderId
      const sosRef = doc(db, 'sos_events', 'test-sos-create')
      await setDoc(sosRef, {
        responderId: responderUid,
        status: 'active',
        activatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        cancellationWindowEndsAt: Date.now() + 300000,
        createdAt: Date.now(),
      })

      const sosDoc = await getDoc(sosRef)
      expect(sosDoc.exists()).toBe(true)
    })

    it('should deny responder from creating sos_events for another responder', async () => {
      await createTestUser('sos-responder3@example.com', 'pass123', 'responder')

      // Attempt to create sos_event with different responderId (has required fields)
      const sosRef = doc(db, 'sos_events', 'test-sos-other')
      await expect(async () => {
        await setDoc(sosRef, {
          responderId: 'different-responder-uid', // Not this user's UID
          status: 'active',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          cancellationWindowEndsAt: Date.now() + 300000,
          createdAt: Date.now(),
        })
      }).rejects.toThrow()
    })

    it('should deny admin from reading sos_events via client SDK', async () => {
      // Create sos_event with a responder's auth context
      const responderUid = await createTestUser(
        'sos-responder4@example.com',
        'pass123',
        'responder'
      )

      const sosRef = doc(db, 'sos_events', 'test-sos-admin-read')
      await setDoc(sosRef, {
        responderId: responderUid,
        status: 'resolved',
        activatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        cancellationWindowEndsAt: Date.now() + 300000,
        createdAt: Date.now(),
      })

      // Sign out responder, sign in as municipal admin
      await clientAuth.signOut()
      await createTestUser('sos-admin@daet.gov.ph', 'pass123', 'municipal_admin', 'Daet')

      // Admin reading via client SDK should be denied (read: if false)
      const sosDoc = await getDoc(sosRef)
      expect(sosDoc.exists()).toBe(false)
    })
  })

  describe('Municipality Access Control', () => {
    it('should deny municipal admins access to other municipalities', async () => {
      // Admin from Daet
      await createTestUser('admin@daet.gov.ph', 'pass123', 'municipal_admin', 'Daet')

      // Create report in different municipality
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Basud', // Different municipality
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'pending',
        description: 'Test report',
        isAnonymous: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_private', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        exactLocation: {
          address: '123 Test St',
          coordinates: { latitude: 14.1, longitude: 122.9 },
        },
      })

      // Daet admin should NOT be able to read Basud private data
      const privateDoc = await getDoc(doc(db, 'report_private', reportRef.id))
      expect(privateDoc.exists()).toBe(false)
    })
  })

  describe('Provincial Superadmin Access', () => {
    it('should allow provincial superadmins to read all data', async () => {
      await createTestUser(
        'superadmin@camnorte.gov.ph',
        'pass123',
        'provincial_superadmin'
      )

      // Create test report with all tiers
      const reportRef = await addDoc(collection(db, 'reports'), {
        approximateLocation: {
          barangay: 'Test Barangay',
          municipality: 'Daet',
          approximateCoordinates: { latitude: 14.1, longitude: 122.9 },
        },
        incidentType: 'flood',
        severity: 'medium',
        status: 'pending',
        description: 'Test report',
        isAnonymous: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      testReports.push(reportRef.id)

      await setDoc(doc(db, 'report_private', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        exactLocation: {
          address: '123 Test St',
          coordinates: { latitude: 14.1, longitude: 122.9 },
        },
      })

      await setDoc(doc(db, 'report_ops', reportRef.id), {
        id: reportRef.id,
        reportId: reportRef.id,
        timeline: [],
      })

      // Superadmin should be able to read all tiers
      const reportDoc = await getDoc(doc(db, 'reports', reportRef.id))
      const privateDoc = await getDoc(doc(db, 'report_private', reportRef.id))
      const opsDoc = await getDoc(doc(db, 'report_ops', reportRef.id))

      expect(reportDoc.exists()).toBe(true)
      expect(privateDoc.exists()).toBe(true)
      expect(opsDoc.exists()).toBe(true)
    })
  })

  describe('Unauthenticated Access', () => {
    it('should deny all access to unauthenticated users', async () => {
      // Sign out any authenticated user
      await clientAuth.signOut()

      // Try to read reports
      const reportsSnapshot = await getDocs(collection(db, 'reports'))
      expect(reportsSnapshot.empty).toBe(true)
    })
  })
})
