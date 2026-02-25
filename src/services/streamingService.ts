/**
 * Streaming Service
 * SSE (Server-Sent Events) client for the fedi-spikes streaming API.
 *
 * Handles:
 *   • topic subscribe / unsubscribe  (POST /sse/control/subscribe|unsubscribe)
 *   • stream ticket issuance         (POST /sse/control/issue-ticket)
 *   • EventSource lifecycle          (start / stop)
 *
 * All side-effects (DOM, UI state) are left to the caller via callbacks.
 */

export type SseStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface SseEventData {
  topic: string
  time: string
  [key: string]: unknown
}

interface SseUrls {
  subscribeUrl: string
  unsubscribeUrl: string
  issueTicketUrl: string
  streamUrl: string
}

export interface SseClientOptions {
  subscribeUrl?: string
  unsubscribeUrl?: string
  issueTicketUrl?: string
  streamUrl?: string
  onEvent?: (eventType: string, data: SseEventData, lastEventId: string) => void
  onStatusChange?: (status: SseStatus) => void
  onError?: (message: string) => void
  onTopicsChange?: (topics: Set<string>) => void
}

/**
 * Reusable SSE client for the streaming API.
 *
 * @example
 *   import { SseClient } from '@/services/streamingService'
 *
 *   const client = new SseClient({
 *     onEvent(type, data, id)   { console.log(type, data); },
 *     onStatusChange(status)    { console.log('status:', status); },
 *     onError(msg)              { console.error(msg); },
 *     onTopicsChange(topics)    { console.log([...topics]); },
 *   })
 *
 *   await client.subscribe('my-topic')
 *   await client.start()
 *   // later…
 *   client.stop()
 */
export class SseClient {
  #topics: Set<string> = new Set()
  #evtSource: EventSource | null = null

  readonly #urls: SseUrls
  readonly #onEvent: NonNullable<SseClientOptions['onEvent']>
  readonly #onStatusChange: NonNullable<SseClientOptions['onStatusChange']>
  readonly #onError: NonNullable<SseClientOptions['onError']>
  readonly #onTopicsChange: NonNullable<SseClientOptions['onTopicsChange']>

  constructor({
    subscribeUrl   = '/sse/control/subscribe',
    unsubscribeUrl = '/sse/control/unsubscribe',
    issueTicketUrl = '/sse/control/issue-ticket',
    streamUrl      = '/sse/stream',
    onEvent        = () => {},
    onStatusChange = () => {},
    onError        = () => {},
    onTopicsChange = () => {},
  }: SseClientOptions = {}) {
    this.#urls           = { subscribeUrl, unsubscribeUrl, issueTicketUrl, streamUrl }
    this.#onEvent        = onEvent
    this.#onStatusChange = onStatusChange
    this.#onError        = onError
    this.#onTopicsChange = onTopicsChange
  }

  /** Returns a snapshot copy of the current topic set. */
  get topics(): Set<string> {
    return new Set(this.#topics)
  }

  /** True while an EventSource connection is open. */
  get streaming(): boolean {
    return this.#evtSource !== null
  }

  /**
   * Subscribe to a topic. Throws on HTTP error.
   * @param topic - The topic name to subscribe to
   */
  async subscribe(topic: string): Promise<void> {
    const res = await fetch(this.#urls.subscribeUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topic }),
    })
    if (!res.ok) throw new Error(await res.text())
    this.#topics.add(topic)
    this.#onTopicsChange(this.topics)
  }

  /**
   * Unsubscribe from a topic. Throws on HTTP error.
   * @param topic - The topic name to unsubscribe from
   */
  async unsubscribe(topic: string): Promise<void> {
    const res = await fetch(this.#urls.unsubscribeUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topic }),
    })
    if (!res.ok) throw new Error(await res.text())
    this.#topics.delete(topic)
    this.#onTopicsChange(this.topics)
  }

  /**
   * Issue a stream ticket then open the EventSource connection.
   * Fires onStatusChange('connecting') immediately, then 'connected' on open
   * or 'error' if the connection fails.
   * Throws if no topics are subscribed or the ticket request fails.
   */
  async start(): Promise<void> {
    if (this.#topics.size === 0) {
      throw new Error('Add at least one topic before starting the stream.')
    }

    // Obtain a short-lived ticket; the server sets it as a cookie.
    const ticketRes = await fetch(this.#urls.issueTicketUrl, {
      method:      'POST',
      credentials: 'include',
    })
    if (!ticketRes.ok) {
      const body = await ticketRes.json().catch(() => ({ detail: ticketRes.statusText })) as { detail?: string }
      throw new Error(body.detail ?? ticketRes.statusText)
    }

    this.#onStatusChange('connecting')

    // withCredentials ensures the ticket cookie is sent cross-origin.
    this.#evtSource = new EventSource(this.#urls.streamUrl, { withCredentials: true })

    const handleEvent = (e: MessageEvent): void => {
      let data: SseEventData
      try {
        data = JSON.parse(e.data) as SseEventData
      } catch {
        data = { topic: '?', time: '?' }
      }
      this.#onEvent(e.type, data, e.lastEventId)
    }

    this.#evtSource.addEventListener('update',  handleEvent)
    this.#evtSource.addEventListener('message', handleEvent)

    this.#evtSource.onopen = (): void => {
      console.log('[SseClient] connection opened')
      this.#onStatusChange('connected')
    }

    this.#evtSource.onerror = (): void => {
      console.error('[SseClient] connection error', this.#evtSource)
      this.#evtSource = null
      this.#onStatusChange('error')
      this.#onError('Stream error or server closed the connection.')
    }
  }

  /** Close the EventSource connection if open. */
  stop(): void {
    if (this.#evtSource) {
      this.#evtSource.close()
      this.#evtSource = null
    }
    this.#onStatusChange('disconnected')
  }
}
