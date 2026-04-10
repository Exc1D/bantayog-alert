/**
 * Test Fixtures
 *
 * Provides pre-configured test data and fixtures to reduce boilerplate in tests.
 * Fixtures are reusable test data that can be customized per test.
 */

import type {
  UserProfile,
  Municipality,
  Report,
  Responder,
  ReportPrivate,
  ReportOps,
} from '@/shared/types'

/**
 * User profile fixtures
 */
export const userFixtures = {
  citizen: (overrides?: Partial<UserProfile>): UserProfile => ({
    uid: 'test-citizen-uid',
    email: 'citizen@test.bantayog-alert.ph',
    displayName: 'Test Citizen',
    role: 'citizen',
    emailVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  }),

  responder: (overrides?: Partial<UserProfile>): UserProfile => ({
    uid: 'test-responder-uid',
    email: 'responder@test.bantayog-alert.ph',
    displayName: 'Test Responder',
    phoneNumber: '+639123456789',
    phoneVerified: false,
    role: 'responder',
    municipality: 'municipality-daet',
    emailVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  }),

  municipalAdmin: (municipalityId = 'municipality-daet', overrides?: Partial<UserProfile>): UserProfile => ({
    uid: 'test-admin-uid',
    email: 'admin@test.bantayog-alert.ph',
    displayName: 'Test Admin',
    role: 'municipal_admin',
    municipality: municipalityId,
    emailVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  }),

  provincialSuperadmin: (overrides?: Partial<UserProfile>): UserProfile => ({
    uid: 'test-superadmin-uid',
    email: 'superadmin@test.bantayog-alert.ph',
    displayName: 'Test Superadmin',
    role: 'provincial_superadmin',
    mfaSettings: {
      enabled: true,
      enrollmentTime: Date.now(),
      lastVerified: Date.now(),
    },
    emailVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    ...overrides,
  }),
}

/**
 * Municipality fixtures
 */
export const municipalityFixtures = {
  daet: (overrides?: Partial<Municipality>): Municipality => ({
    id: 'municipality-daet',
    name: 'Daet',
    province: 'Camarines Norte',
    population: 100000,
    area: 200,
    coordinates: { latitude: 14.1167, longitude: 122.95 },
    totalResponders: 10,
    activeIncidents: 2,
    ...overrides,
  }),

  basud: (overrides?: Partial<Municipality>): Municipality => ({
    id: 'municipality-basud',
    name: 'Basud',
    province: 'Camarines Norte',
    population: 50000,
    area: 150,
    coordinates: { latitude: 14.05, longitude: 122.9 },
    totalResponders: 5,
    activeIncidents: 1,
    ...overrides,
  }),

  vinzons: (overrides?: Partial<Municipality>): Municipality => ({
    id: 'municipality-vinzons',
    name: 'Vinzons',
    province: 'Camarines Norte',
    population: 30000,
    area: 100,
    coordinates: { latitude: 14.08, longitude: 122.85 },
    totalResponders: 3,
    activeIncidents: 0,
    ...overrides,
  }),
}

/**
 * Report fixtures
 */
export const reportFixtures = {
  flood: (municipality = 'Daet', overrides?: Partial<Report>): Report => ({
    id: 'report-flood-001',
    incidentType: 'flood',
    severity: 'high',
    description: 'Major flooding in downtown area',
    approximateLocation: {
      address: `Downtown ${municipality}`,
      municipality,
      coordinates: { latitude: 14.1167, longitude: 122.95 },
    },
    reportedBy: 'citizen@example.com',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'pending',
    ...overrides,
  }),

  fire: (municipality = 'Daet', overrides?: Partial<Report>): Report => ({
    id: 'report-fire-001',
    incidentType: 'fire',
    severity: 'critical',
    description: 'Building fire in residential area',
    approximateLocation: {
      address: `Residential area, ${municipality}`,
      municipality,
      coordinates: { latitude: 14.12, longitude: 122.92 },
    },
    reportedBy: 'citizen@example.com',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'verified',
    ...overrides,
  }),

  landslide: (municipality = 'Daet', overrides?: Partial<Report>): Report => ({
    id: 'report-landslide-001',
    incidentType: 'landslide',
    severity: 'medium',
    description: 'Landslide blocking main road',
    approximateLocation: {
      address: `Main road, ${municipality}`,
      municipality,
      coordinates: { latitude: 14.1, longitude: 122.88 },
    },
    reportedBy: 'citizen@example.com',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'assigned',
    ...overrides,
  }),
}

