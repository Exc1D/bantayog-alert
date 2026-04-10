/**
 * Municipality Validation Integration Tests
 *
 * Tests that municipality assignments are validated during admin registration.
 * Prevents creation of admin accounts for non-existent municipalities.
 *
 * Run with Firebase Emulator: firebase emulators:exec "vitest run tests/integration/municipality-validation.test.ts"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { registerMunicipalAdmin } from '@/domains/municipal-admin/services/auth.service'
import { addDocument } from '@/shared/services/firestore.service'
import { auth, db } from '@/app/firebase/config'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import type { Municipality } from '@/shared/types'

describe('Municipality Validation', () => {
  const testUsers: string[] = []
  const testMunicipalities: string[] = []

  // Cleanup test data after each test
  afterEach(async () => {
    // Clean up test users
    for (const uid of testUsers) {
      try {
        await deleteDoc(doc(db, 'users', uid))
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

  describe('registerMunicipalAdmin', () => {
    it('should successfully register admin for valid municipality', async () => {
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

      // Register admin for this municipality
      const credentials = {
        email: 'admin@daet.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Daet Admin',
        municipality: municipalityId,
      }

      const result = await registerMunicipalAdmin(credentials)

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(credentials.email)
      expect(result.user.municipality).toBe(municipalityId)
      expect(result.user.role).toBe('municipal_admin')

      // Track for cleanup
      testUsers.push(result.user.uid)
    })

    it('should reject registration for non-existent municipality', async () => {
      const credentials = {
        email: 'admin@fake.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Fake Admin',
        municipality: 'non-existent-municipality-id',
      }

      // Should throw error with MUNICIPALITY_NOT_FOUND code
      try {
        await registerMunicipalAdmin(credentials)
        // If we get here, test should fail
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('does not exist')
        expect((error as { cause?: { code?: string } }).cause?.code).toBe(
          'MUNICIPALITY_NOT_FOUND'
        )
      }
    })

    it('should reject registration when municipality is not provided', async () => {
      const credentials = {
        email: 'admin@gov.ph',
        password: 'SecurePass123!',
        displayName: 'Test Admin',
        municipality: '', // EMPTY!
      }

      await expect(
        registerMunicipalAdmin(credentials as any)
      ).rejects.toThrow('Municipality assignment is required')
    })

    it('should include municipality name in error message', async () => {
      const fakeMunicipalityName = 'San Jose (Non-Existent)'

      const credentials = {
        email: 'admin@gov.ph',
        password: 'SecurePass123!',
        displayName: 'Test Admin',
        municipality: fakeMunicipalityName,
      }

      try {
        await registerMunicipalAdmin(credentials)
        expect(true).toBe(false)
      } catch (error) {
        expect((error as Error).message).toContain(fakeMunicipalityName)
      }
    })

    it('should store municipality in user profile', async () => {
      // Create test municipality
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'Basud',
        province: 'Camarines Norte',
        population: 50000,
        area: 150,
        coordinates: { latitude: 14.05, longitude: 122.9 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      const credentials = {
        email: 'admin@basud.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Basud Admin',
        municipality: municipalityId,
      }

      const result = await registerMunicipalAdmin(credentials)
      testUsers.push(result.user.uid)

      // Verify municipality is stored in Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid))
      const userProfile = userDoc.data()

      expect(userProfile?.municipality).toBe(municipalityId)
    })

    it('should allow multiple admins for same municipality', async () => {
      // Create test municipality
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'Vinzons',
        province: 'Camarines Norte',
        population: 30000,
        area: 100,
        coordinates: { latitude: 14.08, longitude: 122.85 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      // Register first admin
      const firstCredentials = {
        email: 'admin1@vinzons.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Vinzons Admin 1',
        municipality: municipalityId,
      }

      const firstResult = await registerMunicipalAdmin(firstCredentials)
      testUsers.push(firstResult.user.uid)

      // Register second admin for same municipality
      const secondCredentials = {
        email: 'admin2@vinzons.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Vinzons Admin 2',
        municipality: municipalityId,
      }

      const secondResult = await registerMunicipalAdmin(secondCredentials)
      testUsers.push(secondResult.user.uid)

      expect(firstResult.user.municipality).toBe(municipalityId)
      expect(secondResult.user.municipality).toBe(municipalityId)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent registration attempts for same municipality', async () => {
      // Create test municipality
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'Paracale',
        province: 'Camarines Norte',
        population: 40000,
        area: 180,
        coordinates: { latitude: 14.2, longitude: 122.8 },
        totalResponders: 0,
        activeIncidents: 0,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      const credentials = {
        email: 'admin@paracale.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Paracale Admin',
        municipality: municipalityId,
      }

      // Try to register two admins simultaneously
      const results = await Promise.allSettled([
        registerMunicipalAdmin({
          ...credentials,
          email: 'admin1@paracale.gov.ph',
        }),
        registerMunicipalAdmin({
          ...credentials,
          email: 'admin2@paracale.gov.ph',
        }),
      ])

      // Both should succeed (multiple admins allowed per municipality)
      const successCount = results.filter((r) => r.status === 'fulfilled').length

      expect(successCount).toBe(2)

      // Track for cleanup
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          testUsers.push(result.value.user.uid)
        }
      })
    })

    it('should handle municipality deletion between validation and registration', async () => {
      // Create test municipality
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

      // Immediately delete the municipality
      await deleteDoc(doc(db, 'municipalities', municipalityId))
      testMunicipalities.pop() // Remove from cleanup list since we already deleted it

      // Try to register admin for deleted municipality
      const credentials = {
        email: 'admin@sanlorenzo.gov.ph',
        password: 'SecurePass123!',
        displayName: 'San Lorenzo Admin',
        municipality: municipalityId,
      }

      // Should fail because municipality no longer exists
      await expect(registerMunicipalAdmin(credentials)).rejects.toThrow(
        'does not exist'
      )
    })

    it('should validate municipality ID format', async () => {
      const invalidIds = [
        '', // Empty
        '   ', // Whitespace only
        'id with spaces', // Contains spaces
        'id-with-special!@#', // Special characters
      ]

      for (const invalidId of invalidIds) {
        const credentials = {
          email: `admin${Date.now()}@gov.ph`,
          password: 'SecurePass123!',
          displayName: 'Test Admin',
          municipality: invalidId,
        }

        // Should fail because municipality with this ID doesn't exist
        await expect(registerMunicipalAdmin(credentials)).rejects.toThrow()
      }
    })
  })

  describe('Integration with Firestore Data', () => {
    it('should verify municipality data integrity', async () => {
      // Create municipality with specific properties
      const municipalityData: Omit<Municipality, 'id'> = {
        name: 'San Vicente',
        province: 'Camarines Norte',
        population: 25000,
        area: 120,
        coordinates: { latitude: 14.12, longitude: 122.92 },
        totalResponders: 5,
        activeIncidents: 2,
      }

      const municipalityId = await addDocument<Municipality>(
        'municipalities',
        municipalityData
      )
      testMunicipalities.push(municipalityId)

      // Verify municipality was created correctly
      const municipalityDoc = await getDoc(doc(db, 'municipalities', municipalityId))
      const municipality = municipalityDoc.data() as Municipality

      expect(municipality.name).toBe('San Vicente')
      expect(municipality.province).toBe('Camarines Norte')
      expect(municipality.totalResponders).toBe(5)

      // Register admin for this municipality
      const credentials = {
        email: 'admin@sanvicente.gov.ph',
        password: 'SecurePass123!',
        displayName: 'San Vicente Admin',
        municipality: municipalityId,
      }

      const result = await registerMunicipalAdmin(credentials)
      testUsers.push(result.user.uid)

      expect(result.user.municipality).toBe(municipalityId)
    })

    it('should handle case-sensitive municipality IDs', async () => {
      // Create municipality with specific case
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

      // Try to register with wrong case
      const wrongCaseId = municipalityId.toUpperCase()

      const credentials = {
        email: 'admin@mercedes.gov.ph',
        password: 'SecurePass123!',
        displayName: 'Mercedes Admin',
        municipality: wrongCaseId,
      }

      // Should fail because ID doesn't match exactly
      await expect(registerMunicipalAdmin(credentials)).rejects.toThrow(
        'does not exist'
      )
    })
  })
})
