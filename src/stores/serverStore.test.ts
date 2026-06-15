import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useServerStore } from '@/stores/serverStore'
import type { TestSuiteRunResult } from '@/testing/core/types'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

function createRun(runId: string, suiteName = 'Suite'): TestSuiteRunResult {
  return {
    schemaVersion: 1,
    runId,
    suiteId: 'suite-id',
    suiteName,
    startedAt: '2026-06-02T00:00:00.000Z',
    finishedAt: '2026-06-02T00:00:01.000Z',
    durationMs: 1000,
    selectedTestIds: ['test-1'],
    executionOrder: ['test-1'],
    browserInfo: {
      name: 'Chrome',
      version: '125.0',
      userAgent: 'Mozilla/5.0 Test UA',
      platform: 'Linux x86_64',
      language: 'en-US',
      vendor: 'Google Inc.'
    },
    parameters: {
      handle: '@alice@example.com',
      serverOrigin: 'https://example.com'
    },
    context: {},
    results: [],
    summary: {
      pass: 1,
      fail: 0,
      error: 0,
      skip: 0,
      inconclusive: 0,
      total: 1,
      blocked: 0
    }
  }
}

function addBearerServer(origin: string): string {
  const store = useServerStore()
  const actorProfile = {
    id: `${origin}/users/alice`,
    preferredUsername: 'alice',
    outbox: `${origin}/users/alice/outbox`,
    inbox: `${origin}/users/alice/inbox`
  }

  const server = store.addServer({
    authType: 'bearer',
    origin,
    bearerToken: 'token',
    actor: {
      profile: actorProfile,
      discovery: {
        success: true,
        method: 'user',
        actor: actorProfile
      }
    }
  })

  return server.id
}

describe('serverStore test suite results persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    vi.stubGlobal('sessionStorage', new MemoryStorage())
    setActivePinia(createPinia())
  })

  it('persists results to the server record', () => {
    const store = useServerStore()
    const serverId = addBearerServer('https://server-a.example')
    const run = createRun('run-1')

    store.saveTestResults(serverId, run)

    expect(store.getTestResults(serverId)?.runId).toBe('run-1')

    const persisted = JSON.parse(localStorage.getItem('c2s_servers') || '[]')
    const persistedServer = persisted.find((item: { id: string }) => item.id === serverId)
    expect(persistedServer.testing.results.runId).toBe('run-1')
  })

  it('overwrites previous results for the same server', () => {
    const serverId = addBearerServer('https://server-a.example')
    const store = useServerStore()

    store.saveTestResults(serverId, createRun('run-1', 'First Suite'))
    store.saveTestResults(serverId, createRun('run-2', 'Second Suite'))

    const saved = store.getTestResults(serverId)
    expect(saved?.runId).toBe('run-2')
    expect(saved?.suiteName).toBe('Second Suite')
  })

  it('isolates results between servers', () => {
    const store = useServerStore()
    const serverA = addBearerServer('https://server-a.example')
    const serverB = addBearerServer('https://server-b.example')

    store.saveTestResults(serverA, createRun('run-a'))
    store.saveTestResults(serverB, createRun('run-b'))

    expect(store.getTestResults(serverA)?.runId).toBe('run-a')
    expect(store.getTestResults(serverB)?.runId).toBe('run-b')
  })

  it('returns null when saving results to a missing server id', () => {
    const store = useServerStore()

    expect(store.saveTestResults('missing-id', createRun('run-x'))).toBeNull()
    expect(store.getTestResults('missing-id')).toBeNull()
  })

  it('persists test selection per server', () => {
    const store = useServerStore()
    const serverId = addBearerServer('https://server-a.example')

    store.saveTestSelection(serverId, ['test-a', 'test-b'])

    expect(store.getTestSelection(serverId)).toEqual(['test-a', 'test-b'])

    const persisted = JSON.parse(localStorage.getItem('c2s_servers') || '[]')
    const persistedServer = persisted.find((item: { id: string }) => item.id === serverId)
    expect(persistedServer.testing.selectedTests).toEqual(['test-a', 'test-b'])
  })

  it('isolates test selection between servers', () => {
    const store = useServerStore()
    const serverA = addBearerServer('https://server-a.example')
    const serverB = addBearerServer('https://server-b.example')

    store.saveTestSelection(serverA, ['test-a'])
    store.saveTestSelection(serverB, ['test-b'])

    expect(store.getTestSelection(serverA)).toEqual(['test-a'])
    expect(store.getTestSelection(serverB)).toEqual(['test-b'])
  })

  it('returns an empty selection for servers without saved test selection', () => {
    const store = useServerStore()
    const serverId = addBearerServer('https://server-a.example')

    expect(store.getTestSelection(serverId)).toEqual([])
    expect(store.getTestSelection('missing-id')).toEqual([])
  })
})