/**
 * Report private tier fixtures
 */
export const reportPrivateFixtures = {
  basic: (reportId = 'report-001', overrides?: Partial<ReportPrivate>): ReportPrivate => ({
    id: 'report-private-001',
    reportId,
    reporterUserId: 'citizen-uid',
    reporterName: 'Test Citizen',
    reporterContact: '+639123456789',
    reporterAddress: '123 Main St, Daet',
    additionalNotes: 'Please respond quickly',
    ...overrides,
  }),

  anonymous: (reportId = 'report-001', overrides?: Partial<ReportPrivate>): ReportPrivate => ({
    id: 'report-private-001',
    reportId,
    reporterUserId: 'anonymous',
    reporterName: 'Anonymous Citizen',
    reporterContact: '',
    reporterAddress: '',
    additionalNotes: '',
    ...overrides,
  }),
}

/**
 * Report operational tier fixtures
 */
export const reportOpsFixtures = {
  basic: (reportId = 'report-001', overrides?: Partial<ReportOps>): ReportOps => ({
    id: 'report-ops-001',
    reportId,
    assignedTo: null,
    assignedAt: null,
    assignedBy: null,
    timeline: [
      {
        timestamp: Date.now(),
        action: 'report_created',
        performedBy: 'citizen-uid',
        notes: 'Initial report submitted',
      },
    ],
    ...overrides,
  }),

  assigned: (reportId = 'report-001', responderId = 'responder-001', overrides?: Partial<ReportOps>): ReportOps => ({
    id: 'report-ops-001',
    reportId,
    assignedTo: responderId,
    assignedAt: Date.now(),
    assignedBy: 'admin-uid',
    timeline: [
      {
        timestamp: Date.now(),
        action: 'report_created',
        performedBy: 'citizen-uid',
        notes: 'Initial report submitted',
      },
      {
        timestamp: Date.now() + 1000,
        action: 'report_verified',
        performedBy: 'admin-uid',
        notes: 'Report verified by admin',
      },
      {
        timestamp: Date.now() + 2000,
        action: 'responder_assigned',
        performedBy: 'admin-uid',
        notes: `Assigned to responder ${responderId}`,
      },
    ],
    ...overrides,
  }),
}

/**
 * Responder fixtures
 */
export const responderFixtures = {
  available: (uid = 'responder-001', overrides?: Partial<Responder>): Responder => ({
    uid,
    phoneNumber: '+639123456789',
    phoneVerified: true,
    isOnDuty: true,
    isAvailable: true,
    capabilities: ['flood', 'fire', 'landslide'],
    totalAssignments: 10,
    completedAssignments: 8,
    ...overrides,
  }),

  unavailable: (uid = 'responder-001', overrides?: Partial<Responder>): Responder => ({
    uid,
    phoneNumber: '+639123456789',
    phoneVerified: true,
    isOnDuty: false,
    isAvailable: false,
    capabilities: ['flood', 'fire'],
    totalAssignments: 5,
    completedAssignments: 5,
    ...overrides,
  }),

  unverified: (uid = 'responder-001', overrides?: Partial<Responder>): Responder => ({
    uid,
    phoneNumber: '+639123456789',
    phoneVerified: false,
    isOnDuty: false,
    isAvailable: false,
    capabilities: [],
    totalAssignments: 0,
    completedAssignments: 0,
    ...overrides,
  }),
}

/**
 * Auth credentials fixtures
 */
export const authFixtures = {
  citizen: (email = 'citizen@test.com') => ({
    email,
    password: 'SecurePass123!',
    displayName: 'Test Citizen',
  }),

  responder: (email = 'responder@test.com') => ({
    email,
    password: 'SecurePass123!',
    displayName: 'Test Responder',
    phoneNumber: '+639123456789',
  }),

  municipalAdmin: (email = 'admin@test.com', municipality = 'municipality-daet') => ({
    email,
    password: 'SecurePass123!',
    displayName: 'Test Admin',
    municipality,
  }),

  provincialSuperadmin: (email = 'superadmin@test.com') => ({
    email,
    password: 'SecurePass123!',
    displayName: 'Test Superadmin',
    mfaRequired: true,
  }),
}

