import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMunicipalityLookup } from '../municipality-lookup.js'

const mockGet = vi.fn()
const mockCollection = vi.fn()

function db() {
  return {
    collection: mockCollection.mockReturnValue({ get: mockGet }),
  }
}

beforeEach(() => {
  mockGet.mockReset()
  mockCollection.mockClear()
})

describe('municipality lookup', () => {
  it('loads the map once and caches it', async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: 'daet', data: () => ({ label: 'Daet' }) },
        { id: 'basud', data: () => ({ label: 'Basud' }) },
      ],
    })
    const lookup = createMunicipalityLookup(db() as never)
    expect(await lookup.label('daet')).toBe('Daet')
    expect(await lookup.label('basud')).toBe('Basud')
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockCollection).toHaveBeenCalledWith('municipalities')
  })

  it('throws on unknown id', async () => {
    mockGet.mockResolvedValue({ docs: [{ id: 'daet', data: () => ({ label: 'Daet' }) }] })
    const lookup = createMunicipalityLookup(db() as never)
    await expect(lookup.label('unknown')).rejects.toMatchObject({ code: 'MUNICIPALITY_NOT_FOUND' })
  })
})
