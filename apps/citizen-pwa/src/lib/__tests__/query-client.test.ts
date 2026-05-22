import { describe, it, expect } from 'vitest'
import type { PersistedClient } from '@tanstack/query-persist-client-core'
import { isSensitiveQueryKey, stripSensitiveQueries } from '../query-client.js'

// Minimal type-compatible query shape for testing
interface TestQuery {
  queryKey: readonly unknown[]
  queryHash: string
  state: {
    data?: unknown
    error: null
    status: string
    fetchStatus: string
    fetchMeta: null
  }
}

function makePersistedClient(queries: TestQuery[]): PersistedClient {
  return {
    buster: 'test',
    clientState: {
      queries: queries as unknown as PersistedClient['clientState']['queries'],
      mutations: [],
    },
  } as unknown as PersistedClient
}

function makeQuery(key: string[], data?: unknown): TestQuery {
  return {
    queryKey: key,
    queryHash: String(key),
    state: {
      data,
      error: null,
      status: 'success',
      fetchStatus: 'idle',
      fetchMeta: null,
    },
  }
}

describe('isSensitiveQueryKey', () => {
  it('returns true for users query key', () => {
    expect(isSensitiveQueryKey(['users', 'abc123'])).toBe(true)
  })

  it('returns true for responders query key', () => {
    expect(isSensitiveQueryKey(['responders', 'xyz789'])).toBe(true)
  })

  it('returns true for report_private query key', () => {
    expect(isSensitiveQueryKey(['report_private', 'report-1'])).toBe(true)
  })

  it('returns false for non-sensitive query keys', () => {
    expect(isSensitiveQueryKey(['reports', 'public'])).toBe(false)
    expect(isSensitiveQueryKey(['alerts'])).toBe(false)
    expect(isSensitiveQueryKey(['municipalities'])).toBe(false)
  })

  it('returns false for non-array keys', () => {
    expect(isSensitiveQueryKey('users')).toBe(false)
    expect(isSensitiveQueryKey(null)).toBe(false)
    expect(isSensitiveQueryKey(undefined)).toBe(false)
    expect(isSensitiveQueryKey(42)).toBe(false)
  })

  it('returns false for partial matches', () => {
    expect(isSensitiveQueryKey(['user_profiles'])).toBe(false)
    expect(isSensitiveQueryKey(['responders_archive'])).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(isSensitiveQueryKey([])).toBe(false)
  })
})

describe('stripSensitiveQueries', () => {
  it('removes queries with sensitive keys', () => {
    const client = makePersistedClient([
      makeQuery(['reports', 'public'], { id: 'r1' }),
      makeQuery(['users', 'u1'], { name: 'Alice' }),
      makeQuery(['alerts'], [{ id: 'a1' }]),
      makeQuery(['responders', 'r1'], { lat: 14.5 }),
    ])

    const result = stripSensitiveQueries(client)

    expect(result.clientState.queries).toHaveLength(2)
    const keys = result.clientState.queries.map((q) => (q as TestQuery).queryKey[0])
    expect(keys).toEqual(['reports', 'alerts'])
  })

  it('preserves non-sensitive queries in original order', () => {
    const client = makePersistedClient([
      makeQuery(['municipalities']),
      makeQuery(['users', 'u1'], { name: 'Bob' }),
      makeQuery(['agencies']),
    ])

    const result = stripSensitiveQueries(client)

    expect(result.clientState.queries).toHaveLength(2)
    expect((result.clientState.queries[0] as TestQuery).queryKey[0]).toBe('municipalities')
    expect((result.clientState.queries[1] as TestQuery).queryKey[0]).toBe('agencies')
  })

  it('returns empty queries array when all are sensitive', () => {
    const client = makePersistedClient([
      makeQuery(['users', 'u1']),
      makeQuery(['responders', 'r1']),
    ])

    const result = stripSensitiveQueries(client)

    expect(result.clientState.queries).toHaveLength(0)
  })

  it('returns unchanged client when no sensitive queries', () => {
    const client = makePersistedClient([
      makeQuery(['reports']),
      makeQuery(['alerts']),
    ])

    const result = stripSensitiveQueries(client)

    expect(result.clientState.queries).toHaveLength(2)
  })

  it('preserves clientState mutations and buster', () => {
    const client = makePersistedClient([
      makeQuery(['reports']),
    ])
    client.clientState.mutations = [{ mutationKey: ['submitReport'] }] as never

    const result = stripSensitiveQueries(client)

    expect(result.clientState.mutations).toHaveLength(1)
    expect(result.buster).toBe('test')
  })
})
