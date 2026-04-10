/**
 * Firestore Service Tests
 *
 * Tests for shared Firestore operations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDocument,
  getCollection,
  addDocument,
  setDocument,
  updateDocument,
  deleteDocument,
} from './firestore.service'
import { db } from '@/app/firebase/config'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'

describe('FirestoreService', () => {
  const testCollection = 'test_documents'
  const testDocIds: string[] = []

  afterEach(async () => {
    // Cleanup test documents
    for (const docId of testDocIds) {
      try {
        await deleteDoc(doc(db, testCollection, docId))
      } catch (error) {
        // Ignore
      }
    }
    testDocIds.length = 0
  })

  describe('getDocument', () => {
    it('should fetch a document by ID', async () => {
      const docRef = doc(db, testCollection, 'test-doc-1')
      await testDocIds.push('test-doc-1')

      // Create test document
      await setDocument(testCollection, 'test-doc-1', {
        name: 'Test Document',
        value: 42,
      })

      // Fetch document
      const result = await getDocument(testCollection, 'test-doc-1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('test-doc-1')
      expect(result?.name).toBe('Test Document')
      expect(result?.value).toBe(42)
    })

    it('should return null for non-existent document', async () => {
      const result = await getDocument(testCollection, 'non-existent')
      expect(result).toBeNull()
    })
  })

  describe('getCollection', () => {
    beforeEach(async () => {
      // Create test documents
      await setDocument(testCollection, 'coll-test-1', { name: 'Doc 1', value: 1 })
      await setDocument(testCollection, 'coll-test-2', { name: 'Doc 2', value: 2 })
      await setDocument(testCollection, 'coll-test-3', { name: 'Doc 3', value: 3 })

      testDocIds.push('coll-test-1', 'coll-test-2', 'coll-test-3')
    })

    it('should fetch all documents in collection', async () => {
      const results = await getCollection(testCollection)

      expect(results.length).toBeGreaterThanOrEqual(3)
      expect(results.some((doc) => doc.name === 'Doc 1')).toBe(true)
    })
  })

  describe('addDocument', () => {
    it('should add document with auto-generated ID', async () => {
      const docId = await addDocument(testCollection, {
        name: 'New Document',
        value: 100,
      })

      expect(docId).toBeDefined()
      expect(typeof docId).toBe('string')

      // Verify document was created
      const docRef = await getDoc(doc(db, testCollection, docId))
      expect(docRef.exists()).toBe(true)
      expect(docRef.data().name).toBe('New Document')

      testDocIds.push(docId)
    })
  })

  describe('setDocument', () => {
    it('should create document with specific ID', async () => {
      await setDocument(testCollection, 'specific-id', {
        name: 'Specific Document',
        value: 200,
      })

      // Verify document was created
      const result = await getDocument(testCollection, 'specific-id')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Specific Document')

      testDocIds.push('specific-id')
    })

    it('should overwrite existing document', async () => {
      await setDocument(testCollection, 'overwrite-test', {
        name: 'Original',
        value: 1,
      })
      testDocIds.push('overwrite-test')

      await setDocument(testCollection, 'overwrite-test', {
        name: 'Updated',
        value: 2,
      })

      const result = await getDocument(testCollection, 'overwrite-test')
      expect(result?.name).toBe('Updated')
      expect(result?.value).toBe(2)
    })
  })

  describe('updateDocument', () => {
    it('should update specific fields in document', async () => {
      await setDocument(testCollection, 'update-test', {
        name: 'Test',
        value: 1,
        other: 'keep',
      })
      testDocIds.push('update-test')

      await updateDocument(testCollection, 'update-test', { value: 2 })

      const result = await getDocument(testCollection, 'update-test')
      expect(result?.value).toBe(2)
      expect(result?.other).toBe('keep') // Other field unchanged
    })
  })

  describe('deleteDocument', () => {
    it('should delete document', async () => {
      await setDocument(testCollection, 'delete-test', {
        name: 'Delete Me',
      })

      await deleteDocument(testCollection, 'delete-test')

      const result = await getDocument(testCollection, 'delete-test')
      expect(result).toBeNull()
    })
  })
})