/**
 * Generate unique test identifiers
 */
export const generateTestId = {
  user: (prefix = 'user') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`,

  email: (prefix = 'test') => `${prefix}-${Date.now()}@test.bantayog-alert.ph`,

  phone: () => {
    const timestamp = Date.now()
    const last4 = timestamp % 10000
    return `+639${String(last4).padStart(4, '0')}`
  },

  report: (prefix = 'report') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`,

  municipality: (name = 'test') => `municipality-${name}-${Date.now()}`,
}

/**
 * Common test scenarios
 */
export const testScenarios = {
  // Scenario: Complete responder registration flow
  responderRegistration: {
    credentials: authFixtures.responder(),
    userProfile: userFixtures.responder(),
    responderProfile: responderFixtures.unverified(),
    expectedError: null,
  },

  // Scenario: Duplicate phone number
  duplicatePhone: {
    existingPhone: '+639123456789',
    newCredentials: authFixtures.responder('new-responder@test.com'),
    expectedError: {
      code: 'PHONE_ALREADY_IN_USE',
      message: 'already registered to another responder',
    },
  },

  // Scenario: Invalid municipality
  invalidMunicipality: {
    invalidMunicipalityId: 'non-existent-municipality',
    credentials: authFixtures.municipalAdmin('admin@test.com', 'invalid-id'),
    expectedError: {
      code: 'MUNICIPALITY_NOT_FOUND',
      message: 'does not exist',
    },
  },

  // Scenario: Cross-municipality assignment
  crossMunicipalityAssignment: {
    reportMunicipality: 'Daet',
    responderMunicipality: 'Basud',
    expectedError: {
      code: 'CROSS_MUNICIPALITY_ASSIGNMENT_NOT_ALLOWED',
      message: 'Cross-municipality assignment',
    },
  },
}

/**
 * Test data builders for complex scenarios
 */
export const testDataBuilders = {
  // Builder: Create user with custom claims
  userWithClaims: (role: UserProfile['role'], claims?: Partial<UserProfile>) => ({
    ...userFixtures.citizen(),
    role,
    ...claims,
  }),

  // Builder: Create responder in specific municipality
  responderInMunicipality: (municipalityId: string) => ({
    ...userFixtures.responder(),
    municipality: municipalityId,
  }),

  // Builder: Create report with full three tiers
  fullReport: (municipality = 'Daet', reportId?: string) => {
    const id = reportId || generateTestId.report()
    return {
      public: reportFixtures.flood(municipality, { id }),
      private: reportPrivateFixtures.basic(id),
      ops: reportOpsFixtures.basic(id),
    }
  },

  // Builder: Create municipality with responders
  municipalityWithResponders: (responderCount = 5) => ({
    ...municipalityFixtures.daet(),
    totalResponders: responderCount,
  }),
}

/**
 * Mock data for testing edge cases
 */
export const edgeCases = {
  emptyString: '',
  whitespaceOnly: '   ',
  veryLongString: 'a'.repeat(1000),
  specialCharacters: '!@#$%^&*()',
  internationalCharacters: 'ñáéíóú',

  // Boundary values
  boundaryValues: {
    minPopulation: 1,
    maxPopulation: 10000000,
    minSeverity: 'low' as const,
    maxSeverity: 'critical' as const,
  },

  // Invalid data
  invalidEmail: 'not-an-email',
  invalidPhone: '123',
  invalidCoordinates: { latitude: 999, longitude: 999 },
  invalidMunicipalityId: '',
}

/**
 * Export all fixtures as default for easy importing
 */
export default {
  user: userFixtures,
  municipality: municipalityFixtures,
  report: reportFixtures,
  reportPrivate: reportPrivateFixtures,
  reportOps: reportOpsFixtures,
  responder: responderFixtures,
  auth: authFixtures,
  id: generateTestId,
  scenarios: testScenarios,
  builders: testDataBuilders,
  edgeCases,
}
