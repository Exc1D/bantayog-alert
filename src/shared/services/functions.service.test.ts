/**
 * Functions Service Tests
 *
 * Tests for Firebase Cloud Functions callable wrappers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/app/firebase/config'
import { callFunction } from './functions.service'

// Mock Firebase Functions SDK
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

// Mock Firebase config
vi.mock('@/app/firebase/config', () => ({
  functions: vi.fn(),
}))

describe('FunctionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('callFunction', () => {
    it('should call a Firebase function with data', async () => {
      const mockResult = { data: { success: true, message: 'Function executed' } }
      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction('testFunction', { input: 'data' })

      expect(result).toEqual(mockResult.data)
      expect(httpsCallable).toHaveBeenCalledWith(functions, 'testFunction', {
        timeout: 54000,
      })
    })

    it('should call a function without data', async () => {
      const mockResult = { data: { success: true } }
      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction('testFunction')

      expect(result).toEqual(mockResult.data)
    })

    it('should handle successful response with typed data', async () => {
      interface TestResponse {
        userId: string
        createdAt: number
      }

      const mockResult = {
        data: {
          userId: 'user-123',
          createdAt: Date.now(),
        },
      }

      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction<TestResponse>('getUserData')

      expect(result.userId).toBe('user-123')
      expect(typeof result.createdAt).toBe('number')
    })

    it('should throw error when function returns error', async () => {
      const mockError = new Error('Function execution failed')
      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(mockError) as any)

      await expect(callFunction('failingFunction')).rejects.toThrow(
        'Failed to call failingFunction: Function execution failed'
      )
    })

    it('should throw error with custom message from Firebase', async () => {
      class FirebaseError extends Error {
        code = 'permission-denied'
        details = 'User does not have permission'
      }
      const firebaseError = new FirebaseError('Permission denied')

      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(firebaseError) as any)

      await expect(callFunction('protectedFunction')).rejects.toThrow(
        'Failed to call protectedFunction: Permission denied'
      )
    })

    it('should handle function that returns null data', async () => {
      const mockResult = { data: null }
      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction('returnsNull')

      expect(result).toBeNull()
    })

    it('should handle function that returns undefined data', async () => {
      const mockResult = { data: undefined }
      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction('returnsUndefined')

      expect(result).toBeUndefined()
    })

    it('should handle complex nested data structures', async () => {
      interface ComplexResponse {
        user: {
          id: string
          profile: {
            name: string
            settings: {
              theme: string
              notifications: boolean
            }
          }
        }
        metadata: {
          version: number
          timestamp: number
        }
      }

      const mockResult = {
        data: {
          user: {
            id: 'user-123',
            profile: {
              name: 'Test User',
              settings: {
                theme: 'dark',
                notifications: true,
              },
            },
          },
          metadata: {
            version: 1,
            timestamp: Date.now(),
          },
        },
      }

      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction<ComplexResponse>('complexFunction')

      expect(result.user.profile.settings.theme).toBe('dark')
      expect(result.metadata.version).toBe(1)
    })

    it('should handle array responses', async () => {
      const mockResult = {
        data: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
          { id: '3', name: 'Item 3' },
        ],
      }

      vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockResolvedValue(mockResult) as any)

      const result = await callFunction<Array<{ id: string; name: string }>>('getItems')

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Item 1')
    })
  })
})
