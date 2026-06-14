import type { TestAssertion, TestCaseDefinition, TestSuiteDefinition } from '@/testing/core/types'
import { resolveHandle } from '@/services/webfingerService'
import { collectionIsEmpty, getCollectionItemUris } from '@/testing/core/assertions'

const ACTOR_ASSERTIONS: TestAssertion[] = [
  {
    kind: 'status',
    label: 'HTTP status is 200',
    expectedStatus: 200
  },
  {
    kind: 'activityPubObjectShape',
    label: 'Response looks like ActivityPub actor'
  },
  {
    kind: 'jsonPathExists',
    label: 'Actor has inbox',
    jsonPath: 'inbox'
  },
  {
    kind: 'jsonPathExists',
    label: 'Actor has outbox',
    jsonPath: 'outbox'
  }
]

const COLLECTION_ASSERTIONS: TestAssertion[] = [
  {
    kind: 'status',
    label: 'HTTP status is 200',
    expectedStatus: 200
  },
  {
    kind: 'jsonPathExists',
    label: 'Collection type is present',
    jsonPath: 'type'
  }
]

const DEREFERENCE_ASSERTIONS: TestAssertion[] = [
  {
    kind: 'status',
    label: 'HTTP status is 200',
    expectedStatus: 200
  },
  {
    kind: 'activityPubObjectShape',
    label: 'Payload looks like ActivityPub object'
  }
]

const tests: TestCaseDefinition[] = [
  {
    id: 'webfinger',
    name: 'Verify WebFinger handle resolution',
    description: 'Verify that the actor handle resolves to the authenticated actor URI.',
    run: async (context, tools) => {
      const handle = context.parameters.handle?.trim()
      const authenticatedActorUri = (context.parameters as Record<string, unknown>).authenticatedActorUri as string | undefined

      if (!handle) {
        return tools.fail('Handle is required for WebFinger verification')
      }

      if (!authenticatedActorUri) {
        return tools.fail('Authenticated actor URI is required for WebFinger verification')
      }

      const actorUri = await resolveHandle(handle)
      if (!actorUri) {
        return tools.fail(`WebFinger could not resolve actor URI for ${handle}`)
      }

      if (actorUri !== authenticatedActorUri) {
        return tools.fail(`WebFinger resolved ${actorUri}, expected ${authenticatedActorUri}`)
      }

      return {
        status: 'pass',
        reason: `WebFinger resolved actor URI correctly for ${handle}`,
        assertions: [],
        contextUpdates: { actorUri }
      }
    }
  },
  {
    id: 'actor-document',
    name: 'Retrieve actor document',
    description: 'Fetch actor JSON and extract inbox/outbox links.',
    run: async (context, tools) => {
      const actorUri = (context.parameters as Record<string, unknown>).authenticatedActorUri as string | undefined
      if (!actorUri) {
        return tools.fail('authenticatedActorUri parameter is required')
      }

      const outcome = await tools.executeRequest({
        url: actorUri
      }, ACTOR_ASSERTIONS)

      if (!outcome.attempt?.responseJson || outcome.status !== 'pass') {
        return outcome
      }

      const payload = outcome.attempt.responseJson as Record<string, unknown>
      const inboxUri = typeof payload.inbox === 'string' ? payload.inbox : undefined
      const outboxUri = typeof payload.outbox === 'string' ? payload.outbox : undefined

      return {
        ...outcome,
        contextUpdates: {
          actorDocument: payload,
          inboxUri,
          outboxUri
        }
      }
    }
  },
  {
    id: 'inbox-collection',
    name: 'Retrieve inbox collection',
    description: 'Fetch inbox collection payload and keep it in context.',
    dependsOn: ['actor-document'],
    run: async (context, tools) => {
      const inboxUri = context.getShared<string>('inboxUri')
      if (!inboxUri) {
        return tools.inconclusive('Actor did not expose inbox URI')
      }

      const outcome = await tools.executeRequest({ url: inboxUri }, COLLECTION_ASSERTIONS)
      if (!outcome.attempt?.responseJson || outcome.status !== 'pass') {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: {
          inboxCollection: outcome.attempt.responseJson
        }
      }
    }
  },
  {
    id: 'inbox-item-deref',
    name: 'Dereference inbox item URI',
    description: 'Fetch one inbox item from collection items or first page.',
    dependsOn: ['inbox-collection'],
    run: async (context, tools) => {
      const inboxCollection = context.getShared<unknown>('inboxCollection')
      if (!inboxCollection) {
        return tools.inconclusive('Inbox collection payload is unavailable')
      }

      const fetcher = async (url: string): Promise<unknown> => {
        const outcome = await tools.executeRequest({ url }, COLLECTION_ASSERTIONS)
        return outcome.attempt?.responseJson
      }

      const [inboxItemUri] = await getCollectionItemUris(inboxCollection, fetcher)
      if (!inboxItemUri) {
        return tools.inconclusive(
          collectionIsEmpty(inboxCollection)
            ? 'Inbox collection is empty'
            : 'Could not find a dereferenceable inbox item URI'
        )
      }

      const derefOutcome = await tools.executeRequest({ url: inboxItemUri }, DEREFERENCE_ASSERTIONS)
      return {
        ...derefOutcome,
        contextUpdates: { inboxItemUri }
      }
    }
  },
  {
    id: 'outbox-collection',
    name: 'Retrieve outbox collection',
    description: 'Fetch outbox collection payload and keep it in context.',
    dependsOn: ['actor-document'],
    run: async (context, tools) => {
      const outboxUri = context.getShared<string>('outboxUri')
      if (!outboxUri) {
        return tools.inconclusive('Actor did not expose outbox URI')
      }

      const outcome = await tools.executeRequest({ url: outboxUri }, COLLECTION_ASSERTIONS)
      if (!outcome.attempt?.responseJson || outcome.status !== 'pass') {
        return outcome
      }

      return {
        ...outcome,
        contextUpdates: {
          outboxCollection: outcome.attempt.responseJson
        }
      }
    }
  },
  {
    id: 'outbox-item-deref',
    name: 'Dereference outbox item URI',
    description: 'Fetch one outbox item from collection items or first page.',
    dependsOn: ['outbox-collection'],
    run: async (context, tools) => {
      const outboxCollection = context.getShared<unknown>('outboxCollection')
      if (!outboxCollection) {
        return tools.inconclusive('Outbox collection payload is unavailable')
      }

      const fetcher = async (url: string): Promise<unknown> => {
        const outcome = await tools.executeRequest({ url }, COLLECTION_ASSERTIONS)
        return outcome.attempt?.responseJson
      }

      const [outboxItemUri] = await getCollectionItemUris(outboxCollection, fetcher)
      if (!outboxItemUri) {
        return tools.inconclusive(
          collectionIsEmpty(outboxCollection)
            ? 'Outbox collection is empty'
            : 'Could not find a dereferenceable outbox item URI'
        )
      }

      const derefOutcome = await tools.executeRequest({ url: outboxItemUri }, DEREFERENCE_ASSERTIONS)
      return {
        ...derefOutcome,
        contextUpdates: { outboxItemUri }
      }
    }
  }
]

export const actorResolutionAndCollectionsSuite: TestSuiteDefinition = {
  id: 'actor-resolution-and-collections',
  name: 'Actor Resolution and Collections',
  description: 'Validate WebFinger identity mapping and follow inbox/outbox dependency chains from authenticated actor URI.',
  tests
}
