import { describe, expect, it } from 'vitest'
import { collectionIsEmpty, extractCollectionItemUri } from '@/testing/core/assertions'

describe('collection helpers', () => {
  it('extracts URI from orderedItems string entries', () => {
    const payload = {
      type: 'OrderedCollectionPage',
      orderedItems: ['https://example.com/activities/1']
    }

    expect(extractCollectionItemUri(payload)).toBe('https://example.com/activities/1')
  })

  it('extracts URI from object entries', () => {
    const payload = {
      type: 'OrderedCollectionPage',
      items: [{ id: 'https://example.com/objects/2' }]
    }

    expect(extractCollectionItemUri(payload)).toBe('https://example.com/objects/2')
  })

  it('marks empty collections as empty', () => {
    expect(collectionIsEmpty({ totalItems: 0 })).toBe(true)
    expect(collectionIsEmpty({ orderedItems: [] })).toBe(true)
  })

  it('does not mark non-empty collections as empty', () => {
    expect(collectionIsEmpty({ totalItems: 2 })).toBe(false)
    expect(collectionIsEmpty({ items: ['https://example.com/one'] })).toBe(false)
  })
})
