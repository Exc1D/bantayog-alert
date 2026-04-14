/**
 * Tests for errorMessages.config.ts
 *
 * Verifies that ERROR_MESSAGES contains all expected keys with correct
 * structure: title, message, actionLabel, action, severity fields.
 */

import { describe, it, expect } from 'vitest'
import { ERROR_MESSAGES } from '../errorMessages.config'

describe('ERROR_MESSAGES', () => {
  describe('structure', () => {
    it('should export an object', () => {
      expect(typeof ERROR_MESSAGES).toBe('object')
      expect(ERROR_MESSAGES).not.toBeNull()
    })

    it('should contain exactly 11 error message keys', () => {
      const keys = Object.keys(ERROR_MESSAGES)
      expect(keys).toHaveLength(11)
    })

    it('should contain all expected error keys', () => {
      const expectedKeys = [
        'PERMISSION_DENIED',
        'VALIDATION_ERROR',
        'AUTH_EXPIRED',
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVER_ERROR',
        'SOS_OFFLINE',
        'GPS_TIMEOUT',
        'CANCEL_WINDOW_EXPIRED',
        'SOS_DUPLICATE',
        'SYNC_FAILED',
      ]
      expectedKeys.forEach((key) => {
        expect(ERROR_MESSAGES).toHaveProperty(key)
      })
    })
  })

  describe('PERMISSION_DENIED', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.PERMISSION_DENIED.title).toBe('Session Expired')
    })

    it('should have a message', () => {
      expect(typeof ERROR_MESSAGES.PERMISSION_DENIED.message).toBe('string')
      expect(ERROR_MESSAGES.PERMISSION_DENIED.message.length).toBeGreaterThan(0)
    })

    it('should have RELOGIN action', () => {
      expect(ERROR_MESSAGES.PERMISSION_DENIED.action).toBe('RELOGIN')
    })

    it('should have blocking severity', () => {
      expect(ERROR_MESSAGES.PERMISSION_DENIED.severity).toBe('blocking')
    })

    it('should have Sign In action label', () => {
      expect(ERROR_MESSAGES.PERMISSION_DENIED.actionLabel).toBe('Sign In')
    })
  })

  describe('AUTH_EXPIRED', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.AUTH_EXPIRED.title).toBe('Authentication Failed')
    })

    it('should have RELOGIN action', () => {
      expect(ERROR_MESSAGES.AUTH_EXPIRED.action).toBe('RELOGIN')
    })

    it('should have blocking severity', () => {
      expect(ERROR_MESSAGES.AUTH_EXPIRED.severity).toBe('blocking')
    })

    it('should have Sign In action label', () => {
      expect(ERROR_MESSAGES.AUTH_EXPIRED.actionLabel).toBe('Sign In')
    })
  })

  describe('NETWORK_ERROR', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR.title).toBe('Connection Lost')
    })

    it('should have null actionLabel (no user action required)', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR.actionLabel).toBeNull()
    })

    it('should have null action', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR.action).toBeNull()
    })

    it('should have info severity', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR.severity).toBe('info')
    })
  })

  describe('VALIDATION_ERROR', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.VALIDATION_ERROR.title).toBe('Unable to Update')
    })

    it('should have REFRESH action', () => {
      expect(ERROR_MESSAGES.VALIDATION_ERROR.action).toBe('REFRESH')
    })

    it('should have warning severity', () => {
      expect(ERROR_MESSAGES.VALIDATION_ERROR.severity).toBe('warning')
    })
  })

  describe('TIMEOUT', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.TIMEOUT.title).toBe('Request Timed Out')
    })

    it('should have null actionLabel', () => {
      expect(ERROR_MESSAGES.TIMEOUT.actionLabel).toBeNull()
    })

    it('should have null action', () => {
      expect(ERROR_MESSAGES.TIMEOUT.action).toBeNull()
    })

    it('should have warning severity', () => {
      expect(ERROR_MESSAGES.TIMEOUT.severity).toBe('warning')
    })
  })

  describe('SERVER_ERROR', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.SERVER_ERROR.title).toBe('Server Error')
    })

    it('should have RETRY action', () => {
      expect(ERROR_MESSAGES.SERVER_ERROR.action).toBe('RETRY')
    })

    it('should have warning severity', () => {
      expect(ERROR_MESSAGES.SERVER_ERROR.severity).toBe('warning')
    })

    it('should have Retry action label', () => {
      expect(ERROR_MESSAGES.SERVER_ERROR.actionLabel).toBe('Retry')
    })
  })

  describe('SOS_OFFLINE', () => {
    it('should have a title indicating no internet', () => {
      expect(ERROR_MESSAGES.SOS_OFFLINE.title).toContain('No Internet Connection')
    })

    it('should have DISMISS action', () => {
      expect(ERROR_MESSAGES.SOS_OFFLINE.action).toBe('DISMISS')
    })

    it('should have blocking severity', () => {
      expect(ERROR_MESSAGES.SOS_OFFLINE.severity).toBe('blocking')
    })

    it('should have Dismiss action label', () => {
      expect(ERROR_MESSAGES.SOS_OFFLINE.actionLabel).toBe('Dismiss')
    })
  })

  describe('GPS_TIMEOUT', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.GPS_TIMEOUT.title).toBe('Location Unavailable')
    })

    it('should have RETRY action', () => {
      expect(ERROR_MESSAGES.GPS_TIMEOUT.action).toBe('RETRY')
    })

    it('should have warning severity', () => {
      expect(ERROR_MESSAGES.GPS_TIMEOUT.severity).toBe('warning')
    })

    it('should have Retry action label', () => {
      expect(ERROR_MESSAGES.GPS_TIMEOUT.actionLabel).toBe('Retry')
    })
  })

  describe('CANCEL_WINDOW_EXPIRED', () => {
    it('should have a title about SOS cancellation', () => {
      expect(ERROR_MESSAGES.CANCEL_WINDOW_EXPIRED.title).toBe('SOS Cannot Be Cancelled')
    })

    it('should have DISMISS action', () => {
      expect(ERROR_MESSAGES.CANCEL_WINDOW_EXPIRED.action).toBe('DISMISS')
    })

    it('should have info severity (informational, not blocking)', () => {
      expect(ERROR_MESSAGES.CANCEL_WINDOW_EXPIRED.severity).toBe('info')
    })

    it('should mention 30 seconds in the message', () => {
      expect(ERROR_MESSAGES.CANCEL_WINDOW_EXPIRED.message).toContain('30-second')
    })
  })

  describe('SOS_DUPLICATE', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.SOS_DUPLICATE.title).toBe('SOS Already Active')
    })

    it('should have VIEW_SOS action', () => {
      expect(ERROR_MESSAGES.SOS_DUPLICATE.action).toBe('VIEW_SOS')
    })

    it('should have warning severity', () => {
      expect(ERROR_MESSAGES.SOS_DUPLICATE.severity).toBe('warning')
    })

    it('should have View Active SOS action label', () => {
      expect(ERROR_MESSAGES.SOS_DUPLICATE.actionLabel).toBe('View Active SOS')
    })
  })

  describe('SYNC_FAILED', () => {
    it('should have correct title', () => {
      expect(ERROR_MESSAGES.SYNC_FAILED.title).toBe('Sync Failed')
    })

    it('should have RETRY_SYNC action', () => {
      expect(ERROR_MESSAGES.SYNC_FAILED.action).toBe('RETRY_SYNC')
    })

    it('should have warning severity', () => {
      expect(ERROR_MESSAGES.SYNC_FAILED.severity).toBe('warning')
    })

    it('should have Retry Now action label', () => {
      expect(ERROR_MESSAGES.SYNC_FAILED.actionLabel).toBe('Retry Now')
    })

    it('should mention 5 attempts in the message', () => {
      expect(ERROR_MESSAGES.SYNC_FAILED.message).toContain('5 attempts')
    })
  })

  describe('severity classification', () => {
    it('blocking severity entries should require user login action', () => {
      const blockingEntries = Object.entries(ERROR_MESSAGES).filter(
        ([, v]) => v.severity === 'blocking'
      )
      expect(blockingEntries.length).toBeGreaterThan(0)
      // All blocking entries should be about auth or offline
      blockingEntries.forEach(([key]) => {
        expect(['PERMISSION_DENIED', 'AUTH_EXPIRED', 'SOS_OFFLINE']).toContain(key)
      })
    })

    it('info severity entries should have no blocking action or DISMISS', () => {
      const infoEntries = Object.entries(ERROR_MESSAGES).filter(
        ([, v]) => v.severity === 'info'
      )
      expect(infoEntries.length).toBeGreaterThan(0)
      infoEntries.forEach(([, v]) => {
        expect(['DISMISS', null]).toContain(v.action)
      })
    })

    it('warning severity entries should have actionLabel or null', () => {
      const warningEntries = Object.entries(ERROR_MESSAGES).filter(
        ([, v]) => v.severity === 'warning'
      )
      expect(warningEntries.length).toBeGreaterThan(0)
      warningEntries.forEach(([, v]) => {
        expect(typeof v.actionLabel === 'string' || v.actionLabel === null).toBe(true)
      })
    })
  })
})