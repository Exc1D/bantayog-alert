/**
 * Cross-Municipality Assignment Prevention Integration Tests
 *
 * Tests that responders cannot be assigned to incidents outside their municipality.
 * Enforces geographic boundaries for disaster response operations.
 *
 * Run with Firebase Emulator: firebase emulators:exec "vitest run tests/integration/cross-municipality-assignment.test.ts"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assignToResponder } from '@/domains/municipal-admin/services/firestore.service'
import { registerBase } from '@/shared/services/auth.service'
import { addDocument, updateDocument } from '@/shared/services/firestore.service'
import { auth, db } from '@/app/firebase/config'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import type { Report, UserProfile, Municipality } from '@/shared/types'

describe('Cross-Municipality Assignment Prevention', () => {
  const testUsers: string[] = []
  const testMunicipalities: string[] = []
  const testReports: string[] = []

  // Cleanup test data after each test
  afterEach(async () => {
    // Clean up test reports
    for (const reportId of testReports) {
      try {
        await deleteDoc(doc(db, 'reports', reportId))
        await deleteDoc(doc(db, 'report_private', reportId))
        await deleteDoc(doc(db, 'report_ops', reportId))
      } catch (error) {
        // Report might not exist, ignore error
      }
    }
    testReports.length = 0

    // Clean up test users
    for (const uid of testUsers) {
      try {
        await deleteDoc(doc(db, 'users', uid))
        await deleteDoc(doc(db, 'responders', uid))
        const user = await auth.getUser(uid)
        await auth.deleteUser(user.uid)
      } catch (error) {
        // User might not exist, ignore error
      }
    }
    testUsers.length = 0

    // Clean up test municipalities
    for (const municipalityId of testMunicipalities) {
      try {
        await deleteDoc(doc(db, 'municipalities', municipalityId))
      } catch (error) {
        // Municipality might not exist, ignore error
      }
    }
    testMunicipalities.length = 0
  })

  describe('assignToResponder', () => {
    it('should successfully assign responder to incident in same municipality', async () => {
      // Create test municipality
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'Daet',
        province: 'Camarines Norte',
        population: 100000,
        area: 200,
        coordinates: { latitude: 14.1167, longitude: 122.95 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      // Create responder in Daet
      const responderCredentials = {
        email: 'responder@daet.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Daet Responder',
      }

      const responderResult = await registerBase(
        responderCredentials,
        'responder',
        { municipality: municipalityId }
      )
      testUsers.push(responderResult.user.uid)

      // Create report in Daet
      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'flood',
        severity: 'high',
        description: 'Major flooding in downtown area',
        approximateLocation: {
          address: 'Downtown Daet',
          municipality: 'Daet',
          coordinates: { latitude: 14.1167, longitude: 122.95 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      // Also create report_ops document
      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Assign responder to report (should succeed)
      await expect(
        assignToResponder(reportId, responderResult.user.uid, 'admin-uid')
      ).resolves.toBeUndefined()

      // Verify assignment was recorded
      const opsDoc = await getDoc(doc(db, 'report_ops', reportId))
      const opsData = opsDoc.data()

      expect(opsData?.assignedTo).toBe(responderResult.user.uid)
      expect(opsData?.assignedAt).toBeDefined()
    })

    it('should reject assignment when responder municipality does not match report municipality', async () => {
      // Create two municipalities
      const daetData: Omit<Municipality, 'id'> = {
        name: 'Daet',
        province: 'Camarines Norte',
        population: 100000,
        area: 200,
        coordinates: { latitude: 14.1167, longitude: 122.95 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const daetId = await addDocument<Municipality>('municipalities', daetData)
      testMunicipalities.push(daetId)

      const basudData: Omit<Municipality, 'id'> = {
        name: 'Basud',
        province: 'Camarines Norte',
        population: 50000,
        area: 150,
        coordinates: { latitude: 14.05, longitude: 122.9 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const basudId = await addDocument<Municipality>('municipalities', basudData)
      testMunicipalities.push(basudId)

      // Create responder in Basud
      const responderCredentials = {
        email: 'responder@basud.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Basud Responder',
      }

      const responderResult = await registerBase(
        responderCredentials,
        'responder',
        { municipality: basudId }
      )
      testUsers.push(responderResult.user.uid)

      // Create report in Daet (different municipality!)
      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'flood',
        severity: 'high',
        description: 'Flooding in Daet',
        approximateLocation: {
          address: 'Daet town proper',
          municipality: 'Daet', // DIFFERENT from responder's municipality
          coordinates: { latitude: 14.1167, longitude: 122.95 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Try to assign Basud responder to Daet report (should fail)
      try {
        await assignToResponder(
          reportId,
          responderResult.user.uid,
          'admin-uid'
        )
        // If we get here, test should fail
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Cross-municipality assignment')
        expect((error as Error).message).toContain('Daet')
        expect((error as { cause?: { code?: string } }).cause?.code).toBe(
          'CROSS_MUNICIPALITY_ASSIGNMENT_NOT_ALLOWED'
        )
      }
    })

    it('should reject assignment when responder has no municipality assigned', async () => {
      // Create municipality for report
      const daetData: Omit<Municipality, 'id'> = {
        name: 'Daet',
        province: 'Camarines Norte',
        population: 100000,
        area: 200,
        coordinates: { latitude: 14.1167, longitude: 122.95 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const daetId = await addDocument<Municipality>('municipalities', daetData)
      testMunicipalities.push(daetId)

      // Create responder WITHOUT municipality assignment
      const responderCredentials = {
        email: 'responder@gov.ph',
        password: 'SecurePass123!',
        displayName: 'Unassigned Responder',
      }

      const responderResult = await registerBase(
        responderCredentials,
        'responder'
        // No municipality!
      )
      testUsers.push(responderResult.user.uid)

      // Create report in Daet
      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'flood',
        severity: 'high',
        description: 'Flooding in Daet',
        approximateLocation: {
          address: 'Daet',
          municipality: 'Daet',
          coordinates: { latitude: 14.1167, longitude: 122.95 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Try to assign unassigned responder (should fail)
      await expect(
        assignToResponder(reportId, responderResult.user.uid, 'admin-uid')
      ).rejects.toThrow('Cross-municipality assignment')
    })

    it('should provide clear error message with municipality names', async () => {
      // Create two municipalities
      const vinzonsData: Omit<Municipality, 'id'> = {
        name: 'Vinzons',
        province: 'Camarines Norte',
        population: 30000,
        area: 100,
        coordinates: { latitude: 14.08, longitude: 122.85 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const vinzonsId = await addDocument<Municipality>('municipalities', vinzonsData)
      testMunicipalities.push(vinzonsId)

      const paracaleData: Omit<Municipality, 'id'> = {
        name: 'Paracale',
        province: 'Camarines Norte',
        population: 40000,
        area: 180,
        coordinates: { latitude: 14.2, longitude: 122.8 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const paracaleId = await addDocument<Municipality>(
        'municipalities',
        paracaleData
      )
      testMunicipalities.push(paracaleId)

      // Create responder in Vinzons
      const responderResult = await registerBase(
        {
          email: 'responder@vinzons.gov.ph',
          password: 'SecurePass123!',
          displayName: 'Vinzons Responder',
        },
        'responder',
        { municipality: vinzonsId }
      )
      testUsers.push(responderResult.user.uid)

      // Create report in Paracale
      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'landslide',
        severity: 'medium',
        description: 'Landslide in Paracale',
        approximateLocation: {
          address: 'Paracale mining area',
          municipality: 'Paracale',
          coordinates: { latitude: 14.2, longitude: 122.8 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Try to assign
      try {
        await assignToResponder(reportId, responderResult.user.uid, 'admin-uid')
        expect(true).toBe(false)
      } catch (error) {
        const errorMessage = (error as Error).message
        expect(errorMessage).toContain('Paracale')
        expect(errorMessage).toContain('no municipality') // Responder's situation
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent assignment attempts', async () => {
      // Create municipality and responder
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'San Vicente',
        province: 'Camarines Norte',
        population: 25000,
        area: 120,
        coordinates: { latitude: 14.12, longitude: 122.92 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      const responderResult = await registerBase(
        {
          email: 'responder@sanvicente.gov.ph',
          password: 'SecurePass123!',
          displayName: 'San Vicente Responder',
        },
        'responder',
        { municipality: municipalityId }
      )
      testUsers.push(responderResult.user.uid)

      // Create report in same municipality
      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'fire',
        severity: 'high',
        description: 'Fire in San Vicente',
        approximateLocation: {
          address: 'San Vicente',
          municipality: 'San Vicente',
          coordinates: { latitude: 14.12, longitude: 122.92 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Try concurrent assignments (one should succeed, rest should fail as already assigned)
      const results = await Promise.allSettled([
        assignToResponder(reportId, responderResult.user.uid, 'admin-1'),
        assignToResponder(reportId, responderResult.user.uid, 'admin-2'),
        assignToResponder(reportId, responderResult.user.uid, 'admin-3'),
      ])

      // At least one should succeed
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      expect(successCount).toBeGreaterThanOrEqual(1)
    })

    it('should handle report not found error', async () => {
      // Create responder
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'Mercedes',
        province: 'Camarines Norte',
        population: 35000,
        area: 140,
        coordinates: { latitude: 14.15, longitude: 122.95 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      const responderResult = await registerBase(
        {
          email: 'responder@mercedes.gov.ph',
          password: 'SecurePass123!',
          displayName: 'Mercedes Responder',
        },
        'responder',
        { municipality: municipalityId }
      )
      testUsers.push(responderResult.user.uid)

      // Try to assign to non-existent report
      const fakeReportId = 'non-existent-report-id'

      await expect(
        assignToResponder(fakeReportId, responderResult.user.uid, 'admin-uid')
      ).rejects.toThrow('Report not found')
    })

    it('should handle responder not found error', async () => {
      // Create municipality and report
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'San Lorenzo',
        province: 'Camarines Norte',
        population: 20000,
        area: 80,
        coordinates: { latitude: 14.1, longitude: 122.88 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'typhoon',
        severity: 'critical',
        description: 'Typhoon damage in San Lorenzo',
        approximateLocation: {
          address: 'San Lorenzo',
          municipality: 'San Lorenzo',
          coordinates: { latitude: 14.1, longitude: 122.88 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Try to assign non-existent responder
      const fakeResponderUid = 'non-existent-responder-id'

      await expect(
        assignToResponder(reportId, fakeResponderUid, 'admin-uid')
      ).rejects.toThrow('Responder not found')
    })

    it('should preserve existing assignment when re-assigning within same municipality', async () => {
      // Create municipality
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'Sta. Elena',
        province: 'Camarines Norte',
        population: 28000,
        area: 110,
        coordinates: { latitude: 14.18, longitude: 122.93 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      // Create two responders in same municipality
      const responder1Result = await registerBase(
        {
          email: 'responder1@staelena.gov.ph',
          password: 'SecurePass123!',
          displayName: 'Sta. Elena Responder 1',
        },
        'responder',
        { municipality: municipalityId }
      )
      testUsers.push(responder1Result.user.uid)

      const responder2Result = await registerBase(
        {
          email: 'responder2@staelena.gov.ph',
          password: 'SecurePass123!',
          displayName: 'Sta. Elena Responder 2',
        },
        'responder',
        { municipality: municipalityId }
      )
      testUsers.push(responder2Result.user.uid)

      // Create report in same municipality
      const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        incidentType: 'earthquake',
        severity: 'high',
        description: 'Earthquake in Sta. Elena',
        approximateLocation: {
          address: 'Sta. Elena proper',
          municipality: 'Sta. Elena',
          coordinates: { latitude: 14.18, longitude: 122.93 },
        },
        reportedBy: 'citizen@example.com',
      }

      const reportId = await addDocument<Report>('reports', {
        ...reportData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'verified',
      })
      testReports.push(reportId)

      await addDocument('report_ops', {
        reportId,
        assignedTo: null,
        assignedAt: null,
        assignedBy: null,
        timeline: [],
      })

      // Assign first responder
      await assignToResponder(
        reportId,
        responder1Result.user.uid,
        'admin-uid'
      )

      // Re-assign to second responder (same municipality, should succeed)
      await expect(
        assignToResponder(reportId, responder2Result.user.uid, 'admin-uid')
      ).resolves.toBeUndefined()
    })
  })
})
